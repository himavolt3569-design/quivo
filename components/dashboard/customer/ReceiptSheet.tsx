"use client";

import { MapPin, Store } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Order, OrderItem } from "@/lib/types";

interface ReceiptSheetProps {
  order: Order | null;
  onClose: () => void;
}

export function ReceiptSheet({ order, onClose }: ReceiptSheetProps) {
  return (
    <Sheet open={!!order} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="border-none bg-[#f8f8f7] px-0 pb-8 max-h-[85vh] overflow-y-auto rounded-t-[2rem]"
      >
        {order && (
          <>
            <SheetHeader className="border-b border-[#2E3344]/8 px-6 pb-4">
              <SheetTitle className="text-lg font-bold text-[#27324A]">
                Receipt
              </SheetTitle>
              <p className="text-xs font-medium text-[#746E73]">
                {order.order_number} ·{" "}
                {new Date(order.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </SheetHeader>

            <div className="space-y-5 px-6 pt-5">
              {/* Shop */}
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-[#E8E3D1] text-[#626A54]">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#27324A]">
                    {order.shop_name}
                  </p>
                  <p className="mt-0.5 text-xs capitalize text-[#746E73]">
                    {order.status.replace(/_/g, " ")}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="overflow-hidden rounded-2xl border border-[#2E3344]/8 bg-white">
                <div className="border-b border-[#2E3344]/6 px-4 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#746E73]">
                    Items
                  </p>
                </div>
                {(order.items as OrderItem[]).map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-[#2E3344]/6 px-4 py-3 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#27324A]">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[#746E73]">
                        {item.quantity > 1 ? `×${item.quantity}` : "×1"} · Rs.{" "}
                        {item.price.toLocaleString()} each
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[#27324A]">
                      Rs. {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {order.notes && (
                <div className="rounded-2xl border border-[#2E3344]/8 bg-white px-4 py-3">
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#746E73]">
                    Note
                  </p>
                  <p className="text-sm text-[#27324A]">{order.notes}</p>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between rounded-2xl bg-[#27324A] px-5 py-4 text-white">
                <p className="text-sm font-semibold text-white/80">Total paid</p>
                <p className="text-xl font-bold">
                  Rs. {order.total_amount.toLocaleString()}
                </p>
              </div>

              {/* Delivery address */}
              {order.delivery_address && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-[#2E3344]/8 bg-white px-4 py-3">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#A7653A]" />
                  <div>
                    <p className="mb-0.5 text-xs font-bold uppercase tracking-widest text-[#746E73]">
                      Delivered to
                    </p>
                    <p className="text-sm text-[#27324A]">
                      {order.delivery_address}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
