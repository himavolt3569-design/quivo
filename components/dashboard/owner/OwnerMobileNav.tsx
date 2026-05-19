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
import type { ShopRole } from "@/lib/shop";

const MOBILE_BOTTOM_ROUTES: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: ShopRole[];
}[] = [
  { href: "/dashboard/owner", label: "Home", icon: LayoutDashboard, roles: ["owner", "admin", "manager", "viewer"] },
  { href: "/dashboard/owner/pos", label: "POS", icon: Calculator, roles: ["owner", "admin", "manager", "cashier"] },
  { href: "/dashboard/owner/products", label: "Inventory", icon: Package, roles: ["owner", "admin", "manager", "cashier", "inventory"] },
  { href: "/dashboard/owner/orders", label: "Orders", icon: ShoppingCart, roles: ["owner", "admin", "manager", "cashier"] },
];

const FULL_ACCESS_ROLES: readonly ShopRole[] = ["owner", "admin", "manager"];

function visibleBottomRoutes(role: ShopRole | null | undefined) {
  if (!role) return MOBILE_BOTTOM_ROUTES;
  if (FULL_ACCESS_ROLES.includes(role)) return MOBILE_BOTTOM_ROUTES;
  return MOBILE_BOTTOM_ROUTES.filter((r) => !r.roles || r.roles.includes(role));
}

interface OwnerMobileNavProps {
  shops: SwitcherShop[];
  activeShopId?: string | null;
  role?: ShopRole | null;
}

export function OwnerMobileNav({ shops, activeShopId, role }: OwnerMobileNavProps) {
  const pathname = usePathname();
  const routes = visibleBottomRoutes(role);

  return (
    <>
      {/* Bottom Tab Bar for quick core actions */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-[#2E3344]/10 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] h-16">
        <div className="flex items-center h-full">
          {routes.map((route) => {
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
              <OwnerSidebar isMobile shops={shops} activeShopId={activeShopId} role={role} />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}
