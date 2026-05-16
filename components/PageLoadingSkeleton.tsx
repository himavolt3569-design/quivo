import { Skeleton } from "@/components/ui/skeleton";

type PageLoadingSkeletonVariant =
  | "default"
  | "dashboard"
  | "owner"
  | "storefront"
  | "marketing"
  | "inner";

interface PageLoadingSkeletonProps {
  variant?: PageLoadingSkeletonVariant;
}

function Block({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`soft-skeleton rounded-[1.15rem] ${className}`}
    />
  );
}

function InnerPageSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both pb-10 pt-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm">
        <div className="space-y-3 w-full max-w-sm">
          <Block className="h-8 w-40 rounded-xl" />
          <Block className="h-4 w-64 rounded-lg" />
        </div>
        <div className="flex gap-3 self-start sm:self-auto">
          <Block className="h-10 w-24 rounded-xl" />
          <Block className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Tools / Filters */}
      <div className="flex items-center gap-3">
        <Block className="h-10 w-full max-w-sm rounded-xl" />
        <Block className="h-10 w-24 rounded-xl hidden sm:block" />
        <Block className="h-10 w-24 rounded-xl hidden sm:block" />
      </div>

      {/* List / Table Area */}
      <div className="bg-white border border-[#2E3344]/8 rounded-[2rem] shadow-sm overflow-hidden p-6 space-y-4">
        {/* Table Header mock */}
        <div className="flex justify-between items-center pb-4 border-b border-[#2E3344]/5">
           <Block className="h-4 w-24 rounded-md" />
           <Block className="h-4 w-32 rounded-md hidden sm:block" />
           <Block className="h-4 w-20 rounded-md hidden sm:block" />
           <Block className="h-4 w-16 rounded-md" />
        </div>
        {/* Rows */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex justify-between items-center py-3">
            <div className="flex items-center gap-4">
               <Block className="h-10 w-10 rounded-full" />
               <div className="space-y-2">
                 <Block className="h-4 w-32 rounded-md" />
                 <Block className="h-3 w-20 rounded-md" />
               </div>
            </div>
            <Block className="h-4 w-24 rounded-md hidden sm:block" />
            <Block className="h-4 w-16 rounded-md hidden sm:block" />
            <Block className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pt-6 px-4 sm:px-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-8 h-[240px] rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <Block className="h-10 w-48 rounded-xl" />
            <Block className="h-4 w-64 rounded-lg" />
          </div>
          <div className="flex gap-3">
            <Block className="h-14 w-32 rounded-2xl" />
            <Block className="h-14 w-32 rounded-2xl" />
          </div>
        </div>

        <div className="md:col-span-4 h-[240px] rounded-[2.5rem] bg-[#27324A] p-7 shadow-xl flex flex-col justify-between overflow-hidden relative">
          <Block className="h-10 w-10 rounded-xl bg-white/10 border-none" />
          <div className="space-y-3">
            <Block className="h-4 w-20 rounded-lg bg-white/10 border-none" />
            <Block className="h-10 w-32 rounded-xl bg-white/15 border-none" />
          </div>
          <Block className="h-12 w-full rounded-full bg-white/5 border-none" />
        </div>
      </div>

      <div className="space-y-4 mt-8">
        <div className="flex items-center justify-between px-2">
          <Block className="h-4 w-40 rounded-lg" />
          <Block className="h-8 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[200px] rounded-[2rem] bg-white border border-[#2E3344]/8 p-4 flex flex-col gap-3">
              <Block className="h-24 w-full rounded-2xl" />
              <Block className="h-4 w-3/4 rounded-lg" />
              <Block className="h-8 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OwnerSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both pb-10 pt-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm">
        <div className="space-y-3 w-full max-w-md">
          <Block className="h-10 w-48 rounded-xl" />
          <Block className="h-4 w-72 max-w-full rounded-lg" />
        </div>
        <Block className="h-8 w-28 rounded-xl self-start sm:self-auto" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-5 rounded-[1.5rem] bg-white border border-[#2E3344]/8 shadow-sm flex flex-col justify-between h-32">
            <Block className="h-10 w-10 rounded-xl" />
            <div className="mt-4 space-y-2">
              <Block className="h-6 w-24 rounded-md" />
              <Block className="h-3 w-16 rounded-sm" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <Block className="h-3 w-32 mb-4 rounded-md ml-2" />
        <div className="flex overflow-hidden gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Block key={i} className="h-20 w-[90px] sm:flex-1 rounded-2xl shrink-0" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm h-[360px]">
            <div className="flex justify-between mb-8">
              <div className="space-y-2">
                <Block className="h-6 w-40 rounded-lg" />
                <Block className="h-3 w-32 rounded-md" />
              </div>
              <Block className="h-4 w-20 rounded-md" />
            </div>
            <Block className="h-[220px] w-full rounded-xl" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm h-[320px]">
              <div className="flex gap-3 mb-6">
                <Block className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Block className="h-5 w-32 rounded-md" />
                  <Block className="h-3 w-20 rounded-sm" />
                </div>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Block key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            </div>
            <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm h-[320px]">
              <div className="flex gap-3 mb-6">
                <Block className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Block className="h-5 w-32 rounded-md" />
                  <Block className="h-3 w-20 rounded-sm" />
                </div>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Block key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <div className="rounded-[2rem] bg-white border border-[#2E3344]/8 p-6 h-[360px]">
            <div className="flex justify-between mb-6">
              <Block className="h-4 w-32 rounded-md" />
              <Block className="h-6 w-6 rounded-full" />
            </div>
            <div className="space-y-3">
              {[1, 2].map((i) => <Block key={i} className="h-28 w-full rounded-[1.25rem]" />)}
            </div>
          </div>
          
          <div className="rounded-[2rem] bg-[#27324A] p-6 h-48 shadow-xl flex flex-col justify-between">
            <Block className="h-4 w-28 rounded-md bg-white/10 border-none" />
            <Block className="h-10 w-40 rounded-xl bg-white/10 border-none" />
            <Block className="h-12 w-full rounded-xl bg-white/5 border-none mt-4" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function StorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7F0E6] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8 animate-in fade-in duration-700">
        <div className="rounded-[2.5rem] border border-[#2E3344]/8 bg-white p-8 md:p-12 shadow-sm text-center flex flex-col items-center">
          <Block className="h-20 w-20 rounded-2xl mb-6" />
          <Block className="h-12 w-80 max-w-full rounded-xl" />
          <Block className="mt-4 h-5 w-96 max-w-full rounded-lg" />
          <div className="mt-8 flex justify-center gap-3">
            <Block className="h-10 w-24 rounded-full" />
            <Block className="h-10 w-24 rounded-full" />
            <Block className="h-10 w-24 rounded-full" />
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mt-8">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-[2rem] border border-[#2E3344]/8 bg-white p-4 shadow-sm flex flex-col">
              <Block className="aspect-[4/5] w-full rounded-[1.5rem]" />
              <div className="pt-4 space-y-3 flex-1 flex flex-col">
                <Block className="h-5 w-4/5 rounded-md" />
                <Block className="h-4 w-1/2 rounded-md" />
                <div className="mt-auto pt-4 flex justify-between items-end">
                  <Block className="h-6 w-20 rounded-md" />
                  <Block className="h-10 w-10 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketingSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7F0E6] animate-in fade-in duration-700">
      <div className="container py-8 sm:py-10">
        <div className="mb-16 flex items-center justify-between">
          <Block className="h-10 w-32 rounded-lg" />
          <Block className="hidden h-10 w-64 rounded-full sm:block" />
        </div>
        <div className="grid min-h-[70vh] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Block className="h-8 w-40 rounded-full" />
            <Block className="h-20 w-full max-w-xl rounded-2xl" />
            <Block className="h-20 w-4/5 max-w-lg rounded-2xl" />
            <Block className="mt-6 h-6 w-full max-w-lg rounded-lg" />
            <Block className="h-6 w-4/5 max-w-md rounded-lg" />
            <div className="mt-10 flex gap-4">
              <Block className="h-14 w-40 rounded-full" />
              <Block className="h-14 w-40 rounded-full" />
            </div>
          </div>
          <div className="relative">
            <Block className="aspect-[4/3] w-full rounded-[3rem] shadow-2xl" />
            <Block className="absolute -bottom-10 -left-10 h-40 w-64 rounded-[2rem] shadow-xl" />
            <Block className="absolute -top-10 -right-10 h-32 w-56 rounded-[2rem] shadow-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageLoadingSkeleton({
  variant = "default",
}: PageLoadingSkeletonProps) {
  if (variant === "dashboard") return <DashboardSkeleton />;
  if (variant === "owner") return <OwnerSkeleton />;
  if (variant === "storefront") return <StorefrontSkeleton />;
  if (variant === "marketing") return <MarketingSkeleton />;
  if (variant === "inner") return <InnerPageSkeleton />;

  return (
    <div className="min-h-screen bg-background px-4 py-8 animate-in fade-in duration-500">
      <div className="mx-auto max-w-4xl space-y-6">
        <Block className="h-10 w-56 rounded-xl" />
        <Block className="h-5 w-80 max-w-full rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2 mt-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <Block key={index} className="h-48 w-full rounded-[2rem]" />
          ))}
        </div>
      </div>
    </div>
  );
}
