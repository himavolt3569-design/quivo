"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function SavedLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500 pt-6 px-4 sm:px-6">
      {/* ── Saved Header Skeleton ──────────────────────────────────── */}
      <div className="h-[180px] rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 shadow-sm flex flex-col justify-between overflow-hidden">
        <div className="space-y-3">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>
        <div className="flex gap-4">
           <Skeleton className="h-10 w-32 rounded-2xl" />
           <Skeleton className="h-10 w-32 rounded-2xl" />
        </div>
      </div>

      {/* Toggle Tab Skeleton */}
      <div className="flex gap-1.5 p-1 bg-white border border-[#2E3344]/8 rounded-3xl w-fit mt-6 shadow-sm">
         <Skeleton className="h-9 w-24 rounded-full" />
         <Skeleton className="h-9 w-24 rounded-full bg-transparent border-none" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-[220px] rounded-[2rem] bg-white border border-[#2E3344]/8 p-4 flex flex-col gap-4 shadow-sm">
             <Skeleton className="h-32 w-full rounded-2xl" />
             <div className="space-y-2">
                <Skeleton className="h-4 w-full rounded-lg" />
                <Skeleton className="h-3 w-1/2 rounded-lg" />
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
