"use client";

import Link from "next/link";
import { Store, ShoppingBag } from "lucide-react";

type Variant = "sidebar" | "pill";
type TargetMode = "owner" | "customer";

interface RoleModeSwitchProps {
  variant: Variant;
  targetMode: TargetMode;
}

const TARGET_HREF: Record<TargetMode, string> = {
  owner: "/dashboard/owner",
  customer: "/dashboard/home",
};

const TARGET_LABEL: Record<TargetMode, string> = {
  owner: "Back to Owner Dashboard",
  customer: "Switch to Customer view",
};

const TARGET_ICON: Record<TargetMode, typeof Store> = {
  owner: Store,
  customer: ShoppingBag,
};

export function RoleModeSwitch({ variant, targetMode }: RoleModeSwitchProps) {
  const href = TARGET_HREF[targetMode];
  const label = TARGET_LABEL[targetMode];
  const Icon = TARGET_ICON[targetMode];

  if (variant === "sidebar") {
    return (
      <Link
        href={href}
        className="flex w-full items-center gap-3 rounded-2xl border border-[#A7653A]/30 bg-white px-3 py-3 text-sm font-bold text-[#A7653A] transition-all hover:bg-[#F7F0E6]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#A7653A]/10">
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  // pill
  return (
    <div className="sticky top-16 z-30 flex justify-center px-4 pt-3 sm:pt-4 pointer-events-none">
      <Link
        href={href}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[#27324A] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#27324A]/20 transition-all hover:bg-[#1f2839]"
      >
        <Icon className="h-3.5 w-3.5 text-[#D8C99A]" />
        {label}
      </Link>
    </div>
  );
}
