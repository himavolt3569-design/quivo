"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { toggleSavedProduct } from "@/app/actions/wishlist";

interface Props {
  productId: string;
  initialSaved?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const sizeClass = { sm: "h-7 w-7", md: "h-9 w-9" };
const iconClass = { sm: "h-3.5 w-3.5", md: "h-4 w-4" };

export function SaveProductButton({
  productId,
  initialSaved = false,
  size = "sm",
  className,
}: Props) {
  const [saved, setSaved] = useState<boolean>(initialSaved);
  const [isPending, startTransition] = useTransition();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const optimistic = !saved;
      setSaved(optimistic);
      const res = await toggleSavedProduct(productId);
      if (res.error) {
        setSaved(!optimistic);
        toast.error(res.error);
        return;
      }
      toast.success(res.saved ? "Saved" : "Removed");
    });
  };

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from saved" : "Save for later"}
      aria-pressed={saved}
      onClick={onClick}
      disabled={isPending}
      className={`${sizeClass[size]} rounded-full bg-white/90 backdrop-blur border border-black/5 shadow-sm flex items-center justify-center transition active:scale-90 ${className ?? ""}`}
    >
      <Heart
        className={`${iconClass[size]} ${saved ? "text-rose-600" : "text-gray-500"}`}
        fill={saved ? "currentColor" : "transparent"}
        strokeWidth={2}
      />
    </button>
  );
}
