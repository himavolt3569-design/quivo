import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { AUTH_ERROR_CODES } from "@/lib/auth-errors";
import { createHash } from "crypto";
import { headers } from "next/headers";

/**
 * Account-revocation termination point.
 *
 * Server Components (layouts/pages) cannot write cookies, so they cannot
 * directly sign a session out. When they detect an authenticated user whose
 * profile is missing (a signal that an admin deleted the account, or a
 * tampered/stale session is in play), they redirect here. This route handler
 * is the one place authorized to clear the session cookies and emit an audit
 * event.
 *
 * Idempotent: hitting it without a session is fine — it just redirects.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Best-effort audit. Never block the sign-out on a logging failure —
      // the security action (revoke) takes priority over observability.
      try {
        const h = await headers();
        const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
        const salt =
          process.env.SUPABASE_SERVICE_ROLE_KEY ??
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
          "";
        const ipHash = ip
          ? createHash("sha256").update(`${ip}|${salt}`).digest("hex").slice(0, 32)
          : null;

        await supabase.rpc("record_security_event", {
          p_event_type: "account_revoked",
          p_metadata: { email: user.email, user_id: user.id },
          p_ip_hash: ipHash,
        });
      } catch (auditErr) {
        console.error("auth/revoked: audit failed", {
          event: "audit_log_failed",
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      }

      console.warn("auth/revoked: terminating session", {
        event: "account_revoked",
        userId: user.id,
        email: user.email,
      });

      // Global scope invalidates the refresh token on every device, not just
      // this browser — important for an admin-driven revocation.
      await supabase.auth.signOut({ scope: "global" });
    }
  } catch (err) {
    console.error("auth/revoked: unexpected error", {
      event: "unexpected_error",
      error: err instanceof Error ? err.message : String(err),
    });
    // Fall through — we still want to land them on the home page.
  }

  return NextResponse.redirect(
    `${origin}/?auth_error=${AUTH_ERROR_CODES.ACCOUNT_REVOKED}`
  );
}
