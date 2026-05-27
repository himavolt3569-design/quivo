"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, Bookmark, User, Barcode, Store } from "lucide-react";
import { BarcodeScanner } from "./customer/BarcodeScanner";

// Desktop shows all 5 tabs; mobile bottom nav keeps the existing 4-tab layout
// (Shops accessible via HomeTab quick-action on mobile)
const TABS = [
  { href: "/dashboard/home", label: "Home", Icon: Home },
  { href: "/dashboard/orders", label: "Orders", Icon: Package },
  { href: "/dashboard/shops", label: "Shops", Icon: Store },
  { href: "/dashboard/saved", label: "Wishlist", Icon: Bookmark },
  { href: "/dashboard/profile", label: "Profile", Icon: User },
] as const;

const MOBILE_TABS = TABS;

export function DashboardNav({ activeOrderCount }: { activeOrderCount: number }) {
  const pathname = usePathname();
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <>
      {/* Desktop tab bar — sticky below the header */}
      <div className="hidden sm:block sticky top-16 z-30 border-b border-[#2E3344]/8 bg-[#f8f8f7]/90 backdrop-blur-xl">
        <div className="container flex gap-1 px-4 sm:px-6 py-2">
          {TABS.map(({ href, label, Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-semibold transition ${
                  isActive
                    ? "bg-white text-[#27324A] shadow-sm"
                    : "text-[#746E73] hover:text-[#27324A] hover:bg-white/60"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {href === "/dashboard/orders" && activeOrderCount > 0 && (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#A7653A] text-[10px] font-bold text-white">
                    {activeOrderCount > 9 ? "9+" : activeOrderCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] sm:hidden bg-white border-t border-[#2E3344]/10 pb-safe">
        <div className="flex items-center h-16 relative">
          {MOBILE_TABS.slice(0, 2).map(({ href, label, Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 h-full transition-all duration-300 ${
                  isActive ? "text-[#A7653A]" : "text-[#746E73]"
                }`}
              >
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isActive ? "bg-[#F7F0E6]" : ""}`}>
                  <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
                  {href === "/dashboard/orders" && activeOrderCount > 0 && (
                    <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[#A7653A] text-[9px] font-bold text-white shadow-sm border border-white">
                      {activeOrderCount > 9 ? "9+" : activeOrderCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold">{label}</span>
              </Link>
            );
          })}

          {/* Central Scanner Button Container */}
          <div className="flex-1 flex justify-center h-full relative">
            <button
              onClick={() => setScannerOpen(true)}
              className="absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#A7653A] text-white shadow-[0_8px_25px_rgba(167,101,58,0.4)] transition-all duration-300 active:scale-90 hover:scale-105"
              aria-label="Scan & Order"
            >
              <Barcode className="h-6 w-6" />
            </button>
            <div className="mt-8">
              <span className="text-[10px] font-black uppercase tracking-tighter text-[#A7653A]">Scan</span>
            </div>
          </div>

          {MOBILE_TABS.slice(2).map(({ href, label, Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 h-full transition-all duration-300 ${
                  isActive ? "text-[#A7653A]" : "text-[#746E73]"
                }`}
              >
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isActive ? "bg-[#F7F0E6]" : ""}`}>
                  <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
                </div>
                <span className="text-[10px] font-bold">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />
    </>
  );
}
