"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Store,
  BarChart3,
  Settings,
  QrCode,
  Calculator,
  Truck,
  Shield,
  CreditCard,
  Banknote,
} from "lucide-react";
import { OwnerShopSwitcher, type SwitcherShop } from "./OwnerShopSwitcher";
import { RoleModeSwitch } from "@/components/dashboard/RoleModeSwitch";

const OWNER_ROUTES = [
  { href: "/dashboard/owner", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/owner/pos", label: "Point of Sale", icon: Calculator },
  { href: "/dashboard/owner/products", label: "Inventory & Products", icon: Package },
  { href: "/dashboard/owner/orders", label: "Online Orders", icon: ShoppingCart },
  { href: "/dashboard/owner/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/owner/customers", label: "Customers & Udhar", icon: Users },
  { href: "/dashboard/owner/suppliers", label: "Suppliers", icon: Truck },
  { href: "/dashboard/owner/finances", label: "Finances & Reports", icon: BarChart3 },
  { href: "/dashboard/owner/staff", label: "Staff & Roles", icon: Shield },
  { href: "/dashboard/owner/payroll", label: "Payroll", icon: Banknote },
  { href: "/dashboard/owner/storefront", label: "Storefront & QR", icon: QrCode },
  { href: "/dashboard/owner/settings", label: "Shop Settings", icon: Settings },
];

interface OwnerSidebarProps {
  isMobile?: boolean;
  shops: SwitcherShop[];
  activeShopId?: string | null;
}

export function OwnerSidebar({ isMobile = false, shops, activeShopId }: OwnerSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`${
        isMobile
          ? "flex w-full h-full flex-col bg-[#f8f8f7]"
          : "hidden lg:flex w-64 flex-col border-r border-[#2E3344]/8 bg-white/50 backdrop-blur-xl h-[calc(100vh-4rem)] sticky top-16"
      }`}
    >
      <div className="p-4 border-b border-[#2E3344]/8">
        <OwnerShopSwitcher shops={shops} activeShopId={activeShopId} />
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {OWNER_ROUTES.map((route) => {
          const isActive = pathname === route.href || (route.href !== "/dashboard/owner" && pathname.startsWith(route.href + "/"));
          return (
            <Link
              key={route.href}
              href={route.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-bold transition-all ${
                isActive
                  ? "bg-[#27324A] text-white shadow-md shadow-[#27324A]/10"
                  : "text-[#746E73] hover:bg-[#F7F0E6] hover:text-[#27324A]"
              }`}
            >
              <route.icon className={`h-4 w-4 ${isActive ? "text-[#D8C99A]" : ""}`} />
              {route.label}
            </Link>
          );
        })}
      </nav>
      {/* Footer. On mobile we add bottom inset for the safe area + the
          fixed OwnerMobileNav tab bar (h-16) so the subscription card always
          sits clearly above the chrome instead of getting clipped or visually
          competing with the bottom nav. */}
      <div
        className="p-4 border-t border-[#2E3344]/8 space-y-3"
        style={
          isMobile
            ? { paddingBottom: "calc(4rem + env(safe-area-inset-bottom) + 1rem)" }
            : undefined
        }
      >
        <RoleModeSwitch variant="sidebar" targetMode="customer" />
        <div
          className={`relative overflow-hidden rounded-2xl p-4 text-center ${
            isMobile
              ? "bg-gradient-to-br from-[#E8E3D1] to-[#F7F0E6] border border-[#A7653A]/20 shadow-sm"
              : "bg-[#E8E3D1]/50"
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#A7653A] text-white">
              <Store className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-black uppercase tracking-widest text-[#27324A]">
              Kirana Pro
            </p>
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#58c47a] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#3da55e]" />
            </span>
            <p className="text-[11px] text-[#746E73] font-semibold">
              Active Subscription
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
