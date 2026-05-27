"use client";

import { useLinkStatus } from "next/link";

interface NavPendingDotProps {
  className?: string;
}

export function NavPendingDot({ className = "" }: NavPendingDotProps) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-pending={pending ? "true" : "false"}
      className={`nav-pending-dot ${className}`}
    />
  );
}
