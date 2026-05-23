"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function ShopsLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header skeleton */}
      <div className="rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 shadow-sm">
        <Skeleton className="h-8 w-48 rounded-full mb-3" />
        <Skeleton className="h-4 w-72 rounded-full" />
      </div>

      {/* Section skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-4 w-32 rounded-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[1.75rem] border border-[#2E3344]/8 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28 rounded-full" />
                  <Skeleton className="h-3 w-20 rounded-full" />
                </div>
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
