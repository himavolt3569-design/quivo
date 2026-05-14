"use client";

import { ShieldAlert, Clock, X } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

interface VerificationBannerProps {
  status: VerificationStatus;
}

export function VerificationBanner({ status }: VerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (status === "verified" || dismissed) return null;

  const configs = {
    unverified: {
      icon: <ShieldAlert className="h-4 w-4 shrink-0" />,
      bg: "bg-red-600",
      text: "YOUR SHOP IS NOT VERIFIED",
      sub: "Upload your KYC documents to unlock all features.",
      cta: "Verify now",
    },
    pending: {
      icon: <Clock className="h-4 w-4 shrink-0" />,
      bg: "bg-amber-500",
      text: "VERIFICATION PENDING",
      sub: "Our team is reviewing your documents. You'll be notified once approved.",
      cta: null,
    },
    rejected: {
      icon: <ShieldAlert className="h-4 w-4 shrink-0" />,
      bg: "bg-red-700",
      text: "VERIFICATION REJECTED",
      sub: "Your documents were not accepted. Please re-upload valid documents.",
      cta: "Re-upload",
    },
  };

  const cfg = configs[status];
  if (!cfg) return null;

  return (
    <div className={`${cfg.bg} text-white px-4 py-2.5 flex items-center gap-3 text-sm`}>
      {cfg.icon}
      <div className="flex-1 min-w-0">
        <span className="font-black tracking-wide text-xs uppercase">{cfg.text}</span>
        <span className="hidden sm:inline text-white/80 text-xs ml-2">{cfg.sub}</span>
      </div>
      {cfg.cta && (
        <Link
          href="/onboarding/owner"
          className="shrink-0 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition"
        >
          {cfg.cta}
        </Link>
      )}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded hover:bg-white/20 transition"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
