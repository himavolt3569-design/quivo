export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 animate-pulse">
        <div className="h-8 w-48 rounded-full bg-[#2E3344]/8 mb-3" />
        <div className="h-4 w-72 rounded-full bg-[#2E3344]/5" />
      </div>

      {/* Section skeleton */}
      <div className="space-y-4">
        <div className="h-4 w-32 rounded-full bg-[#2E3344]/8 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[1.75rem] border border-[#2E3344]/8 bg-white p-5 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-14 w-14 rounded-2xl bg-[#2E3344]/8 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 rounded-full bg-[#2E3344]/8" />
                  <div className="h-3 w-20 rounded-full bg-[#2E3344]/5" />
                </div>
                <div className="h-6 w-14 rounded-full bg-[#2E3344]/5" />
              </div>
              <div className="h-3 w-full rounded-full bg-[#2E3344]/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
