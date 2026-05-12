"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function SavedLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* ── Saved Header Skeleton ──────────────────────────────────── */}
      <div className="h-[180px] rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 shadow-sm flex flex-col justify-between overflow-hidden">
        <div className="space-y-3">
          <Skeleton className="h-10 w-48 rounded-xl bg-[#F7F0E6]/50" />
          <Skeleton className="h-4 w-64 rounded-lg bg-[#F7F0E6]/30" />
        </div>
        <div className="flex gap-4">
           <Skeleton className="h-10 w-32 rounded-2xl bg-[#F7F0E6]/40" />
           <Skeleton className="h-10 w-32 rounded-2xl bg-[#F7F0E6]/40" />
        </div>
      </div>

      {/* Toggle Tab Skeleton */}
      <div className="flex gap-1.5 p-1 bg-[#E8E3D1]/40 rounded-3xl w-fit">
         <Skeleton className="h-9 w-24 rounded-full bg-white/80" />
         <Skeleton className="h-9 w-24 rounded-full bg-transparent" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-[220px] rounded-[2rem] bg-white border border-[#2E3344]/8 p-4 flex flex-col gap-4 shadow-sm">
             <Skeleton className="h-32 w-full rounded-2xl bg-[#F7F0E6]/50" />
             <div className="space-y-2">
                <Skeleton className="h-4 w-full rounded-lg bg-[#F7F0E6]/40" />
                <Skeleton className="h-3 w-1/2 rounded-lg bg-[#F7F0E6]/30" />
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
