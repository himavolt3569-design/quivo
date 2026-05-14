import { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OwnerSidebar } from "@/components/dashboard/owner/OwnerSidebar";
import { OwnerMobileNav } from "@/components/dashboard/owner/OwnerMobileNav";
import { VerificationBanner } from "@/components/dashboard/owner/VerificationBanner";
import { VerificationGate } from "@/components/dashboard/owner/VerificationGate";
import { getOwnerContext } from "@/lib/shop";

export default async function OwnerLayout({
  children,
}: {
  children: ReactNode;
}) {
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

  // SECURITY: no self-healing. A missing profile = revoked account.
  if (!profile) {
    redirect("/auth/revoked");
  }

  if (profile.role !== "owner") {
    redirect("/dashboard/home");
  }

  const ctx = await getOwnerContext();
  const shops = ctx.shops.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    role: s.role,
    status: s.status,
  }));
  const activeShopId = ctx.activeShop?.id ?? null;

  // Fetch verification status for the active shop
  let verificationStatus: "unverified" | "pending" | "verified" | "rejected" = "unverified";
  if (activeShopId) {
    const { data: shopRow } = await supabase
      .from("shops")
      .select("verification_status")
      .eq("id", activeShopId)
      .maybeSingle();
    if (shopRow?.verification_status) {
      verificationStatus = shopRow.verification_status as typeof verificationStatus;
    }
  }

  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-300">
      <VerificationBanner status={verificationStatus} />
      <div className="flex flex-1">
        <OwnerSidebar shops={shops} activeShopId={activeShopId} />
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <VerificationGate status={verificationStatus}>
            {children}
          </VerificationGate>
        </main>
        <OwnerMobileNav shops={shops} activeShopId={activeShopId} />
      </div>
    </div>
  );
}
