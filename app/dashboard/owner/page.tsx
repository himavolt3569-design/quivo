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

  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Self-healing: profile may not exist if the DB trigger wasn't deployed
  if (profileError?.code === "PGRST116" || (!profile && !profileError)) {
    const inferredRole = user!.app_metadata?.provider === "google" ? "owner" : "customer";
    await supabase.from("profiles").upsert(
      { id: user!.id, email: user!.email!, role: inferredRole },
      { onConflict: "id", ignoreDuplicates: true }
    );
    const { data: retried } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user!.id)
      .single();
    if (retried) {
      profile = retried;
      profileError = null;
    }
  }

  if (!profile) {
    console.error("Owner page: could not resolve profile", profileError);
    redirect("/?login=true");
  }

  if (profile.role !== "owner") {
    redirect("/dashboard/home");
  }

  return <OwnerDashboard />;
}
