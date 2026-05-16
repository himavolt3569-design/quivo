"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Lock, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { KycCompliancePolicy } from "@/lib/kyc-compliance";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

const EXEMPT_PATHS = [
  "/dashboard/owner/settings",
  "/onboarding/owner",
];

interface VerificationGateProps {
  status: VerificationStatus;
  policy: KycCompliancePolicy;
  children: React.ReactNode;
}

export function VerificationGate({ status, policy, children }: VerificationGateProps) {
  const pathname = usePathname();

  const isExempt = EXEMPT_PATHS.some((p) => pathname.startsWith(p));
  const isBlocked = policy.isBlocked && !isExempt;

  useEffect(() => {
    if (!isBlocked) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isBlocked]);

  if (!isBlocked) return <>{children}</>;

  const configs: Partial<Record<VerificationStatus, { title: string; sub: string; cta: string | null }>> = {
    unverified: {
      title: "Business Proof Required",
      sub: "Your 30-day grace period has ended. Upload business documents to continue using owner features.",
      cta: "Upload Documents",
    },
    pending: {
      title: "Verification Pending",
      sub: "Your documents are under review. You can continue using Quivo while our team checks them.",
      cta: null,
    },
    rejected: {
      title: "Documents Need Action",
      sub: "Your previous documents were not accepted and the grace period has ended. Please re-upload valid documents.",
      cta: "Re-upload Documents",
    },
  };
  const cfg = configs[status] ?? { title: "Documents Required", sub: "Your shop needs business proof.", cta: "Verify Now" };

  return (
    <>
      {/* Render children but not interactive */}
      <div className="pointer-events-none select-none opacity-20 blur-[2px]" aria-hidden="true">
        {children}
      </div>

      {/* Fixed fullscreen overlay — sits above sidebar and everything */}
      <div className="fixed inset-0 z-200 flex items-start justify-center pt-24 px-4 bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-4xl border border-[#2E3344]/10 shadow-2xl p-8 max-w-sm w-full text-center animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
            status === "pending" ? "bg-amber-50" : "bg-red-50"
          }`}>
            {status === "pending"
              ? <Lock className="h-8 w-8 text-amber-500" />
              : <ShieldAlert className="h-8 w-8 text-red-500" />}
          </div>
          <h2 className="font-black text-2xl text-[#27324A] mb-3">{cfg.title}</h2>
          <p className="text-sm text-[#746E73] mb-7 leading-relaxed">{cfg.sub}</p>

          {cfg.cta ? (
            <Link
              href="/dashboard/owner/settings/kyc"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-[#27324A] text-white rounded-2xl font-bold text-sm hover:bg-[#1b2333] transition"
            >
              {cfg.cta}
            </Link>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 py-3 bg-amber-50 rounded-2xl">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm font-bold text-amber-700">Review in progress</span>
              </div>
              <p className="text-xs text-[#746E73]">
                View status in{" "}
                <Link href="/dashboard/owner/settings/kyc" className="text-[#A7653A] font-bold hover:underline">
                  KYC Settings
                </Link>.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
