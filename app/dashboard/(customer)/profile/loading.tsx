"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500 pt-6 px-4 sm:px-6">
      {/* ── Profile Header Skeleton ────────────────────────────────── */}
      <div className="relative rounded-[2.5rem] overflow-hidden bg-white border border-[#2E3344]/8 shadow-sm">
        {/* Cover Banner Skeleton */}
        <Skeleton className="h-24 sm:h-32 w-full rounded-none" />
        
        {/* User Info Strip Skeleton */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl shadow-sm" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-3 w-48 rounded-md" />
            </div>
          </div>
          <div className="flex gap-3">
             <Skeleton className="h-8 w-24 rounded-full" />
             <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
      </div>

      {/* ── Main Layout Grid Skeleton ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Left Column Skeleton */}
        <div className="space-y-6">
           {/* Community Bento */}
           <div className="h-48 rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 flex flex-col justify-between shadow-sm">
              <div className="flex justify-between">
                 <Skeleton className="h-3 w-20 rounded-md" />
                 <Skeleton className="h-8 w-8 rounded-xl" />
              </div>
              <div className="space-y-2">
                 <Skeleton className="h-10 w-12 rounded-xl" />
                 <Skeleton className="h-4 w-24 rounded-lg" />
              </div>
           </div>

           {/* Settings Bento */}
           <div className="h-56 rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 space-y-6 shadow-sm">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-3 w-3/4 rounded-md" />
           </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="space-y-6">
           {/* Notifications card */}
           <div className="h-64 rounded-[2.5rem] bg-[#27324A] p-8 flex flex-col justify-between shadow-xl">
              <div className="space-y-3">
                 <Skeleton className="h-3 w-24 rounded-md border-none" />
                 <Skeleton className="h-6 w-40 rounded-md border-none" />
              </div>
              <div className="space-y-3">
                 <Skeleton className="h-8 w-full rounded-xl border-none" />
                 <Skeleton className="h-8 w-full rounded-xl border-none" />
              </div>
           </div>
           
           {/* Security card */}
           <div className="h-48 rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 space-y-4 shadow-sm">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-12 w-full rounded-xl" />
           </div>
        </div>
      </div>
    </div>
  );
}
