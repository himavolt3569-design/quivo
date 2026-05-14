"use client";

import { useEffect, useRef, useState } from "react";
import { X, Barcode, AlertCircle, RotateCcw, PackageX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { lookupProductByBarcode } from "@/app/actions/customer";
import type { ScannedProduct } from "@/app/actions/customer";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onOrderNow?: (product: ScannedProduct) => void;
}

type ScanState = "requesting" | "scanning" | "detected" | "unsupported" | "denied";

export function BarcodeScanner({ open, onClose, onOrderNow }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [state, setState] = useState<ScanState>("requesting");
  const [detected, setDetected] = useState<ScannedProduct | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [scanKey, setScanKey] = useState(0);

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleBarcodeScan = async (raw: string) => {
    setLooking(true);
    const result = await lookupProductByBarcode(raw);
    setLooking(false);

    if (result.error) {
      setNotFound(true);
      setScannedBarcode(raw);
    } else if (result.product) {
      setDetected(result.product);
      setNotFound(false);
    } else {
      // barcode not found in any shop's catalog
      setNotFound(true);
      setScannedBarcode(raw);
    }
    setState("detected");
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("requesting");
      setDetected(null);
      setNotFound(false);
      setScannedBarcode("");
      setManualInput("");
      return;
    }

    let alive = true;

    const start = async () => {
      setState("requesting");
      setDetected(null);
      setNotFound(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!("BarcodeDetector" in window)) { setState("unsupported"); return; }

        // @ts-expect-error — BarcodeDetector not yet in TS lib
        const detector = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "qr_code", "code_128", "upc_a", "upc_e", "code_39"],
        });

        setState("scanning");

        const loop = async () => {
          if (!alive || !videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && alive) {
              const raw: string = barcodes[0].rawValue;
              stopCamera();
              await handleBarcodeScan(raw);
              return;
            }
          } catch { /* continue */ }
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (err: unknown) {
        if (!alive) return;
        const name = (err as { name?: string })?.name;
        setState(name === "NotAllowedError" || name === "PermissionDeniedError" ? "denied" : "unsupported");
      }
    };

    start();
    return () => { alive = false; stopCamera(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scanKey]);

  const handleRescan = () => { stopCamera(); setScanKey((k) => k + 1); };

  const handleManualLookup = async () => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;
    setLooking(true);
    await handleBarcodeScan(trimmed);
    setLooking(false);
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
          <span className="text-white font-semibold text-sm tracking-wide">Barcode Scanner</span>
        </div>
        <button
          onClick={() => { stopCamera(); onClose(); }}
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
            state === "detected" || state === "denied" || state === "unsupported" ? "opacity-20" : "opacity-100"
          }`}
          playsInline muted autoPlay
        />

        {/* Viewfinder */}
        {(state === "scanning" || state === "requesting") && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-60 w-60" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)" }}>
              <span className="absolute top-0 left-0 h-9 w-9 border-t-[3.5px] border-l-[3.5px] border-[#A7653A] rounded-tl-xl" />
              <span className="absolute top-0 right-0 h-9 w-9 border-t-[3.5px] border-r-[3.5px] border-[#A7653A] rounded-tr-xl" />
              <span className="absolute bottom-0 left-0 h-9 w-9 border-b-[3.5px] border-l-[3.5px] border-[#A7653A] rounded-bl-xl" />
              <span className="absolute bottom-0 right-0 h-9 w-9 border-b-[3.5px] border-r-[3.5px] border-[#A7653A] rounded-br-xl" />
              {state === "scanning" && (
                <motion.div
                  className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#A7653A] to-transparent"
                  animate={{ top: ["10%", "88%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
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
                  {state === "denied" ? "Camera access denied" : "Auto-scan not available"}
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
                  disabled={!manualInput.trim() || looking}
                  className="w-full rounded-full bg-[#A7653A] py-3 text-sm font-semibold text-white disabled:opacity-40 transition hover:bg-[#8E5432] active:scale-95"
                >
                  {looking ? "Looking up…" : "Look up barcode"}
                </button>
              </div>
            </motion.div>
          )}

          {/* Detected (found or not found) */}
          {state === "detected" && (
            <motion.div
              key="detected"
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 px-4 pt-4"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
            >
              <div className="rounded-3xl bg-white p-5 shadow-2xl">
                {detected ? (
                  /* Product found (available or archived) */
                  <div className="flex gap-4 mb-5">
                    {detected.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={detected.image}
                        alt={detected.name}
                        className="h-20 w-20 rounded-2xl object-cover flex-shrink-0 bg-[#F7F0E6]"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-2xl bg-[#F7F0E6] flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl font-black text-[#A7653A]/40">{detected.name[0]}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#A7653A] mb-1 truncate">{detected.shopName}</p>
                      <h3 className="font-bold text-[#27324A] leading-snug text-sm">{detected.name}</h3>
                      {!detected.isAvailable ? (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <PackageX className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          <span className="text-xs font-bold text-red-500">Not Available</span>
                        </div>
                      ) : (
                        <>
                          <p className="text-xl font-bold text-[#27324A] mt-1.5">Rs. {detected.price.toLocaleString()}</p>
                          <p className="text-xs text-[#746E73] mt-0.5">
                            {detected.stock > 0 ? `${detected.stock} in stock` : "Out of stock"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Not found in any shop */
                  <div className="mb-5">
                    <p className="text-xs font-medium text-[#746E73] mb-1">Barcode: {scannedBarcode}</p>
                    <h3 className="font-bold text-[#27324A]">Product not found</h3>
                    <p className="text-sm text-[#746E73] mt-1">
                      No shop in your area carries this item yet.
                    </p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleRescan}
                    className="flex items-center justify-center gap-2 flex-1 rounded-full border border-[#2E3344]/12 py-3 text-sm font-semibold text-[#27324A] hover:bg-[#F7F0E6] transition active:scale-95"
                  >
                    <RotateCcw className="h-4 w-4" /> Scan again
                  </button>
                  {detected && detected.isAvailable && detected.stock > 0 && (
                    <button
                      onClick={() => {
                        onOrderNow?.(detected);
                        stopCamera();
                        onClose();
                      }}
                      className="flex-1 rounded-full bg-[#A7653A] py-3 text-sm font-semibold text-white hover:bg-[#8E5432] transition active:scale-95"
                    >
                      Order now
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {state !== "detected" && (
        <div className="pt-5 text-center" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}>
          {state === "scanning" && <p className="text-xs text-white/45">Point the camera at any product barcode</p>}
          {state === "requesting" && <p className="text-xs text-white/45">Requesting camera access…</p>}
        </div>
      )}
    </div>
  );
}
