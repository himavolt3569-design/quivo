"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* ── Profile Header Skeleton ────────────────────────────────── */}
      <div className="relative rounded-[2.5rem] overflow-hidden bg-white border border-[#2E3344]/8 shadow-sm">
        {/* Cover Banner Skeleton */}
        <div className="h-24 sm:h-32 w-full bg-[#E8E3D1]/50 relative" />
        
        {/* User Info Strip Skeleton */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-[#F7F0E6]/80 shadow-md" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32 rounded-lg bg-[#F7F0E6]/50" />
              <Skeleton className="h-3 w-48 rounded bg-[#F7F0E6]/30" />
            </div>
          </div>
          <div className="flex gap-3">
             <Skeleton className="h-8 w-24 rounded-full bg-[#F7F0E6]/40" />
             <Skeleton className="h-8 w-16 rounded-full bg-[#F7F0E6]/40" />
          </div>
        </div>
      </div>

      {/* ── Main Layout Grid Skeleton ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column Skeleton */}
        <div className="space-y-6">
           {/* Community Bento */}
           <div className="h-48 rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 flex flex-col justify-between">
              <div className="flex justify-between">
                 <Skeleton className="h-3 w-20 rounded bg-[#F7F0E6]/30" />
                 <Skeleton className="h-8 w-8 rounded-xl bg-[#F7F0E6]/40" />
              </div>
              <div className="space-y-2">
                 <Skeleton className="h-10 w-12 rounded-xl bg-[#F7F0E6]/50" />
                 <Skeleton className="h-4 w-24 rounded-lg bg-[#F7F0E6]/30" />
              </div>
           </div>

           {/* Settings Bento */}
           <div className="h-56 rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 space-y-6">
              <Skeleton className="h-4 w-24 rounded bg-[#F7F0E6]/30" />
              <Skeleton className="h-12 w-full rounded-2xl bg-[#F7F0E6]/40" />
              <Skeleton className="h-3 w-3/4 rounded bg-[#F7F0E6]/20" />
           </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="space-y-6">
           {/* Notifications card */}
           <div className="h-64 rounded-[2.5rem] bg-[#27324A] p-8 flex flex-col justify-between">
              <div className="space-y-3">
                 <Skeleton className="h-3 w-24 rounded bg-white/10" />
                 <Skeleton className="h-6 w-40 rounded bg-white/20" />
              </div>
              <div className="space-y-3">
                 <Skeleton className="h-8 w-full rounded-xl bg-white/5" />
                 <Skeleton className="h-8 w-full rounded-xl bg-white/5" />
              </div>
           </div>
           
           {/* Security card */}
           <div className="h-48 rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 space-y-4">
              <Skeleton className="h-4 w-20 rounded bg-[#F7F0E6]/30" />
              <Skeleton className="h-12 w-full rounded-xl bg-[#F7F0E6]/40" />
           </div>
        </div>
      </div>
    </div>
  );
}
