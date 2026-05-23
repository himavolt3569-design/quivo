"use client";

import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  maxStock: number;
  image_url: string | null;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQty: (id: string, delta: number) => void;
  onCheckout: () => void;
  themeColor: string;
}

export function CartDrawer({ isOpen, onClose, cart, onUpdateQty, onCheckout, themeColor }: CartDrawerProps) {
  const total = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
  const itemCount = cart.reduce((acc, i) => acc + i.qty, 0);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5" style={{ color: themeColor }} />
            <h2 className="font-bold text-gray-900">
              Your Cart{" "}
              {itemCount > 0 && (
                <span className="ml-1 text-sm font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: themeColor }}>
                  {itemCount}
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <ShoppingBag className="h-16 w-16 opacity-20" />
              <p className="font-medium">Your cart is empty</p>
              <p className="text-sm text-center px-6">Browse products and add items to get started</p>
              <button onClick={onClose} className="mt-4 px-6 py-2.5 rounded-full bg-gray-100 text-gray-900 font-bold text-sm hover:bg-gray-200 transition">
                Continue Shopping
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                {/* Image */}
                <div className="h-14 w-14 rounded-xl bg-white flex items-center justify-center font-bold text-lg text-gray-400 border border-gray-100 shrink-0 overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-gray-300 opacity-50"><ShoppingBag className="h-6 w-6" /></span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 line-clamp-1">{item.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Rs. {item.price} / unit</p>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-end gap-1">
                  <p className="text-sm font-black text-gray-900">Rs. {(item.price * item.qty).toLocaleString()}</p>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-0.5">
                    <button
                      onClick={() => onUpdateQty(item.id, -1)}
                      className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-red-50 transition"
                    >
                      {item.qty === 1 ? (
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 text-gray-500" />
                      )}
                    </button>
                    <span className="text-xs font-black w-5 text-center text-gray-800">{item.qty}</span>
                    <button
                      onClick={() => onUpdateQty(item.id, 1)}
                      disabled={item.qty >= item.maxStock}
                      className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-gray-100 transition disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-gray-100 bg-gray-50">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Subtotal ({itemCount} items)</span>
              <span>Rs. {total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-black text-xl text-gray-900 mb-5">
              <span>Total</span>
              <span>Rs. {total.toLocaleString()}</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-4 rounded-2xl text-white font-bold text-base active:scale-95 transition shadow-lg"
              style={{ backgroundColor: themeColor }}
            >
              Proceed to Checkout →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
