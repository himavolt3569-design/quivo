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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  // Profile missing (trigger not yet fired, or first load race) — attempt upsert
  if (!profile) {
    if (profileError && profileError.code !== "PGRST116") {
      // Unexpected DB error — log for debugging but keep the user moving
      console.error("profiles SELECT error:", profileError.code, profileError.message);
    }

    const inferredRole =
      user!.app_metadata?.provider === "google" ? "owner" : "customer";

    await supabase.from("profiles").upsert(
      { id: user!.id, email: user!.email!, role: inferredRole },
      { onConflict: "id", ignoreDuplicates: true }
    );

    redirect(inferredRole === "owner" ? "/dashboard/owner" : "/dashboard/home");
  }

  redirect(profile.role === "owner" ? "/dashboard/owner" : "/dashboard/home");
}
