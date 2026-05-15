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
import { initiatePaymentProvider } from "@/lib/payments";
import type {
  InitiateContext, InitiateResult, PaymentMethod, PaymentSecrets, PublicPaymentMethods,
} from "@/lib/payments";
import { PAYMENT_METHODS } from "@/lib/payments/constants";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

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
}

export interface PlaceOrderResult {
  error?: string;
  orderNumber?: string;
  paymentId?: string;
  redirectUrl?: string;
  redirectMethod?: "GET" | "POST";
  formFields?: Record<string, string>;
}

function isPaymentMethod(v: string): v is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(v);
}

/** Generate a short, human-friendly order number. */
function newOrderNumber(): string {
  return `QVO-${Date.now().toString(36).toUpperCase().slice(-8)}-${
    Math.random().toString(36).toUpperCase().slice(2, 5)
  }`;
}

export async function placeOrderWithPayment(
  shopId: string,
  shopName: string,
  cart: CartItemInput[],
  paymentMethod: string,
  customer: CustomerInfo
): Promise<PlaceOrderResult> {
  if (!cart.length) return { error: "Cart is empty." };
  if (!customer.name.trim()) return { error: "Name is required." };
  if (!customer.phone.trim()) return { error: "Phone number is required." };
  if (!customer.address.trim()) return { error: "Delivery address is required." };
  if (!isPaymentMethod(paymentMethod)) return { error: "Invalid payment method." };

  // RECOMPUTE total server-side from cart unit prices. We do not trust whatever
  // the client posts.  Each cart line is validated > 0.
  let total = 0;
  for (const item of cart) {
    if (!item.id || !item.name) return { error: "Invalid cart item." };
    const price = Number(item.price);
    const qty = Number(item.qty);
    if (!isFinite(price) || price < 0) return { error: "Invalid cart price." };
    if (!isFinite(qty) || qty <= 0) return { error: "Invalid cart quantity." };
    total += price * qty;
  }
  total = Math.round(total * 100) / 100;
  if (total <= 0) return { error: "Cart total must be greater than zero." };

  const supabase = await createClient();
  const orderNumber = newOrderNumber();
  const transactionReference = randomUUID();

  const { data, error } = await supabase
    .rpc("place_order_with_payment", {
      p_shop_id: shopId,
      p_shop_name: shopName,
      p_order_number: orderNumber,
      p_customer_name: customer.name.trim(),
      p_customer_phone: customer.phone.trim(),
      p_customer_email: customer.email?.trim() || null,
      p_delivery_address: customer.address.trim(),
      p_items: cart,
      p_total_amount: total,
      p_payment_method: paymentMethod,
      p_transaction_reference: transactionReference,
      p_notes: customer.notes?.trim() || null,
    })
    .single<{ order_id: string; payment_id: string; order_number: string }>();

  if (error) {
    if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
      const name = error.message.slice("INSUFFICIENT_STOCK:".length);
      return { error: `"${name}" is no longer available in the requested quantity.` };
    }
    if (error.message.startsWith("PAYMENT_METHOD_DISABLED:")) {
      const m = error.message.slice("PAYMENT_METHOD_DISABLED:".length);
      return { error: `Payment method "${m}" is not enabled for this shop.` };
    }
    return { error: error.message };
  }
  if (!data) return { error: "Order could not be created." };

  // Offline methods (cod / bank_transfer / qr_code) — no gateway initiation.
  if (paymentMethod === "cod" || paymentMethod === "bank_transfer" || paymentMethod === "qr_code") {
    revalidatePath("/dashboard/owner/orders");
    return {
      orderNumber: data.order_number,
      paymentId: data.payment_id,
      redirectUrl: `/order/${data.order_number}`,
      redirectMethod: "GET",
    };
  }

  // Online gateways — read secrets via SERVICE-ROLE.
  let initiateResult: InitiateResult;
  try {
    const admin = createAdminClient();
    const { data: secretsRow, error: secretsErr } = await admin
      .rpc("get_shop_payment_secrets", { p_shop_id: shopId })
      .single<PaymentSecrets>();
    if (secretsErr || !secretsRow) {
      return { error: "Shop payment configuration is missing for this method." };
    }

    const baseUrl = getSiteUrl();
    const ctx: InitiateContext = {
      orderId: data.order_id,
      orderNumber: data.order_number,
      paymentId: data.payment_id,
      shopId,
      shopName,
      amount: total,
      transactionReference,
      customer: {
        name: customer.name.trim(),
        email: customer.email?.trim() || null,
        phone: customer.phone.trim() || null,
      },
      baseUrl,
    };
    initiateResult = await initiatePaymentProvider(paymentMethod, ctx, secretsRow);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to initiate payment.";
    // Best-effort: persist failed-init in audit log via admin client.
    try {
      const admin = createAdminClient();
      await admin.from("payment_audit_logs").insert({
        payment_id: data.payment_id,
        shop_id: shopId,
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
    paymentId: data.payment_id,
    redirectUrl: initiateResult.redirectUrl,
    redirectMethod: initiateResult.redirectMethod ?? "GET",
    formFields: initiateResult.formFields,
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
  formData: FormData
): Promise<{ error?: string; receiptPath?: string }> {
  if (!orderNumber.trim()) return { error: "Order number is required." };

  const file = formData.get("receipt");
  if (!(file instanceof File)) return { error: "Receipt file is required." };
  if (file.size === 0) return { error: "Receipt file is empty." };
  if (file.size > 8 * 1024 * 1024) return { error: "Receipt exceeds 8 MB." };

  const mime = file.type.toLowerCase();
  if (!/^image\/(png|jpe?g|webp)$/.test(mime) && mime !== "application/pdf") {
    return { error: "Only PNG, JPG, WebP or PDF receipts are accepted." };
  }

  const supabase = await createClient();
  const { data: order, error: orderErr } = await supabase
    .rpc("get_order_by_number", { p_order_number: orderNumber.trim() })
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
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("payment_receipts")
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { error: attachErr } = await supabase.rpc("attach_payment_receipt", {
    p_order_number: orderNumber.trim(),
    p_receipt_url: path,
  });
  if (attachErr) return { error: attachErr.message };

  revalidatePath("/dashboard/owner/orders");
  return { receiptPath: path };
}

/** Anon-safe order tracking lookup (used by the receipt-upload page). */
export async function getOrderByNumber(orderNumber: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_order_by_number", { p_order_number: orderNumber.trim() })
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Order not found." };
  return { order: data };
}

/** Anon-safe: returns enabled methods + bank/QR display fields, NEVER secrets. */
export async function getPublicShopPaymentMethods(
  shopId: string
): Promise<{ error?: string; methods?: PublicPaymentMethods }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_shop_payment_methods", { p_shop_id: shopId })
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
