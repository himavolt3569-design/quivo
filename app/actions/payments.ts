"use server";

/**
 * Customer-facing payment server actions.
 *
 * - placeOrderWithPayment: replaces placeStorefrontOrder. Atomically creates
 *   an order + payment row via place_order_with_payment RPC, and for
 *   esewa/khalti calls the gateway initiator (server-side secret read).
 * - uploadReceiptForOrder: anon-safe upload to the private payment_receipts
 *   bucket + binds the URL to the payment via attach_payment_receipt RPC.
 * - getOrderByNumber: anon-safe tracking lookup.
 * - getPublicShopPaymentMethods: anon-safe; returns enabled methods +
 *   bank/QR display fields; NEVER returns secrets.
 *
 * SECURITY:
 *   - Total amount is RECOMPUTED from cart prices server-side; the caller's
 *     `total` value is ignored. This prevents amount-tampering before payment
 *     redirect.
 *   - Gateway secrets are read only via the service-role admin client, never
 *     surfaced to the browser or to a logged-in user.
 *   - transaction_reference is generated server-side with crypto.randomUUID(),
 *     unique per shop, so gateway callbacks cannot cross shops.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/security";
import { checkRateLimit } from "@/lib/rate-limit";
import { emitBackground } from "@/lib/events/emit";
import { initiatePaymentProvider } from "@/lib/payments";
import type {
  InitiateContext, InitiateResult, PaymentMethod, PaymentSecrets, PublicPaymentMethods,
} from "@/lib/payments";
import { PAYMENT_METHODS } from "@/lib/payments/constants";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PhoneSchema, OptionalEmailSchema, PersonNameSchema, AddressSchema as AddressTextSchema, OptionalShortText } from "@/lib/validation";

interface CartItemInput {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface CustomerInfo {
  name: string;
  phone: string;
  email?: string;
  address: string;
  notes?: string;
  /** Customer-picked drop coords (optional but strongly preferred for delivery accuracy). */
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}

export interface PlaceOrderResult {
  error?: string;
  orderNumber?: string;
  trackingToken?: string;
  paymentId?: string;
  redirectUrl?: string;
  redirectMethod?: "GET" | "POST";
  formFields?: Record<string, string>;
  /** Authoritative server-side money breakdown (post-Phase 1). */
  pricing?: {
    subtotal: number;
    taxAmount: number;
    deliveryFee: number;
    serviceCharge: number;
    total: number;
  };
}

const ShopIdSchema = z.string().uuid();
const CartSchema = z.array(z.object({
  id: z.string().uuid(),
  name: z.string().trim().max(200).optional(),
  price: z.coerce.number().min(0).max(10000000).optional(),
  qty: z.coerce.number().positive().max(99),
})).min(1).max(50);
const CustomerSchema = z.object({
  name: PersonNameSchema,
  phone: PhoneSchema,
  email: OptionalEmailSchema,
  address: AddressTextSchema,
  notes: OptionalShortText(1000, "Notes"),
  deliveryLat: z.coerce.number().min(-90).max(90).nullable().optional(),
  deliveryLng: z.coerce.number().min(-180).max(180).nullable().optional(),
});
const OrderNumberSchema = z.string().trim().min(6).max(80);
const TrackingTokenSchema = z.string().trim().regex(/^[a-f0-9]{48}$/i, "Invalid tracking token.");

type CreatedPaymentRow = {
  order_id: string;
  payment_id: string;
  order_number: string;
  tracking_token: string;
  subtotal: number;
  tax_amount: number;
  delivery_fee: number;
  service_charge: number;
  total_amount: number;
};

function isPaymentMethod(v: string): v is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(v);
}

/** Generate a short, human-friendly order number. */
function newOrderNumber(): string {
  return `QVO-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

async function failPaymentAndRestoreStock(paymentId: string, reason: string) {
  try {
    const admin = createAdminClient();
    await admin.rpc("fail_payment_and_restore_stock", {
      p_payment_id: paymentId,
      p_reason: reason.slice(0, 500),
    });
  } catch {
    try {
      const admin = createAdminClient();
      const { data: payment } = await admin
        .from("payments")
        .select("order_id")
        .eq("id", paymentId)
        .maybeSingle<{ order_id: string }>();
      await admin
        .from("payments")
        .update({
          payment_status: "payment_failed",
          gateway_response: { reason: reason.slice(0, 500), stock_restore: "rpc_unavailable" },
        })
        .eq("id", paymentId)
        .eq("payment_status", "payment_initiated");
      if (payment?.order_id) {
        await admin
          .from("orders")
          .update({ payment_status: "payment_failed" })
          .eq("id", payment.order_id)
          .eq("payment_status", "payment_initiated");
      }
    } catch {
      // Best effort only. The customer-facing path still returns the gateway
      // initiation error, while operators can reconcile from payment audit logs.
    }
  }
}

function hasValidReceiptSignature(bytes: Uint8Array, mime: string) {
  if (mime === "application/pdf") {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  if (mime === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mime === "image/webp") {
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return false;
}

export async function placeOrderWithPayment(
  shopId: string,
  shopName: string,
  cart: CartItemInput[],
  paymentMethod: string,
  customer: CustomerInfo,
  options: { promoCode?: string | null; walletUsed?: number } = {}
): Promise<PlaceOrderResult> {
  const rateLimit = await checkRateLimit("placeOrderWithPayment", { maxAttempts: 10, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.success) return { error: rateLimit.error };

  const shopParse = ShopIdSchema.safeParse(shopId);
  if (!shopParse.success) return { error: "Invalid shop." };
  const cartParse = CartSchema.safeParse(cart);
  if (!cartParse.success) return { error: cartParse.error.issues[0].message };
  const customerParse = CustomerSchema.safeParse(customer);
  if (!customerParse.success) return { error: customerParse.error.issues[0].message };
  if (!isPaymentMethod(paymentMethod)) return { error: "Invalid payment method." };

  // Display-only estimate. The database recomputes the authoritative total
  // from locked product rows and ignores this value for billing.
  let total = 0;
  for (const item of cartParse.data) total += Number(item.price ?? 0) * Number(item.qty);
  total = Math.round(total * 100) / 100;

  const supabase = await createClient();
  const orderNumber = newOrderNumber();
  const transactionReference = randomUUID();

  const walletUsed = Math.max(0, Math.round(Number(options.walletUsed ?? 0) * 100) / 100);
  const promoCode = options.promoCode?.trim() || null;

  const { data, error } = await supabase
    .rpc("place_order_with_payment", {
      p_shop_id: shopParse.data,
      p_shop_name: shopName,
      p_order_number: orderNumber,
      p_customer_name: customerParse.data.name,
      p_customer_phone: customerParse.data.phone,
      p_customer_email: customerParse.data.email || null,
      p_delivery_address: customerParse.data.address,
      p_items: cartParse.data.map((item) => ({ id: item.id, qty: item.qty })),
      p_total_amount: total,
      p_payment_method: paymentMethod,
      p_transaction_reference: transactionReference,
      p_notes: customerParse.data.notes || null,
      p_delivery_lat: customerParse.data.deliveryLat ?? null,
      p_delivery_lng: customerParse.data.deliveryLng ?? null,
      p_promo_code: promoCode,
      p_wallet_used: walletUsed,
    })
    .single<CreatedPaymentRow>();

  if (error) {
    if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
      const name = error.message.slice("INSUFFICIENT_STOCK:".length);
      return { error: `"${name}" is no longer available in the requested quantity.` };
    }
    if (error.message.startsWith("PAYMENT_METHOD_DISABLED:")) {
      const m = error.message.slice("PAYMENT_METHOD_DISABLED:".length);
      return { error: `Payment method "${m}" is not enabled for this shop.` };
    }
    if (error.message.startsWith("MIN_SUBTOTAL:")) {
      const m = error.message.slice("MIN_SUBTOTAL:".length);
      return { error: `Promo code requires a minimum subtotal of Rs. ${m}.` };
    }
    if (error.message.startsWith("WALLET_EXCEEDS_MAX:")) {
      const m = error.message.slice("WALLET_EXCEEDS_MAX:".length);
      return { error: `Maximum wallet redemption is Rs. ${m}.` };
    }
    const codeMap: Record<string, string> = {
      CODE_NOT_FOUND:        "Promo code not found.",
      CODE_INACTIVE:         "This promo code is no longer active.",
      CODE_NOT_YET_VALID:    "This promo code isn't valid yet.",
      CODE_EXPIRED:          "This promo code has expired.",
      CODE_USED_UP:          "This promo code has reached its usage limit.",
      WALLET_REQUIRES_AUTH:  "Sign in to use your wallet balance.",
      WALLET_OVERPAY:        "Wallet amount can't exceed the order subtotal.",
    };
    if (codeMap[error.message]) return { error: codeMap[error.message] };
    return { error: error.message };
  }
  if (!data) return { error: "Order could not be created." };

  const pricing = {
    subtotal: Number(data.subtotal ?? 0),
    taxAmount: Number(data.tax_amount ?? 0),
    deliveryFee: Number(data.delivery_fee ?? 0),
    serviceCharge: Number(data.service_charge ?? 0),
    total: Number(data.total_amount ?? 0),
  };

  emitBackground({
    name: "order.placed",
    payload: {
      order_id: data.order_id,
      order_number: data.order_number,
      shop_id: shopParse.data,
      payment_method: paymentMethod,
      subtotal: pricing.subtotal,
      tax_amount: pricing.taxAmount,
      delivery_fee: pricing.deliveryFee,
      service_charge: pricing.serviceCharge,
      total: pricing.total,
      customer_email: customerParse.data.email || null,
      customer_phone: customerParse.data.phone,
    },
    shopId: shopParse.data,
    aggregateId: data.order_id,
    idempotencyKey: `order:${data.order_id}`,
  });

  // Offline methods (cod / bank_transfer / qr_code) — no gateway initiation.
  if (paymentMethod === "cod" || paymentMethod === "bank_transfer" || paymentMethod === "qr_code") {
    revalidatePath("/dashboard/owner/orders");
    return {
      orderNumber: data.order_number,
      trackingToken: data.tracking_token,
      paymentId: data.payment_id,
      redirectUrl: `/order/${data.order_number}?t=${data.tracking_token}`,
      redirectMethod: "GET",
      pricing,
    };
  }

  // Online gateways — read secrets via SERVICE-ROLE.
  let initiateResult: InitiateResult;
  try {
    const admin = createAdminClient();
    const { data: secretsRow, error: secretsErr } = await admin
      .rpc("get_shop_payment_secrets", { p_shop_id: shopParse.data })
      .single<PaymentSecrets>();
    if (secretsErr || !secretsRow) {
      await failPaymentAndRestoreStock(data.payment_id, "Shop payment configuration is missing for this method.");
      return { error: "Shop payment configuration is missing for this method." };
    }

    const baseUrl = getSiteUrl();
    const ctx: InitiateContext = {
      orderId: data.order_id,
      orderNumber: data.order_number,
      paymentId: data.payment_id,
      shopId: shopParse.data,
      shopName,
      amount: Number(data.total_amount),
      transactionReference,
      customer: {
        name: customerParse.data.name,
        email: customerParse.data.email || null,
        phone: customerParse.data.phone,
      },
      baseUrl,
    };
    initiateResult = await initiatePaymentProvider(paymentMethod, ctx, secretsRow);
    if (paymentMethod === "khalti" && initiateResult.gatewayReference) {
      await admin
        .from("payments")
        .update({ gateway_transaction_id: initiateResult.gatewayReference })
        .eq("id", data.payment_id)
        .eq("payment_status", "payment_initiated");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to initiate payment.";
    await failPaymentAndRestoreStock(data.payment_id, msg);
    // Best-effort: persist failed-init in audit log via admin client.
    try {
      const admin = createAdminClient();
      await admin.from("payment_audit_logs").insert({
        payment_id: data.payment_id,
        order_id: data.order_id,
        shop_id: shopParse.data,
        action: "failed",
        actor_type: "system",
        from_status: "payment_initiated",
        to_status: "payment_failed",
        metadata: { reason: msg },
      });
    } catch { /* swallow */ }
    return { error: `Gateway initiation failed: ${msg}` };
  }

  revalidatePath("/dashboard/owner/orders");
  return {
    orderNumber: data.order_number,
    trackingToken: data.tracking_token,
    paymentId: data.payment_id,
    redirectUrl: initiateResult.redirectUrl,
    redirectMethod: initiateResult.redirectMethod ?? "GET",
    formFields: initiateResult.formFields,
    pricing,
  };
}

/**
 * Upload a customer-supplied bank/QR receipt and bind it to the payment.
 *
 * Path layout (required by storage RLS policy):
 *   payment_receipts/{shop_id}/{order_id}/{filename}
 *
 * Returns the public-ish path so the customer's tracking page can hide the
 * "upload again" CTA.  The file itself remains in a PRIVATE bucket — only
 * shop members can fetch a signed URL.
 */
export async function uploadReceiptForOrder(
  orderNumber: string,
  trackingToken: string,
  formData: FormData
): Promise<{ error?: string; receiptPath?: string }> {
  const rateLimit = await checkRateLimit("uploadReceiptForOrder", { maxAttempts: 8, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.success) return { error: rateLimit.error };

  const orderParse = OrderNumberSchema.safeParse(orderNumber);
  if (!orderParse.success) return { error: "Order number is required." };
  const tokenParse = TrackingTokenSchema.safeParse(trackingToken);
  if (!tokenParse.success) return { error: "Invalid tracking token." };

  const file = formData.get("receipt");
  if (!(file instanceof File)) return { error: "Receipt file is required." };
  if (file.size === 0) return { error: "Receipt file is empty." };
  if (file.size > 8 * 1024 * 1024) return { error: "Receipt exceeds 8 MB." };

  const mime = file.type.toLowerCase();
  if (!/^image\/(png|jpe?g|webp)$/.test(mime) && mime !== "application/pdf") {
    return { error: "Only PNG, JPG, WebP or PDF receipts are accepted." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidReceiptSignature(bytes, mime)) {
    return { error: "Receipt file content does not match its file type." };
  }

  const supabase = await createClient();
  const { data: order, error: orderErr } = await supabase
    .rpc("get_order_by_number", {
      p_order_number: orderParse.data,
      p_tracking_token: tokenParse.data,
    })
    .single<{ order_id: string; shop_id: string; payment_method: string }>();
  if (orderErr || !order) return { error: "Order not found." };
  if (order.payment_method !== "bank_transfer" && order.payment_method !== "qr_code") {
    return { error: "This order does not accept receipt uploads." };
  }

  const ext = (() => {
    if (mime === "application/pdf") return "pdf";
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    return "jpg";
  })();

  const path = `${order.shop_id}/${order.order_id}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("payment_receipts")
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { error: attachErr } = await supabase.rpc("attach_payment_receipt", {
    p_order_number: orderParse.data,
    p_tracking_token: tokenParse.data,
    p_receipt_url: path,
  });
  if (attachErr) {
    await admin.storage.from("payment_receipts").remove([path]).catch(() => null);
    return { error: attachErr.message };
  }

  revalidatePath("/dashboard/owner/orders");
  return { receiptPath: path };
}

/** Anon-safe order tracking lookup (used by the receipt-upload page). */
export async function getOrderByNumber(orderNumber: string) {
  void orderNumber;
  return { error: "Tracking token is required." };
}

export async function getOrderByNumberWithToken(orderNumber: string, trackingToken: string) {
  const rateLimit = await checkRateLimit("getOrderByNumberWithToken", { maxAttempts: 30, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.success) return { error: rateLimit.error };

  const orderParse = OrderNumberSchema.safeParse(orderNumber);
  const tokenParse = TrackingTokenSchema.safeParse(trackingToken);
  if (!orderParse.success || !tokenParse.success) return { error: "Order not found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_order_by_number", {
      p_order_number: orderParse.data,
      p_tracking_token: tokenParse.data,
    })
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Order not found." };
  return { order: data };
}

export interface OrderCoords {
  order_number: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_address: string | null;
  shop_lat: number | null;
  shop_lng: number | null;
  shop_name: string | null;
  shop_slug: string | null;
}

/** Coords-only lookup for the tracking-page delivery map. Separate from
 *  getOrderByNumberWithToken so we don't change that function's shape. */
export async function getOrderCoords(orderNumber: string, trackingToken: string) {
  const orderParse = OrderNumberSchema.safeParse(orderNumber);
  const tokenParse = TrackingTokenSchema.safeParse(trackingToken);
  if (!orderParse.success || !tokenParse.success) return { error: "Order not found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_order_coords", {
      p_order_number: orderParse.data,
      p_tracking_token: tokenParse.data,
    })
    .maybeSingle<OrderCoords>();
  if (error) return { error: error.message };
  return { coords: (data as OrderCoords | null) ?? null };
}

/** Anon-safe: returns enabled methods + bank/QR display fields, NEVER secrets. */
export async function getPublicShopPaymentMethods(
  shopId: string
): Promise<{ error?: string; methods?: PublicPaymentMethods }> {
  const shopParse = ShopIdSchema.safeParse(shopId);
  if (!shopParse.success) return { error: "Invalid shop." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_shop_payment_methods", { p_shop_id: shopParse.data })
    .maybeSingle<PublicPaymentMethods>();
  if (error) return { error: error.message };
  if (!data) {
    return {
      methods: {
        enabled_methods: ["cod"],
        bank_name: null, bank_account_holder: null, bank_account_number: null,
        bank_branch: null, bank_swift_code: null, qr_code_url: null,
        payment_instructions: null, has_esewa: false, has_khalti: false,
      },
    };
  }
  return { methods: data };
}
