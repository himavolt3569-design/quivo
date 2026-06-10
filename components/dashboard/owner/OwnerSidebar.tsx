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
import { NavPendingDot } from "@/components/NavPendingDot";
import type { ShopRole } from "@/lib/shop";

// Each route declares the shop_members.role values that may see it. Absent
// `roles` ⇒ every role sees the route. Owner, admin and manager always see
// everything regardless of the allow-list (they're full-access roles).
const FULL_ACCESS_ROLES: readonly ShopRole[] = ["owner", "admin", "manager"];

const OWNER_ROUTES: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: ShopRole[];
}[] = [
  {
    href: "/dashboard/owner",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["owner", "admin", "manager", "viewer"],
  },
  {
    href: "/dashboard/owner/pos",
    label: "Point of Sale",
    icon: Calculator,
    roles: ["owner", "admin", "manager", "cashier"],
  },
  {
    href: "/dashboard/owner/products",
    label: "Inventory & Products",
    icon: Package,
    roles: ["owner", "admin", "manager", "cashier", "inventory"],
  },
  {
    href: "/dashboard/owner/orders",
    label: "Online Orders",
    icon: ShoppingCart,
    roles: ["owner", "admin", "manager", "cashier"],
  },
  {
    href: "/dashboard/owner/payments",
    label: "Payments",
    icon: CreditCard,
    roles: ["owner", "admin", "manager"],
  },
  {
    href: "/dashboard/owner/customers",
    label: "Customers & Udhar",
    icon: Users,
    roles: ["owner", "admin", "manager", "cashier"],
  },
  {
    href: "/dashboard/owner/wholesale",
    label: "Wholesale B2B",
    icon: Store,
    roles: ["owner", "admin", "manager"],
  },
  {
    href: "/dashboard/owner/suppliers",
    label: "Suppliers",
    icon: Truck,
    roles: ["owner", "admin", "manager", "inventory"],
  },
  {
    href: "/dashboard/owner/finances",
    label: "Finances & Reports",
    icon: BarChart3,
    roles: ["owner", "admin", "manager", "viewer"],
  },
  {
    href: "/dashboard/owner/staff",
    label: "Staff & Roles",
    icon: Shield,
    roles: ["owner", "admin", "manager"],
  },
  {
    href: "/dashboard/owner/payroll",
    label: "Payroll",
    icon: Banknote,
    roles: ["owner", "admin", "manager"],
  },
  {
    href: "/dashboard/owner/storefront",
    label: "Storefront & QR",
    icon: QrCode,
    roles: ["owner", "admin", "manager"],
  },
  {
    href: "/dashboard/owner/settings",
    label: "Shop Settings",
    icon: Settings,
    roles: ["owner", "admin", "manager"],
  },
];

function visibleRoutesFor(
  role: ShopRole | null | undefined,
): typeof OWNER_ROUTES {
  // Default to the most permissive view when the role hasn't loaded yet —
  // server-side route guards still enforce the real boundary.
  if (!role) return OWNER_ROUTES;
  if (FULL_ACCESS_ROLES.includes(role)) return OWNER_ROUTES;
  return OWNER_ROUTES.filter((r) => !r.roles || r.roles.includes(role));
}

interface OwnerSidebarProps {
  isMobile?: boolean;
  shops: SwitcherShop[];
  activeShopId?: string | null;
  /**
   * The current user's role for the active shop. Drives the visible nav list.
   * Server-side route protection is independent of this UI gating.
   */
  role?: ShopRole | null;
}

export function OwnerSidebar({
  isMobile = false,
  shops,
  activeShopId,
  role,
}: OwnerSidebarProps) {
  const pathname = usePathname();
  const routes = visibleRoutesFor(role);

  return (
    <aside
      className={`${
        isMobile
          ? "flex w-full h-full flex-col bg-[#f8f8f7]"
          : "hidden md:flex md:w-20 lg:w-64 flex-col border-r border-[#2E3344]/8 bg-white/50 backdrop-blur-xl h-[calc(100vh-4rem)] sticky top-16 transition-all duration-300"
      }`}
    >
      <div className="p-4 border-b border-[#2E3344]/8">
        <OwnerShopSwitcher shops={shops} activeShopId={activeShopId} />
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {routes.map((route) => {
          const isActive =
            pathname === route.href ||
            (route.href !== "/dashboard/owner" &&
              pathname.startsWith(route.href + "/"));
          return (
            <Link
              key={route.href}
              href={route.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-bold transition-all ${
                isActive
                  ? "bg-[#27324A] text-white shadow-md shadow-[#27324A]/10"
                  : "text-[#746E73] hover:bg-[#F7F0E6] hover:text-[#27324A]"
              } ${isMobile ? "" : "md:justify-center lg:justify-start"}`}
              title={route.label}
            >
              <route.icon
                className={`h-4 w-4 shrink-0 ${isActive ? "text-[#D8C99A]" : ""}`}
              />
              <span className={isMobile ? "" : "hidden lg:block"}>
                {route.label}
              </span>
              <NavPendingDot
                className={
                  isMobile ? "ml-auto" : "ml-auto hidden lg:inline-block"
                }
              />
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
            ? {
                paddingBottom:
                  "calc(4rem + env(safe-area-inset-bottom) + 1rem)",
              }
            : undefined
        }
      >
        <div className={isMobile ? "" : "hidden lg:block"}>
          <RoleModeSwitch variant="sidebar" targetMode="customer" />
        </div>
        <div
          className={`relative overflow-hidden rounded-2xl p-4 text-center ${
            isMobile
              ? "bg-gradient-to-br from-[#E8E3D1] to-[#F7F0E6] border border-[#A7653A]/20 shadow-sm"
              : "bg-[#E8E3D1]/50 hidden lg:block"
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
