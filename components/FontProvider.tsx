"use client";

import { createContext, useContext, useEffect, useState } from "react";

type FontSize = "small" | "standard" | "large" | "xlarge";

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: "14px",
  standard: "16px",
  large: "18px",
  xlarge: "20px",
};

interface FontContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

export function FontProvider({ 
  children, 
  initialFontSize = "standard" 
}: { 
  children: React.ReactNode;
  initialFontSize?: FontSize;
}) {
  const [fontSize, setFontSizeState] = useState<FontSize>(initialFontSize);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
  };

  useEffect(() => {
    // Initial mount application
    document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSize];
  }, [fontSize]);

  return (
    <FontContext.Provider value={{ fontSize, setFontSize }}>
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
