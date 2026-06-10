import {
  getOrderByNumberWithToken,
  getPublicShopPaymentMethods,
  getOrderCoords,
} from "@/app/actions/payments";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/payments/constants";
import type {
  PaymentMethod,
  PaymentStatus,
  PublicPaymentMethods,
} from "@/lib/payments";
import { ReceiptUploader } from "@/components/storefront/ReceiptUploader";
import { DeliveryMap } from "@/components/storefront/DeliveryMap";
import { ReviewProductsForOrder } from "@/components/storefront/ReviewProductsForOrder";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  MapPin,
} from "lucide-react";

interface OrderViewRow {
  order_id: string;
  order_number: string;
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  status: string;
  total_amount: number;
  items: Array<{
    id?: string;
    name: string;
    price: number;
    qty: number;
    image?: string | null;
  }>;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_id: string | null;
  receipt_url: string | null;
  rejected_reason: string | null;
  created_at: string;
}

type StatusKind = "success" | "pending" | "failed";
function classifyStatus(s: PaymentStatus): StatusKind {
  if (s === "payment_verified" || s === "cod_paid" || s === "refunded")
    return "success";
  if (
    s === "payment_failed" ||
    s === "payment_cancelled" ||
    s === "payment_rejected"
  )
    return "failed";
  return "pending";
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ payment?: string; reason?: string; t?: string }>;
}) {
  const { orderNumber } = await params;
  const {
    payment: paymentParam,
    reason,
    t: trackingToken,
  } = await searchParams;

  const res = trackingToken
    ? await getOrderByNumberWithToken(orderNumber, trackingToken)
    : { error: "Order not found." };
  if (res.error || !res.order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-sm p-8 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-black text-gray-900 mb-1">
            Order Not Found
          </h1>
          <p className="text-sm text-gray-500 mb-4">
            We couldn&apos;t find an order with those tracking details.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const order = res.order as OrderViewRow;
  const kind = classifyStatus(order.payment_status);
  const needsReceipt =
    (order.payment_method === "bank_transfer" ||
      order.payment_method === "qr_code") &&
    order.payment_status === "paid_pending_receipt_upload";

  // Fetch bank/QR details if customer still needs to act on payment.
  let methods: PublicPaymentMethods | null = null;
  if (needsReceipt) {
    const m = await getPublicShopPaymentMethods(order.shop_id);
    methods = m.methods ?? null;
  }

  // Fetch coords for the delivery map (separate RPC; not present until the
  // Phase 3.5 migrations land).
  let coords: Awaited<ReturnType<typeof getOrderCoords>>["coords"] = null;
  if (trackingToken) {
    const c = await getOrderCoords(orderNumber, trackingToken);
    coords = c.coords ?? null;
  }

  // Detect ownership for the review form. RLS lets the customer SELECT
  // their own order row; if the row comes back, they can review.
  let canReview = false;
  if (order.status === "delivered") {
    const supabaseUser = await createClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (user) {
      const { data: ownRow } = await supabaseUser
        .from("orders")
        .select("id")
        .eq("id", order.order_id)
        .eq("customer_id", user.id)
        .maybeSingle();
      canReview = ownRow != null;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <Link
          href={`/s/${order.shop_slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {order.shop_name}
        </Link>

        {/* Hero status card */}
        <div
          className={`rounded-3xl p-6 shadow-sm border ${
            kind === "success"
              ? "bg-green-50 border-green-200"
              : kind === "failed"
                ? "bg-red-50 border-red-200"
                : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
                kind === "success"
                  ? "bg-green-100"
                  : kind === "failed"
                    ? "bg-red-100"
                    : "bg-amber-100"
              }`}
            >
              {kind === "success" ? (
                <CheckCircle2 className="h-6 w-6 text-green-700" />
              ) : kind === "failed" ? (
                <XCircle className="h-6 w-6 text-red-700" />
              ) : (
                <Clock className="h-6 w-6 text-amber-700" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Payment Status
              </p>
              <h1
                className={`text-lg font-black ${
                  kind === "success"
                    ? "text-green-900"
                    : kind === "failed"
                      ? "text-red-900"
                      : "text-amber-900"
                }`}
              >
                {PAYMENT_STATUS_LABELS[order.payment_status] ??
                  order.payment_status}
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                Method:{" "}
                <span className="font-bold">
                  {PAYMENT_METHOD_LABELS[order.payment_method]}
                </span>
              </p>
              {order.rejected_reason && (
                <p className="mt-2 text-xs bg-white/60 rounded-lg px-3 py-2 text-red-900">
                  <span className="font-bold">Reason:</span>{" "}
                  {order.rejected_reason}
                </p>
              )}
              {paymentParam === "failed" && reason && (
                <p className="mt-2 text-xs bg-white/60 rounded-lg px-3 py-2 text-red-900">
                  <span className="font-bold">Gateway:</span>{" "}
                  {reason.replace(/_/g, " ")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Receipt uploader */}
        {needsReceipt && (
          <ReceiptUploader
            orderNumber={order.order_number}
            trackingToken={trackingToken!}
            method={order.payment_method}
            bank={methods}
            total={Number(order.total_amount)}
          />
        )}

        {/* Order summary card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Order
              </p>
              <p className="font-mono font-black text-gray-900">
                {order.order_number}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 uppercase tracking-wide">
              {order.status.replace(/_/g, " ")}
            </span>
          </div>

          <ul className="divide-y divide-gray-100">
            {order.items.map((it, i) => (
              <li key={i} className="px-5 py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">
                    {it.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Qty {it.qty} × Rs. {it.price.toLocaleString()}
                  </p>
                </div>
                <p className="font-black text-sm text-gray-900 shrink-0">
                  Rs. {(it.qty * it.price).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>

          <div className="px-5 py-4 bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">Total</span>
            <span className="text-lg font-black text-gray-900">
              Rs. {Number(order.total_amount).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Customer / delivery */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 space-y-2 text-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
            Delivery
          </p>
          {order.customer_name && (
            <p>
              <span className="text-gray-500">Name:</span>{" "}
              <span className="font-bold text-gray-900">
                {order.customer_name}
              </span>
            </p>
          )}
          {order.customer_phone && (
            <p>
              <span className="text-gray-500">Phone:</span>{" "}
              <span className="font-bold text-gray-900">
                {order.customer_phone}
              </span>
            </p>
          )}
          {order.delivery_address && (
            <p>
              <span className="text-gray-500">Address:</span>{" "}
              <span className="font-bold text-gray-900">
                {order.delivery_address}
              </span>
            </p>
          )}
        </div>

        {/* Reviews — only the order's customer, only after delivery */}
        {canReview && (
          <ReviewProductsForOrder
            orderId={order.order_id}
            items={order.items}
          />
        )}

        {/* Delivery map */}
        {coords &&
          ((coords.delivery_lat != null && coords.delivery_lng != null) ||
            (coords.shop_lat != null && coords.shop_lng != null)) && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#A7653A]" />
                <p className="text-xs font-black uppercase tracking-wider text-gray-500">
                  Delivery location
                </p>
                {coords.delivery_lat == null && (
                  <span className="ml-auto text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    Customer didn&apos;t pin a location
                  </span>
                )}
              </div>
              <div className="p-3">
                <DeliveryMap
                  shopLat={coords.shop_lat}
                  shopLng={coords.shop_lng}
                  shopName={coords.shop_name ?? order.shop_name}
                  deliveryLat={coords.delivery_lat}
                  deliveryLng={coords.delivery_lng}
                  deliveryAddress={
                    coords.delivery_address ?? order.delivery_address ?? null
                  }
                  className="w-full h-[320px]"
                />
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
