"use client";

import { Star } from "lucide-react";
import { useId, useState } from "react";

interface DisplayProps {
  value: number;
  count?: number;
  size?: "sm" | "md" | "lg";
  showEmpty?: boolean;
}

const sizeClass: Record<NonNullable<DisplayProps["size"]>, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function StarRating({
  value,
  count,
  size = "sm",
  showEmpty = false,
}: DisplayProps) {
  const rounded = Math.round((Number(value) || 0) * 2) / 2; // nearest 0.5
  if (rounded <= 0 && !showEmpty) return null;

  const stars = [1, 2, 3, 4, 5].map((i) => {
    const fill = rounded >= i ? "full" : rounded >= i - 0.5 ? "half" : "empty";
    return { i, fill } as const;
  });

  return (
    <span
      className="inline-flex items-center gap-1 text-[#A7653A]"
      aria-label={`${rounded} out of 5 stars`}
    >
      {stars.map((s) => (
        <Star
          key={s.i}
          className={`${sizeClass[size]} ${s.fill === "empty" ? "opacity-30" : ""}`}
          fill={s.fill === "empty" ? "transparent" : "currentColor"}
          strokeWidth={1.5}
        />
      ))}
      {typeof count === "number" && count > 0 && (
        <span className="text-xs font-bold text-[#746E73] ml-0.5">
          ({count})
        </span>
      )}
    </span>
  );
}

interface InteractiveProps {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  size?: DisplayProps["size"];
}

export function InteractiveStarRating({
  value,
  onChange,
  disabled,
  size = "lg",
}: InteractiveProps) {
  const labelId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const effective = hover ?? value;

  return (
    <fieldset
      className="inline-flex items-center gap-1"
      aria-labelledby={labelId}
      disabled={disabled}
    >
      <span id={labelId} className="sr-only">
        Rate this product, 1 to 5 stars
      </span>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`${i} star${i === 1 ? "" : "s"}`}
          aria-pressed={value === i}
          className={`p-1 rounded-md text-[#A7653A] transition-transform ${disabled ? "" : "hover:scale-110 active:scale-95"}`}
          onMouseEnter={() => !disabled && setHover(i)}
          onMouseLeave={() => !disabled && setHover(null)}
          onFocus={() => !disabled && setHover(i)}
          onBlur={() => !disabled && setHover(null)}
          onClick={() => !disabled && onChange(i)}
        >
          <Star
            className={sizeClass[size]}
            fill={effective >= i ? "currentColor" : "transparent"}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </fieldset>
  );
}
