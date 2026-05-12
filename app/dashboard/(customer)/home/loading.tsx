"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      {/* ── Dashboard Bento Header Skeleton ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Welcome Card Skeleton */}
        <div className="md:col-span-8 h-[240px] rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
             <Skeleton className="h-10 w-48 rounded-xl bg-[#F7F0E6]/50" />
             <Skeleton className="h-4 w-64 rounded-lg bg-[#F7F0E6]/30" />
          </div>
          <div className="flex gap-3">
             <Skeleton className="h-14 w-32 rounded-2xl bg-[#F7F0E6]/40" />
             <Skeleton className="h-14 w-32 rounded-2xl bg-[#F7F0E6]/40" />
          </div>
        </div>

        {/* Wallet Section Skeleton */}
        <div className="md:col-span-4 h-[240px] rounded-[2.5rem] bg-[#27324A] p-7 shadow-xl flex flex-col justify-between overflow-hidden relative">
           <Skeleton className="h-10 w-10 rounded-xl bg-white/10" />
           <div className="space-y-3">
              <Skeleton className="h-4 w-20 rounded-lg bg-white/10" />
              <Skeleton className="h-10 w-32 rounded-xl bg-white/15" />
           </div>
           <Skeleton className="h-12 w-full rounded-full bg-white/5" />
        </div>
      </div>

      {/* ── Predictive Reorder Carousel Skeleton ─────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <Skeleton className="h-4 w-40 rounded-lg bg-[#2E3344]/10" />
           <Skeleton className="h-8 w-24 rounded-full bg-[#E8E3D1]/40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {[1, 2, 3, 4].map((i) => (
             <div key={i} className="h-[200px] rounded-[2rem] bg-white border border-[#2E3344]/8 p-4 flex flex-col gap-3">
                <Skeleton className="h-24 w-full rounded-2xl bg-[#F7F0E6]/40" />
                <Skeleton className="h-4 w-3/4 rounded-lg bg-[#F7F0E6]/30" />
                <Skeleton className="h-8 w-full rounded-full bg-[#F7F0E6]/20" />
             </div>
           ))}
        </div>
      </div>
      
      {/* ── Stats Grid Skeleton ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
         {[1, 2, 3].map((i) => (
           <div key={i} className="h-32 rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-6 flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-2xl bg-[#F7F0E6]/50" />
              <div className="space-y-2">
                 <Skeleton className="h-3 w-16 rounded bg-[#F7F0E6]/30" />
                 <Skeleton className="h-6 w-12 rounded bg-[#F7F0E6]/50" />
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}
