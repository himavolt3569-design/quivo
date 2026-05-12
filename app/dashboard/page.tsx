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

  if (profile.role === "owner") {
    const { count } = await supabase
      .from("shop_members")
      .select("shop_id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", "active");

    redirect((count ?? 0) > 0 ? "/dashboard/owner" : "/onboarding/owner");
  }

  redirect("/dashboard/home");
}
