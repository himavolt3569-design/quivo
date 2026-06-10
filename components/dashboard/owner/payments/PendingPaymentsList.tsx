"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  XCircle,
  Banknote,
  Smartphone,
  Building2,
  QrCode,
  Loader2,
  ExternalLink,
  FileText,
} from "lucide-react";
import {
  verifyPayment,
  rejectPayment,
  markCodPaid,
  getReceiptSignedUrl,
} from "@/app/actions/payment-config";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments/constants";
import type { PaymentMethod, PaymentStatus } from "@/lib/payments";
import { toast } from "sonner";

interface PaymentRow {
  id: string;
  order_id: string;
  shop_id: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount: number;
  receipt_url: string | null;
  rejected_reason: string | null;
  created_at: string;
  orders: {
    order_number: string;
    customer_name: string | null;
    customer_phone: string | null;
  } | null;
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

export function PendingPaymentsList({ payments }: { payments: PaymentRow[] }) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!payments.length) {
    return (
      <div className="px-5 py-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-300 mx-auto mb-2" />
        <p className="text-sm font-bold text-[#27324A]">
          No payments awaiting verification.
        </p>
        <p className="text-xs text-[#746E73] mt-1">
          You&apos;re all caught up.
        </p>
      </div>
    );
  }

  function handleVerify(p: PaymentRow) {
    startTransition(async () => {
      const res =
        p.payment_method === "cod"
          ? await markCodPaid(p.id)
          : await verifyPayment(p.id);
      if (res.error) toast.error(res.error);
      else toast.success("Payment verified.");
    });
  }

  function handleSubmitReject(p: PaymentRow) {
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }
    startTransition(async () => {
      const res = await rejectPayment(p.id, rejectReason);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Payment rejected.");
      setRejectingId(null);
      setRejectReason("");
    });
  }

  async function openReceipt(path: string) {
    const res = await getReceiptSignedUrl(path);
    if (res.error || !res.url) {
      toast.error(res.error ?? "Could not open receipt.");
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  return (
    <ul className="divide-y divide-[#2E3344]/8">
      {payments.map((p) => {
        const Icon = METHOD_ICONS[p.payment_method];
        const isRejecting = rejectingId === p.id;
        return (
          <li key={p.id} className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#F7F0E6] flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-[#A7653A]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-black text-[#27324A] text-sm truncate">
                    {p.orders?.order_number ?? "—"} ·{" "}
                    {PAYMENT_METHOD_LABELS[p.payment_method]}
                  </p>
                  <p className="font-black text-[#27324A] shrink-0">
                    Rs. {Number(p.amount).toLocaleString()}
                  </p>
                </div>
                <p className="text-xs text-[#746E73] mt-0.5 truncate">
                  {p.orders?.customer_name ?? "Anonymous"}
                  {p.orders?.customer_phone && (
                    <> · {p.orders.customer_phone}</>
                  )}
                </p>
                <p className="text-[10px] text-[#746E73] mt-0.5">
                  {new Date(p.created_at).toLocaleString()}
                </p>

                {p.receipt_url && (
                  <button
                    type="button"
                    onClick={() => openReceipt(p.receipt_url!)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#A7653A] hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" /> View receipt{" "}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}

                {isRejecting ? (
                  <div className="mt-3 space-y-2">
                    <input
                      autoFocus
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Why are you rejecting this payment?"
                      className="w-full h-10 px-3 rounded-xl border border-red-200 bg-red-50 text-sm font-medium outline-none focus:border-red-400"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSubmitReject(p)}
                        className="flex-1 h-9 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Confirm Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                        className="px-3 h-9 rounded-xl bg-gray-100 text-xs font-bold text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleVerify(p)}
                      className="h-9 px-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {p.payment_method === "cod"
                        ? "Mark Cash Received"
                        : "Verify"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(p.id);
                        setRejectReason("");
                      }}
                      className="h-9 px-3.5 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
