"use client";

import { useState, useTransition } from "react";
import { X, CheckCircle2, Banknote, QrCode, MapPin, Phone, User, FileText } from "lucide-react";
import type { CartItem } from "./CartDrawer";
import { placeStorefrontOrder } from "@/app/actions/storefront";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  total: number;
  shopId: string;
  shopName: string;
  themeColor: string;
  onSuccess: (orderNumber: string) => void;
}

export function CheckoutModal({ isOpen, onClose, cart, total, shopId, shopName, themeColor, onSuccess }: CheckoutModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "esewa">("cod");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const itemCount = cart.reduce((a, b) => a + b.qty, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await placeStorefrontOrder(shopId, shopName, cart, total, paymentMethod, {
        name, phone, email, address, notes,
      });
      if (result.error) {
        setError(result.error);
      } else {
        onSuccess(result.orderNumber!);
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-black text-gray-900 text-lg">Complete Your Order</h2>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Order Summary */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order Summary</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
            <span className="font-black text-gray-900">Rs. {total.toLocaleString()}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Customer Info */}
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Your Details</p>

            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name *"
                className="w-full h-12 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition"
              />
            </div>

            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone Number *"
                className="w-full h-12 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition"
              />
            </div>

            <div className="relative">
              <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
              <textarea
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Delivery Address *"
                rows={2}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition resize-none"
              />
            </div>

            <div className="relative">
              <FileText className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions (optional)"
                rows={2}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition resize-none"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Payment Method</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("cod")}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition ${
                  paymentMethod === "cod"
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Banknote className="h-5 w-5" />
                <span className="text-xs font-bold">Cash on Delivery</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("esewa")}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition ${
                  paymentMethod === "esewa"
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-gray-200 text-gray-600 hover:border-green-300"
                }`}
              >
                <QrCode className="h-5 w-5" />
                <span className="text-xs font-bold">eSewa</span>
              </button>
            </div>
            {paymentMethod === "esewa" && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-medium">
                eSewa payment link will be sent via SMS after order confirmation.
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-medium">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-60 active:scale-95 transition shadow-lg"
            style={{ backgroundColor: themeColor }}
          >
            {isPending ? "Placing Order..." : `Place Order · Rs. ${total.toLocaleString()}`}
          </button>
        </form>
      </div>
    </div>
  );
}

interface OrderConfirmationProps {
  orderNumber: string;
  shopName: string;
  themeColor: string;
  onClose: () => void;
}

export function OrderConfirmation({ orderNumber, shopName, themeColor, onClose }: OrderConfirmationProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center">
        <div
          className="h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: `${themeColor}20` }}
        >
          <CheckCircle2 className="h-10 w-10" style={{ color: themeColor }} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Order Placed!</h2>
        <p className="text-gray-500 text-sm mb-4">
          Your order from <span className="font-bold text-gray-800">{shopName}</span> has been received.
        </p>
        <div className="bg-gray-50 rounded-2xl p-4 mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Order Number</p>
          <p className="font-black text-gray-900 text-lg">{orderNumber}</p>
          <p className="text-xs text-gray-500 mt-1">Save this for tracking your order</p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl text-white font-bold"
          style={{ backgroundColor: themeColor }}
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
}
