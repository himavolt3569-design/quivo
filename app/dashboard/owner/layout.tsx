import { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OwnerSidebar } from "@/components/dashboard/owner/OwnerSidebar";
import { OwnerMobileNav } from "@/components/dashboard/owner/OwnerMobileNav";
import { VerificationBanner } from "@/components/dashboard/owner/VerificationBanner";
import { VerificationGate } from "@/components/dashboard/owner/VerificationGate";
import { getOwnerContext } from "@/lib/shop";
import {
  getKycCompliancePolicy,
  getKycNotificationStage,
  sendKycComplianceEmail,
  type VerificationStatus,
} from "@/lib/kyc-compliance";
import { log } from "@/lib/log";

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

  const [profileResult, ctx] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, email")
      .eq("id", user!.id)
      .maybeSingle(),
    getOwnerContext(),
  ]);

  const { data: profile } = profileResult;

  // SECURITY: no self-healing. A missing profile = revoked account.
  if (!profile) {
    redirect("/auth/revoked");
  }

  if (profile.role !== "owner") {
    redirect("/dashboard/home");
  }

  const shops = ctx.shops.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    role: s.role,
    status: s.status,
  }));
  const activeShopId = ctx.activeShop?.id ?? null;
  const activeShopRole = ctx.activeShop?.role ?? null;

  let verificationStatus: VerificationStatus = "unverified";
  let kycPolicy = getKycCompliancePolicy({
    verificationStatus,
    createdAt: new Date().toISOString(),
  });

  if (activeShopId) {
    const { data: shopRow } = await supabase
      .from("shops")
      .select("verification_status, created_at, kyc_submitted_at, name")
      .eq("id", activeShopId)
      .maybeSingle();

    if (shopRow?.verification_status) {
      verificationStatus = shopRow.verification_status as VerificationStatus;
      kycPolicy = getKycCompliancePolicy({
        verificationStatus,
        createdAt: shopRow.created_at,
        kycSubmittedAt: shopRow.kyc_submitted_at,
      });
    }

    if (shopRow && profile?.email) {
      const { data: emailState, error: emailStateError } = await supabase
        .from("shops")
        .select(
          "kyc_grace_email_sent_at, kyc_warning_email_sent_at, kyc_deadline_email_sent_at",
        )
        .eq("id", activeShopId)
        .maybeSingle();

      if (!emailStateError && emailState) {
        const stage = getKycNotificationStage(kycPolicy, {
          grace: emailState.kyc_grace_email_sent_at,
          warning: emailState.kyc_warning_email_sent_at,
          deadline: emailState.kyc_deadline_email_sent_at,
        });

        if (stage) {
          const emailResult = await sendKycComplianceEmail({
            to: profile.email,
            shopName: shopRow.name,
            stage,
            graceEndsAt: kycPolicy.graceEndsAt,
            daysRemaining: kycPolicy.daysRemaining,
          });

          if (emailResult.ok) {
            const column =
              stage === "grace"
                ? "kyc_grace_email_sent_at"
                : stage === "warning"
                  ? "kyc_warning_email_sent_at"
                  : "kyc_deadline_email_sent_at";
            await supabase
              .from("shops")
              .update({ [column]: new Date().toISOString() })
              .eq("id", activeShopId);
          }
        }
      } else if (emailStateError && emailStateError.code !== "42703") {
        log.error("KYC email state lookup failed", {
          code: emailStateError.code,
          message: emailStateError.message,
        });
      }
    }
  }

  return (
    <div className="flex flex-col min-h-screen animate-in fade-in duration-300">
      <VerificationBanner status={verificationStatus} policy={kycPolicy} />
      <div className="flex flex-1">
        <OwnerSidebar
          shops={shops}
          activeShopId={activeShopId}
          role={activeShopRole}
        />
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <VerificationGate
            key={activeShopId ?? "none"}
            status={verificationStatus}
            policy={kycPolicy}
          >
            {children}
          </VerificationGate>
        </main>
        <OwnerMobileNav
          shops={shops}
          activeShopId={activeShopId}
          role={activeShopRole}
        />
      </div>
    </div>
  );
}
