"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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

        {/* Wallet Card Skeleton - Premium split layout */}
        <div className="md:col-span-4 rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm bg-white overflow-hidden flex flex-col justify-between h-[240px]">
          {/* Dark Blue Header Banner */}
          <div className="bg-[#27324A] p-5 flex flex-col justify-between flex-1">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-24 rounded-md bg-white/15 border-none animate-pulse" />
                <Skeleton className="h-7 w-36 rounded-lg bg-white/20 border-none animate-pulse" />
              </div>
              <Skeleton className="h-10 w-10 rounded-2xl bg-white/10 border-none shrink-0" />
            </div>
            {/* Coins badge */}
            <Skeleton className="h-7 w-40 rounded-xl bg-white/10 border-none mt-2 shrink-0 animate-pulse" />
          </div>
          {/* Earn tips row */}
          <div className="border-b border-[#2E3344]/8 bg-[#F7F0E6]/50 px-5 py-3 flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <Skeleton className="h-3 w-5/6 rounded-md" />
          </div>
          {/* Recent list row */}
          <div className="px-5 py-3 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-2.5 w-16 rounded-sm" />
            </div>
            <Skeleton className="h-3 w-12 rounded-md shrink-0" />
          </div>
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
