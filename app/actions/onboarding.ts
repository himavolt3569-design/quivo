"use server";

/**
 * Onboarding flow guards.
 *
 * startNewShopOnboarding(): issues a 10-min HMAC-signed cookie and redirects
 * to /onboarding/owner.  This is the ONLY way an owner with existing shops
 * can reach the shop-creation page — direct URL access is blocked.
 *
 * clearOnboardingIntent(): wipes the cookie after a successful shop creation
 * (called from createShop), so refreshing /onboarding/owner re-triggers the
 * gate instead of letting the user create another shop with a stale token.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  issueOnboardingToken,
  ONBOARDING_COOKIE_NAME,
  ONBOARDING_TOKEN_TTL_MS,
} from "@/lib/onboarding-token";

export async function startNewShopOnboarding(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?login=true");

  // Only owner-role users may enter the shop-creation flow.  Block customers
  // so a customer can't even get a token; the onboarding page double-checks.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();
  if (!profile) redirect("/auth/revoked");
  if (profile.role !== "owner") redirect("/dashboard/home");

  const token = issueOnboardingToken(user!.id);
  const jar = await cookies();
  jar.set(ONBOARDING_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure:  process.env.NODE_ENV === "production",
    path:    "/onboarding",
    maxAge:  Math.floor(ONBOARDING_TOKEN_TTL_MS / 1000),
  });

  redirect("/onboarding/owner");
}

export async function clearOnboardingIntent(): Promise<void> {
  const jar = await cookies();
  jar.delete(ONBOARDING_COOKIE_NAME);
}
