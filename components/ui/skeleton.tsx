"use client";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("soft-skeleton rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
