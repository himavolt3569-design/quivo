"use client";

import { useMemo, useState, useTransition } from "react";
import { X, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createRefund } from "@/app/actions/refunds";

export interface RefundableLine {
  /** Product UUID, required for inventory restore. */
  product_id: string;
  name: string;
  price: number;
  qty: number;
}

export interface RefundOrderContext {
  orderId: string;
  shopId: string;
  orderNumber: string;
  taxAmount?: number;
  taxRate?: number;
  /** Total of the order — used to ratio tax refunded. */
  total: number;
  items: RefundableLine[];
}

interface RefundModalProps {
  order: RefundOrderContext;
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface LineState {
  refundQty: number;
  selected: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function RefundModal({ order, open, onClose, onComplete }: RefundModalProps) {
  const [state, setState] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(order.items.map((l) => [l.product_id, { refundQty: l.qty, selected: false }]))
  );
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const lines = useMemo(() => {
    return order.items.map((l) => {
      const s = state[l.product_id];
      return { ...l, selected: !!s?.selected, refundQty: s?.refundQty ?? l.qty };
    });
  }, [order.items, state]);

  const selectedLines = lines.filter((l) => l.selected && l.refundQty > 0);
  const refundSubtotal = round2(selectedLines.reduce((a, l) => a + l.price * l.refundQty, 0));

  // Pro-rate tax refunded by the fraction of the order being refunded.
  const taxRefunded = useMemo(() => {
    if (!order.taxAmount || order.total <= 0 || refundSubtotal <= 0) return 0;
    const fraction = Math.min(1, refundSubtotal / order.total);
    return round2(order.taxAmount * fraction);
  }, [order.taxAmount, order.total, refundSubtotal]);

  const refundTotal = round2(refundSubtotal + taxRefunded);

  const canSubmit = !isPending && selectedLines.length > 0 && reason.trim().length >= 2 && refundTotal > 0;

  if (!open) return null;

  const toggle = (id: string) => {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], selected: !prev[id]?.selected } }));
  };

  const updateQty = (id: string, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(qty, max));
    setState((prev) => ({ ...prev, [id]: { ...prev[id], refundQty: clamped } }));
  };

  const submit = () => {
    startTransition(async () => {
      const res = await createRefund({
        shopId: order.shopId,
        orderId: order.orderId,
        items: selectedLines.map((l) => ({
          product_id: l.product_id,
          qty: l.refundQty,
          line_amount: round2(l.price * l.refundQty),
        })),
        reason: reason.trim(),
        taxRefunded,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Refund processed");
      onComplete?.();
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-modal-title"
    >
      <div className="bg-white rounded-[2rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-[#27324A] to-[#1b2333] p-6 text-white flex items-start justify-between gap-4">
          <div>
            <h2 id="refund-modal-title" className="font-black text-xl flex items-center gap-2">
              <RotateCcw className="h-5 w-5" /> Refund order
            </h2>
            <p className="text-white/70 text-sm mt-1">{order.orderNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex items-start gap-3 bg-[#F7F0E6]/60 rounded-2xl p-4 border border-[#A7653A]/15">
            <AlertTriangle className="h-5 w-5 text-[#A7653A] shrink-0 mt-0.5" />
            <p className="text-xs text-[#27324A] leading-relaxed">
              Selected items will be restocked and the refund amount will be subtracted from this shop&apos;s finance dashboard.
              This action is irreversible.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-[#746E73] mb-2">Pick lines to refund</h3>
            <ul className="space-y-2">
              {lines.length === 0 ? (
                <li className="text-sm text-[#746E73] italic">
                  This order&apos;s items are not linked to product IDs and cannot be refunded automatically. Process manually in finances.
                </li>
              ) : (
                lines.map((l) => (
                  <li
                    key={l.product_id}
                    className={`rounded-2xl border px-4 py-3 transition ${
                      l.selected ? "border-[#27324A] bg-[#f8f8f7]" : "border-[#2E3344]/10 hover:bg-[#f8f8f7]/50"
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={l.selected}
                        onChange={() => toggle(l.product_id)}
                        className="h-4 w-4 mt-1 accent-[#27324A]"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between gap-3">
                          <p className="text-sm font-bold text-[#27324A]">{l.name}</p>
                          <p className="text-xs text-[#746E73]">Rs. {l.price.toFixed(2)} × {l.qty}</p>
                        </div>
                        {l.selected && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">Refund qty</span>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.001"
                              min={0}
                              max={l.qty}
                              value={l.refundQty}
                              onChange={(e) => updateQty(l.product_id, Number(e.target.value) || 0, l.qty)}
                              className="h-9 w-28 text-sm rounded-xl"
                            />
                            <span className="text-[10px] text-[#746E73]">of {l.qty}</span>
                            <span className="ml-auto text-sm font-bold text-[#27324A]">
                              Rs. {round2(l.price * l.refundQty).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-widest text-[#746E73] mb-2 block">Reason</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. damaged on arrival, wrong item shipped"
              className="rounded-2xl resize-none"
            />
          </div>

          <div className="rounded-2xl bg-[#27324A] text-white p-4 space-y-1">
            <div className="flex justify-between text-xs text-white/70">
              <span>Items subtotal</span>
              <span>Rs. {refundSubtotal.toFixed(2)}</span>
            </div>
            {taxRefunded > 0 && (
              <div className="flex justify-between text-xs text-white/70">
                <span>VAT refunded (pro-rated)</span>
                <span>Rs. {taxRefunded.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black pt-1 border-t border-white/10">
              <span>Refund total</span>
              <span>Rs. {refundTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 h-12 rounded-2xl border border-[#2E3344]/10 font-bold text-[#27324A] hover:bg-[#f8f8f7]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Processing…
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" /> Refund Rs. {refundTotal.toFixed(2)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
