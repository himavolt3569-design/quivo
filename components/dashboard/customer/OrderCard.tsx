"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  CheckCircle2,
  Clock,
  Truck,
  PartyPopper,
  RotateCcw,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { Order, OrderStatus, OrderItem } from "@/lib/types";
import { reorderOrder } from "@/app/actions/reorder";
import { cancelOrder } from "@/app/actions/customer";

const REORDER_KEY = "quivo-reorder";

const TrackingMap = dynamic(
  () => import("./TrackingMap").then((m) => m.TrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[160px] hidden rounded-xl bg-[#F7F0E6]" />
    ),
  },
);

const STATUS_STEPS: Array<{
  key: OrderStatus;
  label: string;
  Icon: React.ElementType;
}> = [
  { key: "placed", label: "Placed", Icon: Package },
  { key: "confirmed", label: "Confirmed", Icon: CheckCircle2 },
  { key: "packing", label: "Packing", Icon: Clock },
  { key: "out_for_delivery", label: "On the way", Icon: Truck },
  { key: "delivered", label: "Delivered", Icon: PartyPopper },
];

function getStepIndex(status: OrderStatus): number {
  if (status === "cancelled") return -1;
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

interface OrderCardProps {
  order: Order;
  isActive?: boolean;
  onViewReceipt: (order: Order) => void;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  shopLat?: number | null;
  shopLng?: number | null;
  compact?: boolean;
}

export function OrderCard({
  order,
  isActive = false,
  onViewReceipt,
  deliveryLat,
  deliveryLng,
  shopLat,
  shopLng,
  compact = false,
}: OrderCardProps) {
  const items = order.items as OrderItem[];
  const stepIndex = getStepIndex(order.status);
  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";
  const isOutForDelivery = order.status === "out_for_delivery";
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const router = useRouter();
  const [isReordering, startReorder] = useTransition();
  const [isCancelling, startCancel] = useTransition();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  // Customers can only cancel before the shop confirms the order.
  const canCancel = order.status === "placed";

  const handleCancel = () => {
    startCancel(async () => {
      const res = await cancelOrder(order.id, cancelReason.trim() || undefined);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Order cancelled. Any payment will be refunded.");
      setConfirmingCancel(false);
      setCancelReason("");
      router.refresh();
    });
  };

  const handleReorder = () => {
    startReorder(async () => {
      const res = await reorderOrder(order.id);
      if (res.error || !res.data) {
        toast.error(res.error ?? "Could not reorder.");
        return;
      }
      try {
        sessionStorage.setItem(REORDER_KEY, JSON.stringify(res.data));
      } catch {
        /* storage full or blocked */
      }
      router.push(`/s/${res.data.shopSlug}`);
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        isCancelled
          ? "border-red-100"
          : isDelivered
            ? "border-green-100"
            : isOutForDelivery
              ? "border-[#A7653A]/20"
              : "border-[#2E3344]/8"
      }`}
    >
      <div className="p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl ${
                isCancelled
                  ? "bg-red-50 text-red-400"
                  : isDelivered
                    ? "bg-green-50 text-green-600"
                    : isOutForDelivery
                      ? "bg-[#F7F0E6] text-[#A7653A]"
                      : "bg-[#E8E3D1] text-[#626A54]"
              }`}
            >
              {isOutForDelivery ? (
                <Truck className="h-5 w-5" />
              ) : (
                <Package className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold leading-tight text-[#27324A]">
                {order.shop_name}
              </h3>
              <p className="mt-0.5 text-xs text-[#746E73]">
                {order.order_number} · {totalItems} item
                {totalItems !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-sm font-bold text-[#27324A]">
              Rs. {order.total_amount.toLocaleString()}
            </p>
            {isActive && !isCancelled && order.eta_minutes ? (
              <p className="mt-0.5 text-xs font-medium text-[#A7653A]">
                ~{order.eta_minutes} min
              </p>
            ) : null}
            {isCancelled && (
              <p className="mt-0.5 text-xs font-medium text-red-500">
                Cancelled
              </p>
            )}
            {isDelivered && !isActive && (
              <p className="mt-0.5 text-xs font-medium text-green-600">
                Delivered
              </p>
            )}
          </div>
        </div>

        {/* Status stepper — active orders only */}
        {isActive && !isCancelled && stepIndex >= 0 && !compact && (
          <div className="mb-4 overflow-hidden">
            <div className="flex items-center">
              {STATUS_STEPS.map((step, i) => (
                <div
                  key={step.key}
                  className="flex flex-1 items-center last:flex-none"
                >
                  <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
                    <motion.div
                      className={`h-2.5 w-2.5 rounded-full transition-colors duration-500 ${
                        i <= stepIndex ? "bg-[#A7653A]" : "bg-[#2E3344]/15"
                      }`}
                      animate={
                        i === stepIndex
                          ? {
                              scale: [1, 1.4, 1],
                              boxShadow: [
                                "0 0 0 0px rgba(167,101,58,0)",
                                "0 0 0 5px rgba(167,101,58,0.2)",
                                "0 0 0 0px rgba(167,101,58,0)",
                              ],
                            }
                          : {}
                      }
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <motion.div
                      className="mx-1.5 h-[2px] flex-1 rounded-full"
                      animate={{
                        backgroundColor:
                          i < stepIndex ? "#A7653A" : "rgba(46,51,68,0.12)",
                      }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex">
              {STATUS_STEPS.map((step, i) => (
                <p
                  key={step.key}
                  className={`flex-1 text-center text-[9px] font-semibold last:flex-none ${
                    i === stepIndex ? "text-[#A7653A]" : "text-[#746E73]/50"
                  }`}
                >
                  {step.label}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Date for past orders */}
        {!isActive && (
          <p className="mb-3 text-xs text-[#746E73]">
            {new Date(order.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}

        {/* Items preview */}
        {items.length > 0 && (
          <p className="mb-4 truncate text-xs leading-relaxed text-[#746E73]">
            {items
              .map(
                (item) =>
                  `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`,
              )
              .join(", ")}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2.5">
          {isActive && !isCancelled && (
            <div className="flex-1 rounded-full bg-[#F7F0E6] px-3 py-2.5 text-center text-xs font-bold text-[#A7653A]">
              {STATUS_STEPS[stepIndex]?.label ?? "Processing"}
            </div>
          )}
          <button
            onClick={() => onViewReceipt(order)}
            className="flex-1 rounded-full border border-[#2E3344]/10 py-2.5 text-xs font-semibold text-[#27324A] transition hover:bg-[#F7F0E6] active:scale-95"
          >
            View receipt
          </button>
          {canCancel && (
            <button
              onClick={() => setConfirmingCancel(true)}
              className="flex-1 rounded-full border border-red-200 py-2.5 text-xs font-bold text-red-500 transition hover:bg-red-50 active:scale-95"
            >
              Cancel
            </button>
          )}
          {(isDelivered || isCancelled) && (
            <button
              onClick={handleReorder}
              disabled={isReordering}
              className="flex-1 rounded-full border border-[#A7653A]/30 bg-[#F7F0E6] py-2.5 text-xs font-bold text-[#A7653A] transition hover:bg-[#A7653A]/15 active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              Reorder
            </button>
          )}
        </div>
      </div>

      {/* Live tracking map — shown when out for delivery */}
      {isOutForDelivery && (
        <div className="border-t border-[#A7653A]/15 px-5 pb-5 pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#A7653A]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#A7653A]" />
            Live tracking
          </p>
          <TrackingMap
            shopName={order.shop_name}
            shopLat={shopLat ?? null}
            shopLng={shopLng ?? null}
            deliveryLat={deliveryLat ?? null}
            deliveryLng={deliveryLng ?? null}
          />
        </div>
      )}

      {/* Cancel confirmation */}
      {confirmingCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-black text-[#27324A]">
                Cancel this order?
              </h3>
              <button
                onClick={() => setConfirmingCancel(false)}
                className="rounded-full p-1 text-[#746E73] hover:bg-[#F7F0E6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-[#746E73]">
              You can only cancel before {order.shop_name} confirms the order.
              Any payment you made is refunded automatically.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Reason (optional)"
              className="mt-3 w-full resize-none rounded-xl border border-[#2E3344]/12 bg-[#f8f8f7] p-3 text-sm outline-none focus:border-[#A7653A]"
            />
            <div className="mt-4 flex gap-3">
              <button
                disabled={isCancelling}
                onClick={() => setConfirmingCancel(false)}
                className="flex-1 rounded-full border border-[#2E3344]/10 py-2.5 text-xs font-bold text-[#27324A] transition hover:bg-[#F7F0E6]"
              >
                Keep order
              </button>
              <button
                disabled={isCancelling}
                onClick={handleCancel}
                className="flex-1 rounded-full bg-red-500 py-2.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {isCancelling ? "Cancelling…" : "Cancel order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
