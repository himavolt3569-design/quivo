"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, Bookmark, User } from "lucide-react";

const TABS = [
  { href: "/dashboard/home", label: "Home", Icon: Home },
  { href: "/dashboard/orders", label: "Orders", Icon: Package },
  { href: "/dashboard/saved", label: "Wishlist", Icon: Bookmark },
  { href: "/dashboard/profile", label: "Profile", Icon: User },
] as const;

export function DashboardNav({ activeOrderCount }: { activeOrderCount: number }) {
  const pathname = usePathname();

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
      <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t border-[#2E3344]/8 bg-white/95 backdrop-blur-2xl flex">
        {TABS.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center gap-1 py-3 transition ${
                isActive ? "text-[#A7653A]" : "text-[#746E73]"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`}
              />
              <span className="text-[10px] font-bold">{label}</span>
              {href === "/dashboard/orders" && activeOrderCount > 0 && (
                <span className="absolute right-[calc(50%-18px)] top-2 grid h-4 w-4 place-items-center rounded-full bg-[#A7653A] text-[9px] font-bold text-white">
                  {activeOrderCount > 9 ? "9+" : activeOrderCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
