"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pt-6 px-4 sm:px-6">
      {/* ── Dashboard Bento Header Skeleton ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Welcome Card Skeleton */}
        <div className="md:col-span-8 h-[240px] rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
             <Skeleton className="h-10 w-48 rounded-xl" />
             <Skeleton className="h-4 w-64 rounded-lg" />
          </div>
          <div className="flex gap-3">
             <Skeleton className="h-14 w-32 rounded-2xl" />
             <Skeleton className="h-14 w-32 rounded-2xl" />
          </div>
        </div>

        {/* Wallet Section Skeleton */}
        <div className="md:col-span-4 h-[240px] rounded-[2.5rem] bg-[#27324A] p-7 shadow-xl flex flex-col justify-between overflow-hidden relative">
           <Skeleton className="h-10 w-10 rounded-xl border-none" />
           <div className="space-y-3">
              <Skeleton className="h-4 w-20 rounded-lg border-none" />
              <Skeleton className="h-10 w-32 rounded-xl border-none" />
           </div>
           <Skeleton className="h-12 w-full rounded-full border-none" />
        </div>
      </div>

      {/* ── Predictive Reorder Carousel Skeleton ─────────────────────── */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center justify-between px-2">
           <Skeleton className="h-4 w-40 rounded-lg" />
           <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {[1, 2, 3, 4].map((i) => (
             <div key={i} className="h-[200px] rounded-[2rem] bg-white border border-[#2E3344]/8 p-4 flex flex-col gap-3">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-4 w-3/4 rounded-lg" />
                <Skeleton className="h-8 w-full rounded-full" />
             </div>
           ))}
        </div>
      </div>
      
      {/* ── Stats Grid Skeleton ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-6">
         {[1, 2, 3].map((i) => (
           <div key={i} className="h-32 rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-6 flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="space-y-2">
                 <Skeleton className="h-3 w-16 rounded-md" />
                 <Skeleton className="h-6 w-12 rounded-md" />
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}
