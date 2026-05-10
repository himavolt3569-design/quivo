"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* ── Orders Bento Header Skeleton ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Main Stats Card Skeleton */}
        <div className="md:col-span-8 h-[240px] rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <Skeleton className="h-10 w-48 rounded-xl bg-[#F7F0E6]/50" />
            <Skeleton className="h-4 w-64 rounded-lg bg-[#F7F0E6]/30" />
          </div>
          <div className="mt-8 flex gap-3">
             <Skeleton className="h-12 w-28 rounded-2xl bg-[#F7F0E6]/40" />
             <Skeleton className="h-12 w-28 rounded-2xl bg-[#F7F0E6]/40" />
             <Skeleton className="h-12 w-28 rounded-2xl bg-[#F7F0E6]/40" />
          </div>
        </div>

        {/* Scan & Order Bento Skeleton */}
        <div className="md:col-span-4 h-[240px] rounded-[2.5rem] bg-[#27324A] p-7 shadow-xl flex flex-col justify-between">
           <Skeleton className="h-12 w-12 rounded-2xl bg-white/10" />
           <div className="space-y-3">
              <Skeleton className="h-6 w-32 rounded-lg bg-white/10" />
              <Skeleton className="h-3 w-40 rounded-lg bg-white/5" />
           </div>
           <Skeleton className="h-12 w-full rounded-full bg-white/10" />
        </div>
      </div>

      {/* Filter pills Skeleton */}
      <div className="flex gap-2 p-1 bg-[#E8E3D1]/40 rounded-3xl w-fit">
         {[1, 2, 3, 4, 5].map((i) => (
           <Skeleton key={i} className="h-8 w-20 rounded-full bg-white/60" />
         ))}
      </div>

      {/* Orders List Skeleton */}
      <div className="space-y-4 mt-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-[2rem] bg-white border border-[#2E3344]/8 p-5 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl bg-[#F7F0E6]/50" />
                <div className="space-y-2">
                   <Skeleton className="h-4 w-32 rounded-lg bg-[#F7F0E6]/40" />
                   <Skeleton className="h-3 w-24 rounded-lg bg-[#F7F0E6]/30" />
                </div>
             </div>
             <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-24 rounded-full bg-[#F7F0E6]/50" />
                <Skeleton className="h-10 w-10 rounded-full bg-[#F7F0E6]/30" />
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
