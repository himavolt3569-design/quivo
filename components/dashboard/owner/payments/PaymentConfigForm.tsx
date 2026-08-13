"use client";

import { useRef, useState, useTransition } from "react";
import {
  Save,
  Loader2,
  CheckCircle2,
  Lock,
  UploadCloud,
  X,
  Eye,
  EyeOff,
  Smartphone,
  Building2,
  QrCode,
  Banknote,
} from "lucide-react";
import {
  updateOwnerPaymentConfig,
  uploadQrCodeImage,
} from "@/app/actions/payment-config";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/payments/constants";
import type { OwnerPaymentConfig, PaymentMethod } from "@/lib/payments";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  shopId: string;
  initial: OwnerPaymentConfig;
}

const METHOD_ICONS: Record<
  PaymentMethod,
  React.ComponentType<{ className?: string }>
> = {
  cod: Banknote,
  esewa: Smartphone,
  khalti: Smartphone,
  bank_transfer: Building2,
  qr_code: QrCode,
};

export function PaymentConfigForm({ shopId, initial }: Props) {
  const [enabled, setEnabled] = useState<Set<PaymentMethod>>(
    new Set(initial.enabled_methods),
  );
  const [showEsewaSecret, setShowEsewaSecret] = useState(false);
  const [showKhaltiSecret, setShowKhaltiSecret] = useState(false);
  const [qrUrl, setQrUrl] = useState(initial.qr_code_url ?? "");
  const [qrUploading, setQrUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const qrFileRef = useRef<HTMLInputElement>(null);

  function toggleMethod(m: PaymentMethod) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      // COD is always available as a fallback if nothing else is on.
      if (next.size === 0) next.add("cod");
      return next;
    });
  }

  async function handleQrPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setQrUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    const res = await uploadQrCodeImage(shopId, fd);
    setQrUploading(false);
    if (res.error || !res.url) {
      toast.error(res.error ?? "Upload failed.");
      return;
    }
    setQrUrl(res.url);
    toast.success("QR uploaded — remember to save.");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("enabled_methods");
    for (const m of enabled) fd.append("enabled_methods", m);
    if (qrUrl) fd.set("qr_code_url", qrUrl);
    else fd.delete("qr_code_url");

    startTransition(async () => {
      const res = await updateOwnerPaymentConfig(shopId, fd);
      if (res.error) toast.error(res.error);
      else toast.success("Payment settings saved.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Method toggles */}
      <Section
        title="Enabled Methods"
        subtitle="Pick which methods your customers can use."
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {PAYMENT_METHODS.map((m) => {
            const Icon = METHOD_ICONS[m];
            const on = enabled.has(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMethod(m)}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition ${
                  on
                    ? "border-[#27324A] bg-[#27324A] text-white"
                    : "border-[#2E3344]/10 bg-white text-[#27324A] hover:border-[#27324A]/30"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[11px] font-bold text-center leading-tight">
                  {PAYMENT_METHOD_LABELS[m]}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* eSewa */}
      <Section
        title="eSewa"
        subtitle="ePay v2 — customers redirect to the official eSewa page."
      >
        <Field
          label="Merchant Code (product_code)"
          name="esewa_merchant_code"
          defaultValue={initial.esewa_merchant_code ?? ""}
          placeholder="EPAYTEST"
        />
        <div>
          <label className="block text-xs font-black text-[#27324A] mb-1.5">
            Secret Key
          </label>
          <div className="relative">
            <input
              name="esewa_secret_key"
              type={showEsewaSecret ? "text" : "password"}
              autoComplete="off"
              placeholder={
                initial.has_esewa_secret
                  ? "•••••••• (leave blank to keep current)"
                  : "Paste HMAC secret"
              }
              className="w-full h-11 px-3 pr-10 rounded-xl border border-[#2E3344]/10 bg-white text-sm outline-none focus:border-[#27324A]"
            />
            <button
              type="button"
              onClick={() => setShowEsewaSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md hover:bg-gray-100 flex items-center justify-center"
            >
              {showEsewaSecret ? (
                <EyeOff className="h-3.5 w-3.5 text-gray-500" />
              ) : (
                <Eye className="h-3.5 w-3.5 text-gray-500" />
              )}
            </button>
          </div>
          {initial.has_esewa_secret && (
            <p className="mt-1 text-[10px] text-[#746E73] flex items-center gap-1">
              <Lock className="h-3 w-3" /> Current secret is stored. Leave blank
              to keep it; type a new value to overwrite.
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-black text-[#27324A] mb-1.5">
            Environment
          </label>
          <select
            name="esewa_environment"
            defaultValue={initial.esewa_environment}
            className="h-11 w-full px-3 rounded-xl border border-[#2E3344]/10 bg-white text-sm"
          >
            <option value="sandbox">Sandbox (testing)</option>
            <option value="production">Production</option>
          </select>
        </div>
      </Section>

      {/* Khalti */}
      <Section
        title="Khalti"
        subtitle="KPG-2 — customers redirect to the official Khalti page."
      >
        <Field
          label="Public Key"
          name="khalti_public_key"
          defaultValue={initial.khalti_public_key ?? ""}
          placeholder="test_public_key_xxxxxxxx"
        />
        <div>
          <label className="block text-xs font-black text-[#27324A] mb-1.5">
            Secret Key
          </label>
          <div className="relative">
            <input
              name="khalti_secret_key"
              type={showKhaltiSecret ? "text" : "password"}
              autoComplete="off"
              placeholder={
                initial.has_khalti_secret
                  ? "•••••••• (leave blank to keep current)"
                  : "Paste secret key"
              }
              className="w-full h-11 px-3 pr-10 rounded-xl border border-[#2E3344]/10 bg-white text-sm outline-none focus:border-[#27324A]"
            />
            <button
              type="button"
              onClick={() => setShowKhaltiSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md hover:bg-gray-100 flex items-center justify-center"
            >
              {showKhaltiSecret ? (
                <EyeOff className="h-3.5 w-3.5 text-gray-500" />
              ) : (
                <Eye className="h-3.5 w-3.5 text-gray-500" />
              )}
            </button>
          </div>
          {initial.has_khalti_secret && (
            <p className="mt-1 text-[10px] text-[#746E73] flex items-center gap-1">
              <Lock className="h-3 w-3" /> Current secret is stored. Leave blank
              to keep it.
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-black text-[#27324A] mb-1.5">
            Environment
          </label>
          <Select
            name="khalti_environment"
            defaultValue={initial.khalti_environment}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Environment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* Bank transfer */}
      <Section
        title="Bank Transfer"
        subtitle="Shown to customers who pick bank transfer."
      >
        <Field
          label="Bank Name"
          name="bank_name"
          defaultValue={initial.bank_name ?? ""}
          placeholder="Nabil Bank"
        />
        <Field
          label="Account Holder"
          name="bank_account_holder"
          defaultValue={initial.bank_account_holder ?? ""}
          placeholder="Quivo Foods Pvt. Ltd."
        />
        <Field
          label="Account Number"
          name="bank_account_number"
          defaultValue={initial.bank_account_number ?? ""}
          placeholder="0123456789"
        />
        <Field
          label="Branch (optional)"
          name="bank_branch"
          defaultValue={initial.bank_branch ?? ""}
          placeholder="New Road"
        />
        <Field
          label="SWIFT (optional)"
          name="bank_swift_code"
          defaultValue={initial.bank_swift_code ?? ""}
          placeholder="NARBNPKA"
        />
      </Section>

      {/* QR */}
      <Section
        title="QR Code"
        subtitle="Upload the QR your customers will scan with their banking app."
      >
        <input
          ref={qrFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={handleQrPick}
        />
        <div className="flex items-start gap-3">
          {qrUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="QR"
                className="h-32 w-32 rounded-2xl border border-[#2E3344]/10 object-contain bg-white"
              />
              <button
                type="button"
                onClick={() => setQrUrl("")}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => qrFileRef.current?.click()}
              disabled={qrUploading}
              className="h-32 w-32 rounded-2xl border-2 border-dashed border-[#2E3344]/10 flex flex-col items-center justify-center gap-1.5 hover:bg-[#f8f8f7]"
            >
              {qrUploading ? (
                <Loader2 className="h-4 w-4 hidden text-gray-400" />
              ) : (
                <UploadCloud className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-[10px] font-bold text-gray-600">
                Upload QR
              </span>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#746E73]">
              PNG / JPG / WebP · max 5 MB. The image is shown to customers at
              checkout and on the receipt-upload page.
            </p>
          </div>
        </div>
      </Section>

      {/* Instructions */}
      <Section
        title="Customer Instructions"
        subtitle="Free-text shown alongside bank/QR details (e.g. include order # in remarks)."
      >
        <textarea
          name="payment_instructions"
          defaultValue={initial.payment_instructions ?? ""}
          rows={3}
          placeholder="e.g. Please include your order number in the transfer remarks."
          className="w-full px-3 py-2.5 rounded-xl border border-[#2E3344]/10 bg-white text-sm outline-none focus:border-[#27324A] resize-none"
        />
      </Section>

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 hidden" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-[#2E3344]/8 shadow-sm p-5 space-y-3">
      <div>
        <h2 className="font-black text-[#27324A]">{title}</h2>
        {subtitle && (
          <p className="text-xs text-[#746E73] mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-black text-[#27324A] mb-1.5">
        {label}
      </label>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full h-11 px-3 rounded-xl border border-[#2E3344]/10 bg-white text-sm outline-none focus:border-[#27324A]"
      />
    </div>
  );
}
