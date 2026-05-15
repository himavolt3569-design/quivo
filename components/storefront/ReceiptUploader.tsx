"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud, Loader2, CheckCircle2, Copy, Check, Building2, QrCode } from "lucide-react";
import { uploadReceiptForOrder } from "@/app/actions/payments";
import type { PaymentMethod, PublicPaymentMethods } from "@/lib/payments";

interface ReceiptUploaderProps {
  orderNumber: string;
  trackingToken: string;
  method: PaymentMethod;
  bank: PublicPaymentMethods | null;
  total: number;
}

function Copyable({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ }
      }}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white border border-gray-200 text-left"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="font-mono font-bold text-sm text-gray-900 truncate">{value}</p>
      </div>
      {copied ? <Check className="h-4 w-4 text-green-600 shrink-0" /> : <Copy className="h-4 w-4 text-gray-400 shrink-0" />}
    </button>
  );
}

export function ReceiptUploader({ orderNumber, trackingToken, method, bank, total }: ReceiptUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setError("Receipt exceeds 8 MB."); return; }
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type) && f.type !== "application/pdf") {
      setError("Only PNG, JPG, WebP or PDF.");
      return;
    }
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  function handleUpload() {
    if (!file) return;
    setError("");
    startTransition(async () => {
      const fd = new FormData();
      fd.append("receipt", file);
      const res = await uploadReceiptForOrder(orderNumber, trackingToken, fd);
      if (res.error) { setError(res.error); return; }
      setUploaded(true);
      window.location.reload();
    });
  }

  if (uploaded) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-3xl p-5 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-green-700 shrink-0" />
        <p className="text-sm font-bold text-green-900">Receipt uploaded — the shop will verify shortly.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-blue-200 rounded-3xl shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        {method === "bank_transfer" ? <Building2 className="h-5 w-5 text-blue-700" /> : <QrCode className="h-5 w-5 text-pink-700" />}
        <h2 className="font-black text-gray-900">Upload Payment Receipt</h2>
      </div>
      <p className="text-xs text-gray-600">
        Send Rs. <span className="font-bold text-gray-900">{total.toLocaleString()}</span> using the details below,
        then upload a screenshot/photo or PDF of the receipt.
      </p>

      {/* Payment details */}
      {method === "bank_transfer" && bank && (
        <div className="space-y-1.5">
          {bank.bank_name           && <Copyable label="Bank"     value={bank.bank_name} />}
          {bank.bank_account_holder && <Copyable label="Holder"   value={bank.bank_account_holder} />}
          {bank.bank_account_number && <Copyable label="Account #" value={bank.bank_account_number} />}
          {bank.bank_branch         && <Copyable label="Branch"   value={bank.bank_branch} />}
          {bank.bank_swift_code     && <Copyable label="SWIFT"    value={bank.bank_swift_code} />}
          {bank.payment_instructions && (
            <p className="text-[11px] text-gray-600 whitespace-pre-wrap pt-1">{bank.payment_instructions}</p>
          )}
        </div>
      )}

      {method === "qr_code" && bank?.qr_code_url && (
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bank.qr_code_url} alt="Payment QR" className="h-52 w-52 rounded-xl border border-gray-200 bg-white object-contain" />
          {bank.payment_instructions && (
            <p className="text-[11px] text-gray-600 whitespace-pre-wrap text-center">{bank.payment_instructions}</p>
          )}
        </div>
      )}

      {/* File picker */}
      <div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={handlePick} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-2xl h-32 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition">
          <UploadCloud className="h-5 w-5 text-gray-400" />
          <span className="text-xs font-bold text-gray-700">{file ? file.name : "Choose receipt file"}</span>
          <span className="text-[10px] text-gray-400">PNG / JPG / WebP / PDF · max 8 MB</span>
        </button>
      </div>

      {preview && <img src={preview} alt="Preview" className="h-32 w-full object-contain rounded-xl border border-gray-100" />}

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-medium">{error}</p>}

      <button type="button" onClick={handleUpload} disabled={!file || isPending}
        className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-bold disabled:opacity-50 active:scale-95 transition flex items-center justify-center gap-2">
        {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading…</> : "Submit Receipt"}
      </button>
    </div>
  );
}
