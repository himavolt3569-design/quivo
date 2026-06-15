import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { OwnerOnboarding } from "@/components/onboarding/OwnerOnboarding";
import {
  ONBOARDING_COOKIE_NAME,
  verifyOnboardingToken,
} from "@/lib/onboarding-token";

export default async function OwnerOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?login=true");
  }

  const [profileResult, shopCountResult] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle(),
    supabase
      .from("shop_members")
      .select("shop_id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", "active"),
  ]);

  const { data: profile } = profileResult;

  // SECURITY: no self-healing. Missing profile = revoked account.
  if (!profile) {
    redirect("/auth/revoked");
  }

  // Block customers from accessing the owner onboarding flow — otherwise a
  // customer-role user could create a shop_member row and end up desynced
  // (shop_members.role='owner' while profile.role='customer').
  if (profile.role !== "owner") {
    redirect("/dashboard/home");
  }

  // ─── URL-bypass gate ───────────────────────────────────────────────────
  // First-time owners (0 shops) are allowed to reach this page directly —
  // /dashboard sends them here as the only path forward.  Owners who
  // already have at least one shop MUST come through startNewShopOnboarding()
  // which sets a 10-min HMAC-signed cookie.  Bare URL navigation → kick
  // them back to the dashboard so the "Add New Shop" button is the only
  // legitimate entry point.
  if ((shopCountResult.count ?? 0) > 0) {
    const jar = await cookies();
    const raw = jar.get(ONBOARDING_COOKIE_NAME)?.value;
    const verifiedUserId = verifyOnboardingToken(raw);
    if (verifiedUserId !== user!.id) {
      redirect("/dashboard/owner");
    }
  }

  return <OwnerOnboarding />;
}
