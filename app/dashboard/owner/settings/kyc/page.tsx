import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { KYCForm } from "@/components/dashboard/owner/kyc/KYCForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  getKycCompliancePolicy,
  type VerificationStatus,
} from "@/lib/kyc-compliance";

export default async function KYCPage() {
  const ctx = await getOwnerContext();
  const shop = ctx.activeShop ?? null;

  if (!shop) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-lg font-bold text-[#27324A]">No shop selected.</p>
        <Link
          href="/onboarding/owner"
          className="text-sm text-[#A7653A] hover:underline font-bold"
        >
          Create your first shop →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: shopData } = await supabase
    .from("shops")
    .select(
      "verification_status, created_at, kyc_submitted_at, kyc_rejection_reason, kyc_document_urls, kyc_confidence, name",
    )
    .eq("id", shop.id)
    .single();

  const verificationStatus = (shopData?.verification_status ??
    "unverified") as VerificationStatus;
  const policy = getKycCompliancePolicy({
    verificationStatus,
    createdAt: shopData?.created_at ?? new Date().toISOString(),
    kycSubmittedAt: shopData?.kyc_submitted_at ?? null,
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard/owner/settings"
          className="h-9 w-9 rounded-xl border border-[#2E3344]/10 flex items-center justify-center hover:bg-[#f8f8f7] transition"
        >
          <ChevronLeft className="h-4 w-4 text-[#746E73]" />
        </Link>
        <div>
          <h1 className="font-black text-2xl text-[#27324A]">
            KYC Verification
          </h1>
          <p className="text-sm text-[#746E73]">
            Submit your business documents for review
          </p>
        </div>
      </div>

      <KYCForm
        shopId={shop.id}
        shopName={shopData?.name ?? shop.name}
        verificationStatus={verificationStatus}
        graceEndsAt={policy.graceEndsAt}
        daysRemaining={policy.daysRemaining}
        isBlocked={policy.isBlocked}
        kycSubmittedAt={shopData?.kyc_submitted_at ?? null}
        kycRejectionReason={shopData?.kyc_rejection_reason ?? null}
        kycDocumentUrls={(shopData?.kyc_document_urls as string[]) ?? []}
        kycConfidence={shopData?.kyc_confidence ?? null}
      />
    </div>
  );
}
