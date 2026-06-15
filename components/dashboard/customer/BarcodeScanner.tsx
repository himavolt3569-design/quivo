"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Barcode, AlertCircle, RotateCcw, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BarcodeShopResults } from "@/components/storefront/BarcodeShopResults";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
}

type ScanState =
  | "requesting"
  | "scanning"
  | "results"
  | "unsupported"
  | "denied";

export function BarcodeScanner({ open, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [state, setState] = useState<ScanState>("requesting");
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [scanKey, setScanKey] = useState(0);

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleBarcodeScan = (raw: string) => {
    // Show every nearby shop that carries this barcode (with stock + distance)
    // so the customer picks where to order from — the real "scan → match →
    // order" flow. BarcodeShopResults handles the lookup, geolocation and the
    // empty ("no shop carries this yet") state.
    const trimmed = raw.trim();
    if (!trimmed) return;
    stopCamera();
    setScannedBarcode(trimmed);
    setState("results");
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("requesting");
      setScannedBarcode("");
      setManualInput("");
      return;
    }

    let alive = true;

    const start = async () => {
      setState("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
          },
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!("BarcodeDetector" in window)) {
          setState("unsupported");
          return;
        }

        // @ts-expect-error — BarcodeDetector not yet in TS lib
        const detector = new window.BarcodeDetector({
          formats: [
            "ean_13",
            "ean_8",
            "qr_code",
            "code_128",
            "upc_a",
            "upc_e",
            "code_39",
          ],
        });

        setState("scanning");

        const loop = async () => {
          if (!alive || !videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && alive) {
              const raw: string = barcodes[0].rawValue;
              stopCamera();
              handleBarcodeScan(raw);
              return;
            }
          } catch {
            /* continue */
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (err: unknown) {
        if (!alive) return;
        const name = (err as { name?: string })?.name;
        setState(
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "denied"
            : "unsupported",
        );
      }
    };

    start();
    return () => {
      alive = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scanKey]);

  const handleRescan = () => {
    stopCamera();
    setScanKey((k) => k + 1);
  };

  const handleManualLookup = () => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;
    handleBarcodeScan(trimmed);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pb-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
      >
        <div className="flex items-center gap-2">
          <Barcode className="h-5 w-5 text-[#A7653A]" />
          <span className="text-white font-semibold text-sm tracking-wide">
            Barcode Scanner
          </span>
        </div>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 transition active:scale-95"
          aria-label="Close scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Camera + overlay */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            state === "results" ||
            state === "denied" ||
            state === "unsupported"
              ? "opacity-20"
              : "opacity-100"
          }`}
          playsInline
          muted
          autoPlay
        />

        {/* Viewfinder */}
        {(state === "scanning" || state === "requesting") && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative h-60 w-60"
              style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)" }}
            >
              <span className="absolute top-0 left-0 h-9 w-9 border-t-[3.5px] border-l-[3.5px] border-[#A7653A] rounded-tl-xl" />
              <span className="absolute top-0 right-0 h-9 w-9 border-t-[3.5px] border-r-[3.5px] border-[#A7653A] rounded-tr-xl" />
              <span className="absolute bottom-0 left-0 h-9 w-9 border-b-[3.5px] border-l-[3.5px] border-[#A7653A] rounded-bl-xl" />
              <span className="absolute bottom-0 right-0 h-9 w-9 border-b-[3.5px] border-r-[3.5px] border-[#A7653A] rounded-br-xl" />
              {state === "scanning" && (
                <motion.div
                  className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#A7653A] to-transparent"
                  animate={{ top: ["10%", "88%"] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                  }}
                />
              )}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Camera denied / unsupported — show manual input */}
          {(state === "denied" || state === "unsupported") && (
            <motion.div
              key="fallback"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8"
            >
              <AlertCircle className="h-14 w-14 text-red-400" />
              <div className="text-center">
                <h3 className="text-lg font-bold text-white mb-1.5">
                  {state === "denied"
                    ? "Camera access denied"
                    : "Auto-scan not available"}
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  {state === "denied"
                    ? "Allow camera access in your browser settings, or enter the barcode below."
                    : "Your browser doesn't support barcode detection. Enter the number below."}
                </p>
              </div>
              <div className="w-full max-w-xs space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                  placeholder="e.g. 8941001204812"
                  className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder-white/35 outline-none focus:ring-2 focus:ring-[#A7653A] text-center text-sm tracking-widest"
                />
                <button
                  onClick={handleManualLookup}
                  disabled={!manualInput.trim()}
                  className="w-full rounded-full bg-[#A7653A] py-3 text-sm font-semibold text-white disabled:opacity-40 transition hover:bg-[#8E5432] active:scale-95"
                >
                  Find shops with this barcode
                </button>
              </div>
            </motion.div>
          )}

          {/* Results — every nearby shop carrying the scanned barcode */}
          {state === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 top-0 flex flex-col"
            >
              <div className="mt-auto flex max-h-[88%] flex-col overflow-hidden rounded-t-3xl bg-[#F7F0E6] shadow-2xl">
                <div className="flex items-center justify-between gap-2 border-b border-[#2E3344]/8 bg-white px-4 py-3">
                  <button
                    onClick={handleRescan}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#2E3344]/12 px-3 py-1.5 text-xs font-semibold text-[#27324A] transition hover:bg-[#F7F0E6] active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Scan again
                  </button>
                  <Link
                    href={`/find/${encodeURIComponent(scannedBarcode)}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#27324A] px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95"
                  >
                    Open full page <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="overflow-y-auto px-4 pb-6 pt-4">
                  <BarcodeShopResults barcode={scannedBarcode} compact />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {state !== "results" && (
        <div
          className="pt-5 text-center"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
        >
          {state === "scanning" && (
            <p className="text-xs text-white/45">
              Point the camera at any product barcode
            </p>
          )}
          {state === "requesting" && (
            <p className="text-xs text-white/45">Requesting camera access…</p>
          )}
        </div>
      )}
    </div>
  );
}
