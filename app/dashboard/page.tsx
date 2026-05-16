import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
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

  // Pull membership + staff-link state in one round trip and route once:
  //   - Any active shop_members row  → owner console (its sidebar gates
  //     features by role, so admin / manager / cashier / inventory / viewer
  //     all land there).
  //   - profile.role = owner with no memberships → onboarding (need to create
  //     their first shop).
  //   - Linked as shop_staff somewhere but not a member → staff dashboard
  //     (clock-in/out only, no shop console access).
  //   - Otherwise → customer home.
  const [{ count: membershipCount }, { count: linkedStaffCount }] = await Promise.all([
    supabase
      .from("shop_members")
      .select("shop_id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", "active"),
    supabase
      .from("shop_staff")
      .select("id", { count: "exact", head: true })
      .eq("linked_user_id", user!.id),
  ]);

  if ((membershipCount ?? 0) > 0) {
    redirect("/dashboard/owner");
  }

  if (profile.role === "owner") {
    redirect("/onboarding/owner");
  }

  if ((linkedStaffCount ?? 0) > 0) {
    redirect("/dashboard/staff");
  }

  redirect("/dashboard/home");
}
