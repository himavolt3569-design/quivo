"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type FontSize = "small" | "standard" | "large" | "xlarge";

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: "14px",
  standard: "16px",
  large: "18px",
  xlarge: "20px",
};

interface FontContextType {
  customerFontSize: FontSize;
  ownerFontSize: FontSize;
  setCustomerFontSize: (size: FontSize) => void;
  setOwnerFontSize: (size: FontSize) => void;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

export function FontProvider({
  children,
  initialCustomerFontSize = "standard",
  initialOwnerFontSize = "standard",
}: {
  children: React.ReactNode;
  initialCustomerFontSize?: FontSize;
  initialOwnerFontSize?: FontSize;
}) {
  const [customerFontSize, setCustomerFontSize] = useState<FontSize>(
    initialCustomerFontSize,
  );
  const [ownerFontSize, setOwnerFontSize] =
    useState<FontSize>(initialOwnerFontSize);
  const pathname = usePathname();

  useEffect(() => {
    // Determine which scale to apply based on current route
    const isOwnerRoute = pathname?.startsWith("/dashboard/owner");
    const activeSize = isOwnerRoute ? ownerFontSize : customerFontSize;

    document.documentElement.style.fontSize = FONT_SIZE_MAP[activeSize];
  }, [customerFontSize, ownerFontSize, pathname]);

  return (
    <FontContext.Provider
      value={{
        customerFontSize,
        ownerFontSize,
        setCustomerFontSize,
        setOwnerFontSize,
      }}
    >
      {children}
    </FontContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontContext);
  if (context === undefined) {
    throw new Error("useFontSize must be used within a FontProvider");
  }
  return context;
}
