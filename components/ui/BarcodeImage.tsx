"use client";

import { useEffect, useRef } from "react";

interface BarcodeImageProps {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  className?: string;
}

export function BarcodeImage({
  value,
  width = 2,
  height = 80,
  fontSize = 14,
  className,
}: BarcodeImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      try {
        JsBarcode(canvasRef.current!, value, {
          format: "CODE128",
          width,
          height,
          fontSize,
          displayValue: true,
          font: "monospace",
          textMargin: 4,
          margin: 10,
          background: "#ffffff",
          lineColor: "#1a1a1a",
        });
      } catch {
        // invalid barcode value — leave canvas blank
      }
    });
  }, [value, width, height, fontSize]);

  return <canvas ref={canvasRef} className={className} />;
}
