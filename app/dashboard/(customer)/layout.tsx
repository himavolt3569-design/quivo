import { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { LiveChat } from "@/components/dashboard/LiveChat";

export default async function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
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
    await supabase.from("profiles").upsert(
      { id: user.id, email: user.email!, role: "customer" },
      { onConflict: "id", ignoreDuplicates: true }
    );
    const { data: retried } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (retried) {
      profile = retried;
      profileError = null;
    }
  }

  if (!profile) {
    console.error("Customer layout: could not resolve profile", profileError);
    redirect("/?login=true");
  }

  // If they are an owner, send them to the owner dash
  if (profile.role === "owner") {
    redirect("/dashboard/owner");
  }

  const { count: activeOrderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", user.id)
    .not("status", "in", "(delivered,cancelled)");

  return (
    <div className="animate-in fade-in duration-300">
      <DashboardNav activeOrderCount={activeOrderCount ?? 0} />
      <main className="container px-4 pb-28 pt-8 sm:px-6 sm:pb-10 lg:pt-10">
        <div className="mx-auto max-w-5xl">
          {children}
        </div>
      </main>
      <LiveChat currentUser={user} />
    </div>
  );
}
