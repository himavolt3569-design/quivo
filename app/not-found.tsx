import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#1E293B]/10 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8FAFC]">
          <SearchX className="h-7 w-7 text-[#3B82F6]" />
        </div>
        <h1 className="text-xl font-black text-[#0F172A]">Page not found</h1>
        <p className="mt-2 text-sm font-medium text-[#746E73]">
          The page you are looking for does not exist or is no longer available.
        </p>
        <Button
          asChild
          className="mt-6 h-11 rounded-xl bg-[#0F172A] px-6 font-bold text-white hover:bg-[#1b2333]"
        >
          <Link href="/dashboard/owner">Go to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
