"use client";

import { useState } from "react";
import { applyForWholesale } from "@/app/actions/wholesale";
import { toast } from "sonner";
import { Store, Loader2 } from "lucide-react";

interface Props {
  wholesalerShopId: string;
  retailerShopId: string;
  status: string | null;
}

export function WholesaleBanner({ wholesalerShopId, retailerShopId, status }: Props) {
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  const handleApply = async () => {
    setLoading(true);
    const res = await applyForWholesale(wholesalerShopId, retailerShopId);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Application submitted successfully!");
      setCurrentStatus("pending");
    }
    setLoading(false);
  };

  if (currentStatus === "approved") {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#F7F0E6] border-t border-[#A7653A]/20 p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-screen-md mx-auto flex items-center justify-center gap-3">
          <Store className="h-5 w-5 text-[#A7653A]" />
          <p className="text-sm font-bold text-[#A7653A]">
            Wholesale pricing active. You are viewing special discounted prices.
          </p>
        </div>
      </div>
    );
  }

  if (currentStatus === "pending") {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#f8f8f7] border-t border-[#2E3344]/10 p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-screen-md mx-auto flex items-center justify-center gap-3 text-[#746E73]">
          <Loader2 className="h-4 w-4 hidden" />
          <p className="text-sm font-medium">Your wholesale application is pending approval.</p>
        </div>
      </div>
    );
  }

  if (currentStatus === "rejected") {
    return null; // Or show a rejected message, but hiding is probably better
  }

  // Not applied yet
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#2E3344]/10 p-4 pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
      <div className="max-w-screen-md mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-[#27324A] text-sm flex items-center gap-2">
            <Store className="h-4 w-4 text-[#A7653A]" /> Wholesale Partner Program
          </h3>
          <p className="text-xs text-[#746E73] mt-0.5">
            Apply to become a wholesale partner to access bulk discounts and special pricing.
          </p>
        </div>
        <button
          onClick={handleApply}
          disabled={loading}
          className="w-full sm:w-auto shrink-0 bg-[#27324A] hover:bg-[#1f293b] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 hidden" />}
          Apply for Wholesale
        </button>
      </div>
    </div>
  );
}
