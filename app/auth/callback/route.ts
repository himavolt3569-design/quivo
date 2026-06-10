import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/security";
import { checkRateLimit } from "@/lib/rate-limit";
import { AUTH_ERROR_CODES, type AuthErrorCode } from "@/lib/auth-errors";
import { decideCallbackOutcome, type Role } from "@/lib/auth-callback-decision";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { log } from "@/lib/log";

function parseIntent(value: string | null): Role | null {
  return value === "owner" || value === "customer" ? value : null;
}

async function hashIp(): Promise<string | null> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (!ip) return null;
    const salt =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "";
    return createHash("sha256")
      .update(`${ip}|${salt}`)
      .digest("hex")
      .slice(0, 32);
  } catch {
    return null;
  }
}

function errorRedirect(
  origin: string,
  code: AuthErrorCode,
  extra?: Record<string, string>,
) {
  const params = new URLSearchParams({ auth_error: code, ...(extra ?? {}) });
  return NextResponse.redirect(`${origin}/?${params.toString()}`);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = getSafeRedirectPath(searchParams.get("next"));
  const intent = parseIntent(searchParams.get("intent"));

  if (!code) {
    return errorRedirect(origin, AUTH_ERROR_CODES.EXCHANGE_FAILED);
  }

  try {
    const supabase = await createClient();

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      log.error("auth/callback: exchange failed", {
        event: "exchange_failed",
        message: exchangeError.message,
      });
      return errorRedirect(origin, AUTH_ERROR_CODES.EXCHANGE_FAILED);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return errorRedirect(origin, AUTH_ERROR_CODES.EXCHANGE_FAILED);
    }

    // Look up existing profile (do not create yet — decision logic uses
    // null to signal "no profile yet").
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const existingRole: Role | null =
      existingProfile?.role === "owner" || existingProfile?.role === "customer"
        ? existingProfile.role
        : null;

    // SECURITY: distinguish a fresh signup (no profile yet — legit) from a
    // revoked user returning (no profile because an admin deleted it, but
    // auth.users still exists). Fresh signups have user.created_at within
    // seconds of now; a revoked returning user is minutes/days old.
    const FRESH_SIGNUP_WINDOW_MS = 60 * 1000; // 1 minute
    const userAgeMs = Date.now() - new Date(user.created_at).getTime();
    const isFreshSignup = userAgeMs <= FRESH_SIGNUP_WINDOW_MS;

    if (!existingRole && !isFreshSignup) {
      log.warn("auth/callback: returning user has no profile — revoking", {
        event: "account_revoked",
        userId: user.id,
        email: user.email,
        userAgeMs,
      });
      try {
        await supabase.rpc("record_security_event", {
          p_event_type: "account_revoked",
          p_metadata: {
            email: user.email,
            user_id: user.id,
            user_age_ms: userAgeMs,
            via: "callback",
          },
          p_ip_hash: null,
        });
      } catch {
        /* best-effort */
      }
      await supabase.auth.signOut({ scope: "global" });
      return errorRedirect(origin, AUTH_ERROR_CODES.ACCOUNT_REVOKED);
    }

    // If no profile yet AND this is a fresh signup, attempt the insert.
    // A 23505 (unique-violation on email) here means another auth.users row
    // already claimed this email → treat as duplicate-account rejection.
    let profileCreationConflict = false;
    if (!existingRole && isFreshSignup) {
      const metaRole = user.user_metadata?.role;
      const seedRole: Role =
        metaRole === "owner" || metaRole === "customer"
          ? metaRole
          : (intent ?? "customer");

      const { error: insertError } = await supabase
        .from("profiles")
        .upsert(
          { id: user.id, email: user.email!, role: seedRole },
          { onConflict: "id", ignoreDuplicates: true },
        );

      if (insertError) {
        if (insertError.code === "23505") {
          profileCreationConflict = true;
        } else {
          log.error("auth/callback: profile upsert failed", {
            event: "profile_upsert_failed",
            code: insertError.code,
            message: insertError.message,
            userId: user.id,
          });
        }
      }
    }

    // Resolve hasShop only when relevant (owner path). The decision helper
    // can read it as `false` for customers without us paying for a query.
    const effectiveRole: Role = existingRole ?? intent ?? "customer";
    let hasShop = false;
    if (effectiveRole === "owner" && !profileCreationConflict) {
      const { count } = await supabase
        .from("shop_members")
        .select("shop_id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "active");
      hasShop = (count ?? 0) > 0;
    }

    const outcome = decideCallbackOutcome({
      intent,
      existingProfileRole: existingRole,
      hasShop,
      explicitNext: explicitNext === "/dashboard" ? null : explicitNext,
      profileCreationConflict,
    });

    if (outcome.kind === "conflict" || outcome.kind === "duplicate") {
      // Rate-limit the conflict path to prevent probing for account roles.
      const rl = await checkRateLimit("auth_callback_conflict");
      if (!rl.success) {
        await supabase.auth.signOut({ scope: "global" });
        return errorRedirect(origin, AUTH_ERROR_CODES.RATE_LIMITED);
      }

      const ipHash = await hashIp();

      // Best-effort audit — never let a logging failure block the rejection.
      try {
        const metadata =
          outcome.kind === "conflict"
            ? { actual: outcome.actual, attempted: outcome.attempted, intent }
            : { intent };
        await supabase.rpc("record_security_event", {
          p_event_type: outcome.code,
          p_metadata: metadata,
          p_ip_hash: ipHash,
        });
      } catch (auditErr) {
        log.error("auth/callback: audit log failed", {
          event: "audit_log_failed",
          error:
            auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      }

      log.warn("auth/callback: rejecting session", {
        event: outcome.code,
        userId: user.id,
        intent,
        existingRole,
      });

      // Global sign-out invalidates the session on every device, not just here.
      await supabase.auth.signOut({ scope: "global" });

      if (outcome.kind === "conflict") {
        return errorRedirect(origin, AUTH_ERROR_CODES.ROLE_CONFLICT, {
          actual: outcome.actual,
          attempted: outcome.attempted,
        });
      }
      return errorRedirect(origin, AUTH_ERROR_CODES.DUPLICATE_EMAIL);
    }

    return NextResponse.redirect(`${origin}${outcome.target}`);
  } catch (err) {
    log.error("auth/callback: unexpected error", {
      event: "unexpected_error",
      error: err instanceof Error ? err.message : String(err),
    });
    return errorRedirect(origin, AUTH_ERROR_CODES.EXCHANGE_FAILED);
  }
}
