type PageLoadingSkeletonVariant =
  | "default"
  | "dashboard"
  | "owner"
  | "storefront"
  | "marketing";

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

function DashboardSkeleton() {
  return (
    <div className="container px-4 pb-28 pt-8 sm:px-6 sm:pb-10 lg:pt-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="grid gap-5 md:grid-cols-12">
          <div className="rounded-[2rem] border border-[#2E3344]/8 bg-white p-6 md:col-span-8">
            <Block className="h-9 w-48" />
            <Block className="mt-4 h-4 w-72 max-w-full" />
            <div className="mt-10 flex gap-3">
              <Block className="h-12 w-32" />
              <Block className="h-12 w-28" />
            </div>
          </div>
          <div className="rounded-[2rem] bg-[#27324A] p-6 md:col-span-4">
            <Block className="h-12 w-12 bg-white/10" />
            <Block className="mt-16 h-5 w-24 bg-white/10" />
            <Block className="mt-3 h-10 w-36 bg-white/15" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[1.75rem] border border-[#2E3344]/8 bg-white p-5"
            >
              <Block className="h-12 w-12" />
              <Block className="mt-5 h-4 w-32" />
              <Block className="mt-3 h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OwnerSkeleton() {
  return (
    <main className="flex-1 p-4 pb-24 sm:p-6 lg:p-8">
      <div className="space-y-6">
        <div className="rounded-[1.75rem] border border-[#2E3344]/8 bg-white p-6">
          <Block className="h-9 w-56" />
          <Block className="mt-4 h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[1.5rem] border border-[#2E3344]/8 bg-white p-5"
            >
              <Block className="h-10 w-10" />
              <Block className="mt-8 h-7 w-24" />
              <Block className="mt-3 h-3 w-28" />
            </div>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-[#2E3344]/8 bg-white p-5">
            <Block className="h-5 w-40" />
            <Block className="mt-6 h-64 w-full" />
          </div>
          <div className="rounded-[1.75rem] border border-[#2E3344]/8 bg-white p-5">
            <Block className="h-5 w-36" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Block key={index} className="h-14 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7F0E6] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] border border-[#2E3344]/8 bg-white p-6">
          <Block className="h-16 w-16" />
          <Block className="mt-6 h-10 w-72 max-w-full" />
          <Block className="mt-4 h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[1.5rem] border border-[#2E3344]/8 bg-white p-4"
            >
              <Block className="aspect-[4/3] w-full" />
              <Block className="mt-4 h-4 w-4/5" />
              <Block className="mt-3 h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketingSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7F0E6]">
      <div className="container py-8 sm:py-10">
        <div className="mb-10 flex items-center justify-between">
          <Block className="h-10 w-32" />
          <Block className="hidden h-10 w-56 sm:block" />
        </div>
        <div className="grid min-h-[70vh] items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <Block className="h-6 w-36" />
            <Block className="mt-6 h-16 w-full max-w-xl" />
            <Block className="mt-4 h-16 w-4/5 max-w-lg" />
            <Block className="mt-8 h-5 w-full max-w-lg" />
            <Block className="mt-3 h-5 w-4/5 max-w-md" />
            <div className="mt-8 flex gap-3">
              <Block className="h-14 w-36" />
              <Block className="h-14 w-36" />
            </div>
          </div>
          <div className="rounded-[2rem] border border-[#2E3344]/8 bg-white p-4">
            <Block className="aspect-[4/3] w-full" />
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

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Block className="h-10 w-56" />
        <Block className="h-5 w-80 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Block key={index} className="h-40 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
