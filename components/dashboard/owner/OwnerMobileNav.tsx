"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calculator,
  Package,
  ShoppingCart,
  Menu,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { OwnerSidebar } from "./OwnerSidebar";
import type { SwitcherShop } from "./OwnerShopSwitcher";

const MOBILE_BOTTOM_ROUTES = [
  { href: "/dashboard/owner", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/owner/pos", label: "POS", icon: Calculator },
  { href: "/dashboard/owner/products", label: "Inventory", icon: Package },
  { href: "/dashboard/owner/orders", label: "Orders", icon: ShoppingCart },
];

interface OwnerMobileNavProps {
  shops: SwitcherShop[];
  activeShopId?: string | null;
}

export function OwnerMobileNav({ shops, activeShopId }: OwnerMobileNavProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Bottom Tab Bar for quick core actions */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-[#2E3344]/10 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] h-16">
        <div className="flex items-center h-full">
          {MOBILE_BOTTOM_ROUTES.map((route) => {
            const isActive = pathname === route.href || (route.href !== "/dashboard/owner" && pathname.startsWith(route.href + "/"));
            return (
              <Link
                key={route.href}
                href={route.href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 h-full transition-all active:scale-95 ${
                  isActive ? "text-[#A7653A]" : "text-[#746E73] hover:text-[#27324A]"
                }`}
              >
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isActive ? "bg-[#F7F0E6]" : ""}`}>
                  <route.icon className={`h-5 w-5 ${isActive ? "text-[#A7653A]" : "text-[#746E73]"}`} />
                </div>
                <span className={`text-[9px] font-bold ${isActive ? "text-[#A7653A]" : ""}`}>
                  {route.label}
                </span>
              </Link>
            );
          })}

          {/* More Menu (Slide Over) */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex flex-1 flex-col items-center justify-center gap-1 h-full transition-all active:scale-95 text-[#746E73] hover:text-[#27324A]">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full">
                  <Menu className="h-5 w-5" />
                </div>
                <span className="text-[9px] font-bold">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[80%] max-w-[320px] bg-[#f8f8f7] border-r-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <OwnerSidebar isMobile shops={shops} activeShopId={activeShopId} />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}
