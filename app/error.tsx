"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F0E6] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#2E3344]/10 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <AlertTriangle className="h-7 w-7 text-red-600" />
        </div>
        <h1 className="text-xl font-black text-[#27324A]">Something went wrong</h1>
        <p className="mt-2 text-sm font-medium text-[#746E73]">
          The page could not finish loading. Try again, or return to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-xl bg-[#f8f8f7] px-3 py-2 font-mono text-[11px] text-[#746E73]">
            {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => unstable_retry()}
            className="h-11 flex-1 rounded-xl bg-[#27324A] font-bold text-white hover:bg-[#1b2333]"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Retry
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 flex-1 rounded-xl border-[#2E3344]/10 font-bold text-[#27324A]"
          >
            <Link href="/dashboard/owner">Dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
