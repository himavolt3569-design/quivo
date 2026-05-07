import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CustomerDashboard } from "@/components/dashboard/CustomerDashboard";
import { OwnerDashboard } from "@/components/dashboard/OwnerDashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/?login=true");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "customer";

  return role === "owner" ? <OwnerDashboard /> : <CustomerDashboard />;
}
