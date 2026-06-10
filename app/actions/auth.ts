"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { getSiteUrl } from "@/lib/security";
import { log } from "@/lib/log";

const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "temp-mail.org",
  "yopmail.com",
  "throwawaymail.com",
  "tempmail.com",
  "tempmail.net",
  "tempmail.co",
  "tempmail.info",
  "tempmail.biz",
  "tempmail.io",
  "tempmail.org",
  "dropmail.me",
  "getnada.com",
  "sharklasers.com",
  "dispostable.com",
];

function isDisposableEmail(email: string) {
  const domain = email.split("@")[1];
  if (!domain) return true;
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain.toLowerCase());
}

const AuthSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email too long"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password too long"),
});

const SignUpSchema = AuthSchema.extend({
  role: z.enum(["customer", "owner"]).default("customer"),
});

type SignUpIntent = "customer" | "owner";

export async function loginWithEmail(formData: FormData) {
  const rateLimit = await checkRateLimit("loginWithEmail");
  if (!rateLimit.success) {
    return { error: rateLimit.error };
  }

  const parseResult = AuthSchema.safeParse(Object.fromEntries(formData));
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0].message };
  }

  const { email, password } = parseResult.data;
  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError) {
    return { error: "Invalid email or password." };
  }

  const rememberMe = formData.get("rememberMe") === "on";

  if (!rememberMe) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    for (const cookie of allCookies) {
      if (
        cookie.name.startsWith("sb-") &&
        cookie.name.endsWith("-auth-token")
      ) {
        // Overwrite the cookie to be a session cookie (no maxAge, no expires)
        cookieStore.set(cookie.name, cookie.value, {
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: undefined,
          expires: undefined,
        });
      }
    }
  }

  if (!authData.user) {
    return { error: "Authentication failed. Please try again." };
  }

  // SECURITY: do NOT auto-create a profile here. If a profile row is missing
  // for a successfully authenticated user, treat it as account revocation —
  // an admin deleted the profile (or the auth.users row is orphaned). Sign
  // the session out globally and refuse the login. Profile rows are only
  // created during the legitimate signup paths (email verification or OAuth
  // callback inside /auth/callback).
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!profile) {
    log.warn("loginWithEmail: authenticated user has no profile — revoking", {
      event: "account_revoked",
      userId: authData.user.id,
      email: authData.user.email,
    });
    // Audit while we still have auth.uid() — the RPC binds it at call time.
    try {
      await supabase.rpc("record_security_event", {
        p_event_type: "account_revoked",
        p_metadata: {
          email: authData.user.email,
          user_id: authData.user.id,
          via: "loginWithEmail",
        },
        p_ip_hash: null,
      });
    } catch {
      /* best-effort */
    }
    await supabase.auth.signOut({ scope: "global" });
    return {
      error:
        "Your account is no longer active. If you believe this is a mistake, please contact support.",
    };
  }

  return { success: true, redirectUrl: "/dashboard" };
}

export async function signUpWithEmail(formData: FormData) {
  const rateLimit = await checkRateLimit("signUpWithEmail");
  if (!rateLimit.success) {
    return { error: rateLimit.error };
  }

  const parseResult = SignUpSchema.safeParse(Object.fromEntries(formData));
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0].message };
  }

  const { email, password, role } = parseResult.data;

  if (isDisposableEmail(email)) {
    return {
      error:
        "Temporary or disposable emails are not allowed for security reasons.",
    };
  }

  const supabase = await createClient();

  // Stash the role on user_metadata AND in the callback URL so it survives
  // email verification (some providers strip query params; user_metadata wins
  // if both are present).
  const intent: SignUpIntent = role;
  const emailRedirectTo = `${getSiteUrl()}/auth/callback?intent=${intent}`;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role: intent },
      emailRedirectTo,
    },
  });

  if (error) {
    return { error: "Could not create account. Please try again." };
  }

  return { success: "Check your email to verify your account." };
}

export async function resetPassword(formData: FormData) {
  const rateLimit = await checkRateLimit("resetPassword");
  if (!rateLimit.success) {
    return { error: rateLimit.error };
  }

  const email = formData.get("email")?.toString();
  if (!email || !z.string().email().safeParse(email).success) {
    return { error: "Invalid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard/profile`,
  });

  if (error) {
    return { error: "Could not send reset email. Please try again." };
  }

  return { success: "Password reset link sent! Check your email." };
}

export async function signInWithGoogle() {
  const rateLimit = await checkRateLimit("signInWithGoogle");
  if (!rateLimit.success) {
    return { error: rateLimit.error };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    log.error("Google Auth Error", { message: error.message });
    return { error: "Could not start Google sign-in. Please try again." };
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  const rateLimit = await checkRateLimit("signOut");
  if (!rateLimit.success) {
    return { error: rateLimit.error };
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
