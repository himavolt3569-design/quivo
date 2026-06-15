import Link from "next/link";
import { WifiOff, RotateCcw } from "lucide-react";

export const metadata = { title: "Offline — Quivo" };

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7F0E6] p-6">
      <div className="bg-white max-w-md w-full rounded-3xl border border-[#2E3344]/10 shadow-sm p-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-[#27324A]/10 text-[#27324A] flex items-center justify-center mx-auto mb-4">
          <WifiOff className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-black text-[#27324A]">
          You&apos;re offline
        </h1>
        <p className="text-sm text-[#746E73] mt-2">
          Quivo can&apos;t reach the server right now. POS sales rung up while
          offline are queued and replay automatically when the connection comes
          back.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-[#2E3344]/10 font-bold text-[#27324A] hover:bg-[#f8f8f7] flex-1"
          >
            <RotateCcw className="h-4 w-4" /> Try again
          </Link>
          <Link
            href="/dashboard/owner/pos"
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#27324A] text-white font-bold hover:bg-[#1b2333] flex-1"
          >
            Open POS
          </Link>
        </div>
        <p className="text-[11px] text-[#a4a09a] mt-6">
          If the issue persists, your network may be blocking quivo.app. Check
          your wifi / mobile data.
        </p>
      </div>
    </main>
  );
}
