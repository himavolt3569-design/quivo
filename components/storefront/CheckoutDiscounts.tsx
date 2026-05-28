"use client";

import { useEffect, useState, useTransition } from "react";
import { Ticket, Wallet, Check, X } from "lucide-react";

import { previewPromoCode, type PromoPreview } from "@/app/actions/promo";
import { getMyWalletBalance, getWalletRedeemMax } from "@/app/actions/wallet";

interface Props {
  shopId: string;
  subtotal: number;
  /** Caller is responsible for lifting state. */
  onPromoChange: (next: PromoPreview | null) => void;
  onWalletChange: (rupees: number) => void;
}

/**
 * Two compact rows on the checkout summary: a coupon entry and a wallet
 * slider. Both are optional and silent if unavailable. Server actions
 * do the heavy lifting; this component is purely UI + lifted state.
 */
export function CheckoutDiscounts({ shopId, subtotal, onPromoChange, onWalletChange }: Props) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<PromoPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [balance, setBalance] = useState<number>(0);
  const [walletMax, setWalletMax] = useState<number>(0);
  const [walletUsed, setWalletUsed] = useState<number>(0);

  // Refresh wallet ceiling whenever the discounted subtotal changes (so the
  // slider re-anchors after a promo lands).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bal = await getMyWalletBalance();
      if (cancelled) return;
      setBalance(bal.balance);
      if (!(subtotal > 0)) { setWalletMax(0); return; }
      const sub = Math.max(0, subtotal - (applied?.discount ?? 0));
      const m = await getWalletRedeemMax(shopId, sub);
      if (cancelled) return;
      setWalletMax(m.max);
      setWalletUsed((cur) => Math.min(cur, m.max));
    })();
    return () => { cancelled = true; };
  }, [shopId, subtotal, applied]);

  useEffect(() => { onPromoChange(applied); }, [applied, onPromoChange]);
  useEffect(() => { onWalletChange(walletUsed); }, [walletUsed, onWalletChange]);

  const apply = () => {
    if (!code.trim() || !(subtotal > 0)) return;
    startTransition(async () => {
      setError(null);
      const res = await previewPromoCode({ shopId, code: code.trim(), subtotal });
      if (res.error) { setError(res.error); setApplied(null); return; }
      setApplied(res.preview ?? null);
    });
  };

  const clear = () => { setApplied(null); setCode(""); setError(null); };

  return (
    <div className="space-y-2 px-5 py-3 bg-white border-b border-gray-100">
      {/* Promo code */}
      <div className="flex items-center gap-2">
        <Ticket className="h-4 w-4 text-[#A7653A] shrink-0" />
        {applied ? (
          <div className="flex-1 flex items-center justify-between gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2">
            <span className="text-xs font-bold text-green-800">
              <Check className="h-3 w-3 inline mb-0.5 mr-1" /> {applied.code} applied — −Rs. {applied.discount.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={clear}
              className="h-6 w-6 rounded-full bg-white border border-green-200 flex items-center justify-center"
              aria-label="Remove promo code"
            >
              <X className="h-3 w-3 text-green-700" />
            </button>
          </div>
        ) : (
          <>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 40))}
              placeholder="Promo code"
              className="flex-1 h-9 rounded-xl border border-black/10 px-3 text-xs font-bold tracking-wide"
            />
            <button
              type="button"
              onClick={apply}
              disabled={isPending || !code.trim()}
              className="h-9 px-3 rounded-xl bg-[#27324A] text-white text-xs font-bold disabled:opacity-40"
            >
              Apply
            </button>
          </>
        )}
      </div>
      {error && <p className="text-[11px] text-red-700 font-bold pl-6">{error}</p>}

      {/* Wallet redemption — only when there's something to spend */}
      {walletMax > 0 && (
        <div className="rounded-xl bg-[#F7F0E6] px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#27324A] inline-flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-[#A7653A]" /> Pay with wallet
            </span>
            <span className="text-[#746E73]">Balance: Rs. {balance.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={0}
            max={walletMax}
            step={1}
            value={walletUsed}
            onChange={(e) => setWalletUsed(Math.min(walletMax, Math.max(0, Number(e.target.value))))}
            className="w-full accent-[#A7653A]"
          />
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-[#746E73]">Use Rs. {walletUsed.toLocaleString()}</span>
            <span className="text-[#A7653A]">Max Rs. {walletMax.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
