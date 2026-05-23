import { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { LiveChat } from "@/components/dashboard/LiveChat";
import { RoleModeSwitch } from "@/components/dashboard/RoleModeSwitch";

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

  const [profileResult, activeOrderCountResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user!.id)
      .not("status", "in", "(delivered,cancelled)"),
  ]);

  const { data: profile } = profileResult;

  // SECURITY: no self-healing. A missing profile for an authenticated user
  // means the account was revoked (admin deleted the profile row) or the
  // auth.users row is orphaned. Redirect to the revocation route which
  // signs the session out globally and lands them on the login page.
  if (!profile) {
    redirect("/auth/revoked");
  }

  // Owners can browse the customer dashboard; they get a "Back to Owner" pill.
  // Customers stay here. The owner layout enforces the inverse (customers
  // cannot reach /dashboard/owner).
  const isOwner = profile.role === "owner";

  return (
    <div className="animate-in fade-in duration-300">
      <DashboardNav activeOrderCount={activeOrderCountResult.count ?? 0} />
      {isOwner && <RoleModeSwitch variant="pill" targetMode="owner" />}
      <main className="container px-4 pb-32 pt-8 sm:px-6 sm:pb-10 lg:pt-10">
        <div className="mx-auto max-w-5xl">
          {children}
        </div>
      </main>
      <LiveChat
        currentUser={user!}
        customerName={profile.full_name ?? user!.email?.split("@")[0] ?? "Customer"}
      />
    </div>
  );
}
