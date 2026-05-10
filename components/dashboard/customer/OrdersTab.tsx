"use client";

import { useEffect, useState } from "react";
import { Barcode, Package } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/lib/types";

import { BarcodeScanner } from "./BarcodeScanner";
import { OrderCard } from "./OrderCard";
import { ReceiptSheet } from "./ReceiptSheet";
import { placeOrder } from "@/app/actions/customer";

type OrderFilter = "active" | "accepted" | "rejected" | "past" | "all";

interface OrdersTabProps {
  userId: string;
  initialOrders: Order[];
}

export function OrdersTab({ userId, initialOrders }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("active");
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Realtime subscription for live order status updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`orders_tab:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
          );
          if (updated.status === "out_for_delivery") {
            toast.success("Your order is on the way! 🛵", { duration: 4000 });
          } else if (updated.status === "delivered") {
            toast.success("Order delivered! Enjoy 🎉", { duration: 5000 });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          setOrders((prev) => [payload.new as Order, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const activeOrders = orders.filter(
    (o) => !["delivered", "cancelled"].includes(o.status)
  );
  const acceptedOrders = orders.filter((o) =>
    ["confirmed", "packing", "out_for_delivery", "delivered"].includes(o.status)
  );
  const rejectedOrders = orders.filter((o) => o.status === "cancelled");
  const pastOrders = orders.filter((o) =>
    ["delivered", "cancelled"].includes(o.status)
  );

  const filteredOrders =
    orderFilter === "active"
      ? activeOrders
      : orderFilter === "accepted"
      ? acceptedOrders
      : orderFilter === "rejected"
      ? rejectedOrders
      : orderFilter === "past"
      ? pastOrders
      : orders;

  const handleOrderFromScan = async (detected: {
    id: string;
    name: string;
    price: string;
    shop: string;
  }) => {
    const price = parseFloat(detected.price.replace(/[^0-9.]/g, "")) || 0;
    const result = await placeOrder({
      shop_name: detected.shop,
      items: [{ name: detected.name, price, quantity: 1 }],
      eta_minutes: 20,
    });
    if (result.error) {
      toast.error(result.error);
    } else if (result.order) {
      setOrders((prev) => [result.order as Order, ...prev]);
      toast.success(`Order placed at ${detected.shop}`);
      setScannerOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ── Orders Bento Header ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Main Stats Card */}
        <div className="md:col-span-8 rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 relative overflow-hidden shadow-sm group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
            <Package className="h-32 w-32 -rotate-12" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-[-0.03em] text-[#27324A]">Your Orders</h2>
            <p className="mt-2 text-sm font-medium text-[#746E73] max-w-sm">
              Keep track of your local shipments and neighborhood essentials.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { label: "Active", count: activeOrders.length, color: "text-[#A7653A] bg-[#F7F0E6]" },
              { label: "Accepted", count: acceptedOrders.length, color: "text-green-600 bg-green-50" },
              { label: "Rejected", count: rejectedOrders.length, color: "text-red-600 bg-red-50" },
            ].map((stat) => (
              <div key={stat.label} className={`px-5 py-2.5 rounded-2xl ${stat.color} flex items-center gap-2.5`}>
                <span className="text-sm font-bold uppercase tracking-wider">{stat.label}</span>
                <span className="text-lg font-black">{stat.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scan & Order Bento */}
        <div className="md:col-span-4 rounded-[2.5rem] bg-[#27324A] p-7 text-white shadow-xl shadow-[#27324A]/10 flex flex-col justify-between group cursor-pointer"
             onClick={() => setScannerOpen(true)}>
          <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
            <Barcode className="h-6 w-6 text-[#D8C99A]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Missing something?</h3>
            <p className="text-xs text-white/60 mt-1 leading-relaxed">
              Scan any barcode to find it nearby and order instantly.
            </p>
          </div>
          <button className="mt-5 w-full py-3 rounded-full bg-[#A7653A] text-xs font-bold uppercase tracking-widest hover:bg-[#8E5432] transition">
            Scan & Order
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#E8E3D1]/40 rounded-3xl w-fit">
        {(["active", "accepted", "rejected", "past", "all"] as OrderFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setOrderFilter(f)}
            className={`rounded-full px-5 py-2 text-xs font-bold capitalize transition ${
              orderFilter === f
                ? "bg-white text-[#27324A] shadow-sm"
                : "text-[#746E73] hover:text-[#27324A]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-[2.5rem] border border-dashed border-[#2E3344]/15 bg-white/50 p-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 grid place-items-center rounded-2xl bg-[#F7F0E6] text-[#A7653A]">
            <Package className="h-8 w-8" />
          </div>
          <p className="text-base font-bold text-[#27324A]">No {orderFilter} orders found</p>
          <p className="mt-1 text-sm text-[#746E73]">
            Start shopping by scanning a product barcode.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isActive={!["delivered", "cancelled"].includes(order.status)}
              onViewReceipt={setReceiptOrder}
            />
          ))}
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onOrderNow={handleOrderFromScan}
      />

      <ReceiptSheet
        order={receiptOrder}
        onClose={() => setReceiptOrder(null)}
      />
    </div>
  );
}
