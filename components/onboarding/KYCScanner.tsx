"use client";

import { useRef, useState } from "react";
import { UploadCloud, ScanLine, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type KYCStatus = "idle" | "scanning" | "verified" | "pending" | "error";

interface KYCScannerProps {
  onResult: (status: KYCStatus, confidence: number, file: File | null) => void;
}

const CONFIDENCE_THRESHOLD = 80;

export function KYCScanner({ onResult }: KYCScannerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<KYCStatus>("idle");
  const [confidence, setConfidence] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setStatus("scanning");
    setErrorMsg("");
    setConfidence(0);

    try {
      // Dynamically import Tesseract to keep it out of the SSR bundle
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: () => undefined,
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const conf = Math.round(data.confidence);
      setConfidence(conf);

      const finalStatus: KYCStatus = conf >= CONFIDENCE_THRESHOLD ? "verified" : "pending";
      setStatus(finalStatus);
      onResult(finalStatus, conf, file);
    } catch (err) {
      console.error("Tesseract error", err);
      setStatus("error");
      setErrorMsg("Could not scan the document. Please try a clearer image.");
      onResult("error", 0, file);
    }
  }

  const statusConfig = {
    idle: null,
    scanning: {
      icon: <ScanLine className="h-5 w-5 animate-pulse text-blue-500" />,
      label: "Scanning document…",
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-200",
    },
    verified: {
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      label: `Auto-verified (${confidence}% confidence)`,
      color: "text-green-700",
      bg: "bg-green-50 border-green-200",
    },
    pending: {
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      label: `Pending admin review (${confidence}% confidence)`,
      color: "text-amber-700",
      bg: "bg-amber-50 border-amber-200",
    },
    error: {
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      label: errorMsg || "Scan failed",
      color: "text-red-700",
      bg: "bg-red-50 border-red-200",
    },
  };

  const cfg = statusConfig[status];

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-[#2E3344]/10 rounded-2xl p-6 flex flex-col items-center gap-2 hover:bg-[#F7F0E6]/30 transition cursor-pointer text-center"
        onClick={() => status !== "scanning" && fileRef.current?.click()}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="KYC document" className="h-28 w-full object-contain rounded-lg mb-1" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-[#A7653A]/10 flex items-center justify-center">
            <UploadCloud className="h-6 w-6 text-[#A7653A]" />
          </div>
        )}
        <span className="text-sm font-bold text-[#27324A]">
          {previewUrl ? "Click to replace document" : "Upload PAN / VAT / Registration document"}
        </span>
        <span className="text-xs text-[#746E73]">JPG, PNG, PDF — clear photo required for AI scan</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        onChange={handleFileChange}
      />

      {cfg && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${cfg.bg}`}>
          {cfg.icon}
          <div className="flex-1">
            <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
            {status === "verified" && (
              <p className="text-xs text-green-600 mt-0.5">Your shop will be verified automatically.</p>
            )}
            {status === "pending" && (
              <p className="text-xs text-amber-600 mt-0.5">An admin will review your document. You can create the shop but some features will be locked until verified.</p>
            )}
          </div>
          {status === "error" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 text-xs rounded-lg"
              onClick={() => fileRef.current?.click()}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {status === "scanning" && (
        <div className="w-full h-1.5 bg-[#2E3344]/10 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
        </div>
      )}
    </div>
  );
}
