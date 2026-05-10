import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/dashboard/OwnerDashboard";

export default async function OwnerPage() {
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
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") {
    redirect("/dashboard/home");
  }

  return <OwnerDashboard />;
}
