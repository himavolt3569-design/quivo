"use client";

import { useState, useTransition } from "react";
import { Search, ShoppingBag, Clock, Package, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateOrderStatus } from "@/app/actions/owner";
import {
  RefundModal,
  type RefundOrderContext,
  type RefundableLine,
} from "./RefundModal";

type OrderStatus =
  | "placed"
  | "confirmed"
  | "packing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

interface OrderItem {
  id?: string;
  product_id?: string;
  name: string;
  price: number;
  quantity?: number;
  qty?: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  total_amount: number;
  tax_amount?: number;
  tax_rate?: number;
  items: OrderItem[];
  notes: string | null;
  delivery_address: string | null;
  created_at: string;
}

interface OrderListProps {
  shopId: string;
  initialOrders: Order[];
}

const STATUS_FILTERS = [
  "All",
  "Pending",
  "Processing",
  "Completed",
  "Cancelled",
];

const STATUS_MAP: Record<string, OrderStatus[]> = {
  All: [
    "placed",
    "confirmed",
    "packing",
    "out_for_delivery",
    "delivered",
    "cancelled",
  ],
  Pending: ["placed"],
  Processing: ["confirmed", "packing", "out_for_delivery"],
  Completed: ["delivered"],
  Cancelled: ["cancelled"],
};

const STATUS_BADGE: Record<OrderStatus, { label: string; class: string }> = {
  placed: { label: "New", class: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Confirmed", class: "bg-blue-100 text-blue-800" },
  packing: { label: "Packing", class: "bg-purple-100 text-purple-800" },
  out_for_delivery: {
    label: "Out for Delivery",
    class: "bg-orange-100 text-orange-800",
  },
  delivered: { label: "Delivered", class: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", class: "bg-red-100 text-red-800" },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export function OrderList({ shopId, initialOrders }: OrderListProps) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState(initialOrders);
  const [isPending, startTransition] = useTransition();
  const [refundFor, setRefundFor] = useState<RefundOrderContext | null>(null);

  const buildRefundContext = (order: Order): RefundOrderContext | null => {
    const refundable: RefundableLine[] = (order.items ?? [])
      .map((i) => {
        const productId = i.product_id ?? i.id ?? null;
        if (!productId) return null;
        return {
          product_id: productId,
          name: i.name,
          price: Number(i.price) || 0,
          qty: Number(i.quantity ?? i.qty ?? 0) || 0,
        };
      })
      .filter((l): l is RefundableLine => l !== null && l.qty > 0);
    if (refundable.length === 0) return null;
    return {
      orderId: order.id,
      shopId,
      orderNumber: order.order_number,
      total: Number(order.total_amount) || 0,
      taxAmount: Number(order.tax_amount ?? 0),
      taxRate: Number(order.tax_rate ?? 0),
      items: refundable,
    };
  };

  const filtered = orders.filter((o) => {
    const matchesStatus = STATUS_MAP[filter]?.includes(o.status);
    const matchesSearch =
      !search ||
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.delivery_address?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleStatus = (orderId: string, newStatus: OrderStatus) => {
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, shopId, newStatus);
      if (result.error) {
        toast.error(result.error);
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
        );
        toast.success(
          `Order ${newStatus === "cancelled" ? "rejected" : "accepted"}.`,
        );
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h1 className="text-2xl font-black text-[#27324A]">Online Orders</h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">
          Manage orders from your public storefront.
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar w-full md:w-auto">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                filter === f
                  ? "bg-[#27324A] text-white"
                  : "bg-[#f8f8f7] text-[#746E73] hover:bg-[#F7F0E6]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#746E73]" />
          <Input
            placeholder="Search order ID..."
            className="pl-9 h-11 rounded-xl bg-[#f8f8f7] border-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Empty state */}
      {orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center bg-white rounded-[2rem] border border-[#2E3344]/8">
          <div className="h-16 w-16 rounded-2xl bg-[#F7F0E6] flex items-center justify-center">
            <Package className="h-8 w-8 text-[#A7653A]" />
          </div>
          <h3 className="text-lg font-black text-[#27324A]">No orders yet</h3>
          <p className="text-sm text-[#746E73] font-medium max-w-xs">
            When customers place orders from your storefront, they will appear
            here.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filtered.map((order) => {
          const badge = STATUS_BADGE[order.status];
          const itemSummary =
            order.items
              ?.map((i: OrderItem) => `${i.name} x${i.quantity ?? i.qty ?? 0}`)
              .join(", ") ?? "";
          const canAccept = order.status === "placed";
          const canCancel = !["delivered", "cancelled"].includes(order.status);

          return (
            <div
              key={order.id}
              className="bg-white p-5 rounded-[2rem] border border-[#2E3344]/8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition group"
            >
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-2xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[#746E73] text-xs">
                      {order.order_number}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.class}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#746E73] mt-1 line-clamp-1">
                    {itemSummary}
                  </p>
                  {order.delivery_address && (
                    <p className="text-xs text-[#746E73] mt-0.5 line-clamp-1">
                      📍 {order.delivery_address}
                    </p>
                  )}
                  {order.notes && (
                    <p className="text-xs text-[#746E73] italic mt-0.5 line-clamp-1">
                      &quot;{order.notes}&quot;
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-[#746E73] uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {timeAgo(order.created_at)}
                    </span>
                    <span className="text-[#A7653A] font-black text-sm">
                      Rs. {order.total_amount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-[#2E3344]/5">
                {canAccept && (
                  <Button
                    disabled={isPending}
                    onClick={() => handleStatus(order.id, "confirmed")}
                    className="flex-1 md:w-40 h-10 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white text-xs font-bold"
                  >
                    Accept Order
                  </Button>
                )}
                {order.status === "confirmed" && (
                  <Button
                    disabled={isPending}
                    onClick={() => handleStatus(order.id, "packing")}
                    className="flex-1 md:w-40 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                  >
                    Start Packing
                  </Button>
                )}
                {order.status === "packing" && (
                  <Button
                    disabled={isPending}
                    onClick={() => handleStatus(order.id, "out_for_delivery")}
                    className="flex-1 md:w-40 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold"
                  >
                    Out for Delivery
                  </Button>
                )}
                {order.status === "out_for_delivery" && (
                  <Button
                    disabled={isPending}
                    onClick={() => handleStatus(order.id, "delivered")}
                    className="flex-1 md:w-40 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold"
                  >
                    Mark Delivered
                  </Button>
                )}
                {canCancel && (
                  <Button
                    disabled={isPending}
                    onClick={() => handleStatus(order.id, "cancelled")}
                    variant="outline"
                    className="flex-1 md:w-40 h-10 rounded-xl border-[#2E3344]/10 text-red-500 hover:bg-red-50 hover:border-red-200 text-xs font-bold"
                  >
                    Cancel
                  </Button>
                )}
                {order.status === "delivered" && (
                  <Button
                    disabled={isPending}
                    onClick={() => {
                      const ctx = buildRefundContext(order);
                      if (!ctx) {
                        toast.error(
                          "This order's items aren't linked to products; refund manually.",
                        );
                        return;
                      }
                      setRefundFor(ctx);
                    }}
                    variant="outline"
                    className="flex-1 md:w-40 h-10 rounded-xl border-[#2E3344]/10 text-[#27324A] hover:bg-[#F7F0E6] text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Refund
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {orders.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-[#746E73] font-medium">
          No orders match this filter.
        </div>
      )}

      {refundFor && (
        <RefundModal
          order={refundFor}
          open={true}
          onClose={() => setRefundFor(null)}
          onComplete={() => {
            // The RPC has restocked + recorded the refund; the page revalidates.
            // Reflect status nothing changes locally, but we can flag the order
            // visually if we want — for now, just close the modal.
          }}
        />
      )}
    </div>
  );
}
