"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  X, CheckCircle2, Banknote, QrCode, MapPin, Phone, User, FileText,
  Smartphone, Building2, Copy, Check, Loader2, ExternalLink,
} from "lucide-react";
import type { CartItem } from "./CartDrawer";
import { placeOrderWithPayment, getPublicShopPaymentMethods } from "@/app/actions/payments";
import type { PaymentMethod, PublicPaymentMethods } from "@/lib/payments";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_DESCRIPTIONS } from "@/lib/payments/constants";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  total: number;
  shopId: string;
  shopName: string;
  themeColor: string;
  onSuccess: (orderNumber: string, trackingToken: string) => void;
}

const METHOD_ICONS: Record<PaymentMethod, React.ComponentType<{ className?: string }>> = {
  cod:           Banknote,
  esewa:         Smartphone,
  khalti:        Smartphone,
  bank_transfer: Building2,
  qr_code:       QrCode,
};

const METHOD_ACCENTS: Record<PaymentMethod, string> = {
  cod:           "border-amber-500 bg-amber-500 text-white",
  esewa:         "border-green-600 bg-green-600 text-white",
  khalti:        "border-purple-600 bg-purple-600 text-white",
  bank_transfer: "border-blue-600 bg-blue-600 text-white",
  qr_code:       "border-pink-600 bg-pink-600 text-white",
};

function Copyable({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ }
      }}
      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition text-left"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="font-mono font-bold text-sm text-gray-900 truncate">{value}</p>
      </div>
      {copied
        ? <Check className="h-4 w-4 text-green-600 shrink-0" />
        : <Copy className="h-4 w-4 text-gray-400 shrink-0" />}
    </button>
  );
}

export function CheckoutModal({
  isOpen, onClose, cart, total, shopId, shopName, themeColor, onSuccess,
}: CheckoutModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [methods, setMethods] = useState<PublicPaymentMethods | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const formPostRef = useRef<HTMLFormElement>(null);

  const itemCount = cart.reduce((a, b) => a + b.qty, 0);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingMethods(true);
    getPublicShopPaymentMethods(shopId).then((res) => {
      if (cancelled) return;
      if (res.methods) {
        setMethods(res.methods);
        // Pick the first enabled method that the shop actually supports.
        const first = res.methods.enabled_methods[0];
        if (first) setPaymentMethod(first);
      }
      setLoadingMethods(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, shopId]);

  const availableMethods: PaymentMethod[] = useMemo(() => {
    if (!methods) return ["cod"];
    return methods.enabled_methods.filter((m) => {
      if (m === "esewa")  return methods.has_esewa;
      if (m === "khalti") return methods.has_khalti;
      if (m === "bank_transfer") return !!methods.bank_account_number;
      if (m === "qr_code")       return !!methods.qr_code_url;
      return true;
    });
  }, [methods]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await placeOrderWithPayment(shopId, shopName, cart, paymentMethod, {
        name, phone, email, address, notes,
      });
      if (result.error || !result.orderNumber) {
        setError(result.error ?? "Failed to place order.");
        return;
      }

      // eSewa form-POST: build hidden form and submit to the gateway.
      if (result.redirectMethod === "POST" && result.redirectUrl && result.formFields) {
        const form = formPostRef.current!;
        form.action = result.redirectUrl;
        form.method = "POST";
        form.innerHTML = "";
        for (const [k, v] of Object.entries(result.formFields)) {
          const input = document.createElement("input");
          input.type = "hidden"; input.name = k; input.value = v;
          form.appendChild(input);
        }
        form.submit();
        return;
      }

      // Khalti GET-redirect or offline → /order/{number}
      if (result.redirectUrl) {
        const target = result.redirectUrl.startsWith("http")
          ? result.redirectUrl
          : result.redirectUrl;
        window.location.href = target;
        return;
      }

      onSuccess(result.orderNumber, result.trackingToken ?? "");
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <form ref={formPostRef} className="hidden" />

      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-black text-gray-900 text-lg">Complete Your Order</h2>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order Summary</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
            <span className="font-black text-gray-900">Rs. {total.toLocaleString()}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Customer details */}
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Your Details</p>

            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name *"
                className="w-full h-12 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition" />
            </div>

            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone Number *"
                className="w-full h-12 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition" />
            </div>

            <div className="relative">
              <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
              <textarea required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery Address *" rows={2}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition resize-none" />
            </div>

            <div className="relative">
              <FileText className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions (optional)" rows={2}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition resize-none" />
            </div>
          </div>

          {/* Payment method selector */}
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Payment Method</p>

            {loadingMethods ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : availableMethods.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 font-medium">
                This shop has not configured any payment method yet. Please contact them directly.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {availableMethods.map((m) => {
                  const Icon = METHOD_ICONS[m];
                  const active = paymentMethod === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl border-2 transition ${
                        active ? METHOD_ACCENTS[m] : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-bold leading-tight text-center">{PAYMENT_METHOD_LABELS[m]}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Method-specific details */}
            {paymentMethod === "cod" && availableMethods.includes("cod") && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 font-medium">
                {PAYMENT_METHOD_DESCRIPTIONS.cod} You can pay in cash when the order arrives.
              </p>
            )}

            {paymentMethod === "esewa" && availableMethods.includes("esewa") && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 font-medium">
                {PAYMENT_METHOD_DESCRIPTIONS.esewa}
              </p>
            )}

            {paymentMethod === "khalti" && availableMethods.includes("khalti") && (
              <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2.5 font-medium">
                {PAYMENT_METHOD_DESCRIPTIONS.khalti}
              </p>
            )}

            {paymentMethod === "bank_transfer" && availableMethods.includes("bank_transfer") && methods && (
              <div className="space-y-2.5 bg-blue-50 border border-blue-200 rounded-2xl p-3">
                <p className="text-xs font-bold text-blue-900 leading-snug">
                  Transfer Rs. {total.toLocaleString()} to the account below, then upload your receipt on the order tracking page.
                </p>
                <div className="space-y-1.5">
                  {methods.bank_name           && <Copyable label="Bank"     value={methods.bank_name} />}
                  {methods.bank_account_holder && <Copyable label="Holder"   value={methods.bank_account_holder} />}
                  {methods.bank_account_number && <Copyable label="Account #" value={methods.bank_account_number} />}
                  {methods.bank_branch         && <Copyable label="Branch"   value={methods.bank_branch} />}
                  {methods.bank_swift_code     && <Copyable label="SWIFT"    value={methods.bank_swift_code} />}
                </div>
                {methods.payment_instructions && (
                  <p className="text-[11px] text-blue-800 whitespace-pre-wrap">{methods.payment_instructions}</p>
                )}
              </div>
            )}

            {paymentMethod === "qr_code" && availableMethods.includes("qr_code") && methods?.qr_code_url && (
              <div className="space-y-2.5 bg-pink-50 border border-pink-200 rounded-2xl p-3 text-center">
                <p className="text-xs font-bold text-pink-900">
                  Scan this QR with any banking or wallet app, then upload your receipt on the order tracking page.
                </p>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={methods.qr_code_url} alt="Payment QR" className="h-48 w-48 rounded-xl border border-pink-200 bg-white object-contain" />
                </div>
                {methods.payment_instructions && (
                  <p className="text-[11px] text-pink-800 whitespace-pre-wrap text-left">{methods.payment_instructions}</p>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || availableMethods.length === 0}
            className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-60 active:scale-95 transition shadow-lg flex items-center justify-center gap-2"
            style={{ backgroundColor: themeColor }}
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
            ) : (paymentMethod === "esewa" || paymentMethod === "khalti") ? (
              <>Pay Rs. {total.toLocaleString()} with {PAYMENT_METHOD_LABELS[paymentMethod]}<ExternalLink className="h-4 w-4" /></>
            ) : (
              <>Place Order · Rs. {total.toLocaleString()}</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

interface OrderConfirmationProps {
  orderNumber: string;
  trackingToken: string;
  shopName: string;
  themeColor: string;
  onClose: () => void;
}

export function OrderConfirmation({ orderNumber, trackingToken, shopName, themeColor, onClose }: OrderConfirmationProps) {
  const trackingHref = `/order/${orderNumber}?t=${trackingToken}`;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center">
        <div className="h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: `${themeColor}20` }}>
          <CheckCircle2 className="h-10 w-10" style={{ color: themeColor }} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Order Placed!</h2>
        <p className="text-gray-500 text-sm mb-4">
          Your order from <span className="font-bold text-gray-800">{shopName}</span> has been received.
        </p>
        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Order Number</p>
          <p className="font-black text-gray-900 text-lg">{orderNumber}</p>
          <p className="text-xs text-gray-500 mt-1">Save this for tracking your order</p>
        </div>
        <a
          href={trackingHref}
          className="block w-full py-3 rounded-2xl text-white font-bold mb-2"
          style={{ backgroundColor: themeColor }}
        >
          Track Order
        </a>
        <button onClick={onClose} className="w-full py-2.5 rounded-2xl text-gray-700 font-bold bg-gray-100 hover:bg-gray-200 transition">
          Continue Shopping
        </button>
      </div>
    </div>
  );
}
