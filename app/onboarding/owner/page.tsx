import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OwnerOnboarding } from "@/components/onboarding/OwnerOnboarding";

export default async function OwnerOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?login=true");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

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

  return <OwnerOnboarding />;
}
