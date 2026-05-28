"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, MessageSquare, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import type { OwnerReviewRow } from "@/app/actions/reviews";
import { moderateReview } from "@/app/actions/reviews";
import { StarRating } from "@/components/ui/StarRating";

interface Props {
  shopName: string;
  rows: OwnerReviewRow[];
  initialError: string | null;
}

type Filter = "all" | "published" | "hidden";

export function ReviewModerationList({ shopName, rows, initialError }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [localRows, setLocalRows] = useState<OwnerReviewRow[]>(rows);
  const [isPending, startTransition] = useTransition();

  const visible = localRows.filter((r) => filter === "all" || r.status === filter);

  const apply = (id: string, action: "publish" | "hide") => {
    startTransition(async () => {
      const res = await moderateReview(id, action);
      if (res.error) { toast.error(res.error); return; }
      setLocalRows((cur) =>
        cur.map((r) => (r.id === id ? { ...r, status: action === "publish" ? "published" : "hidden" } : r))
      );
      toast.success(action === "publish" ? "Published" : "Hidden");
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <Link href="/dashboard/owner/customers" className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2">
          <ChevronLeft className="h-3 w-3" /> Back to Customers
        </Link>
        <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-[#A7653A]" /> Reviews
        </h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">
          Moderate reviews for {shopName}. New reviews publish immediately; you can hide any that violate policy.
        </p>
      </div>

      <div className="flex rounded-xl border border-[#2E3344]/15 overflow-hidden h-10 w-fit">
        {(["all", "published", "hidden"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 text-xs font-bold capitalize ${filter === f ? "bg-[#27324A] text-white" : "bg-white text-[#27324A]"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {initialError && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-xs font-bold inline-flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" /> {initialError}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#2E3344]/10 p-8 text-center text-sm font-bold text-[#746E73]">
          No reviews yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white border border-[#2E3344]/10 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#27324A] truncate">{r.product_name ?? "Product"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRating value={r.rating} size="sm" />
                    <span className="text-[10px] text-[#746E73]">{new Date(r.created_at).toLocaleDateString()}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.status === "published" ? "bg-green-50 text-green-700" :
                      r.status === "hidden"    ? "bg-red-50 text-red-700" :
                                                 "bg-amber-50 text-amber-700"
                    }`}>{r.status}</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {r.status !== "published" && (
                    <button
                      onClick={() => apply(r.id, "publish")}
                      disabled={isPending}
                      className="h-8 px-3 rounded-xl bg-[#27324A] text-white text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40"
                    >
                      <Eye className="h-3 w-3" /> Publish
                    </button>
                  )}
                  {r.status !== "hidden" && (
                    <button
                      onClick={() => apply(r.id, "hide")}
                      disabled={isPending}
                      className="h-8 px-3 rounded-xl bg-white border border-red-200 text-red-700 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40"
                    >
                      <EyeOff className="h-3 w-3" /> Hide
                    </button>
                  )}
                </div>
              </div>
              {r.body && (
                <p className="text-sm text-[#27324A] leading-relaxed rounded-xl bg-[#F7F0E6] px-3 py-2">{r.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
