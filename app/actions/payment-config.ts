"use server";

/**
 * Owner-facing payment server actions.
 *
 * - getOwnerPaymentConfig: reads the shop's config with secrets MASKED
 *   (returns has_esewa_secret / has_khalti_secret booleans, never raw keys).
 * - updateOwnerPaymentConfig: NULL-preserving upsert.  Passing an empty string
 *   for a secret key keeps the existing one — the UI never re-displays it.
 * - verifyPayment / rejectPayment / markCodPaid: state transitions, idempotent.
 * - uploadQrCodeImage: shop_assets public bucket for the customer-facing QR.
 * - getOwnerShops + getOwnerPaymentsOverview + getOwnerPaymentsList:
 *   CROSS-SHOP — when a single owner runs multiple shops, these return data
 *   for every shop they're a member of.  Each RPC filters by
 *   is_shop_member(p.shop_id, auth.uid()) so there is NO cross-owner leakage.
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { PAYMENT_METHODS } from "@/lib/payments/constants";
import type {
  PaymentMethod, OwnerPaymentConfig,
} from "@/lib/payments";

const ShopIdSchema = z.string().uuid("Invalid shop ID");
const PaymentIdSchema = z.string().uuid("Invalid payment ID");
const ReceiptPathSchema = z.string().regex(
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9]+-[0-9a-f]{8}\.(?:png|jpe?g|webp|pdf)$/i,
  "Invalid receipt path."
);

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return { supabase, user };
}

// ─── Config read / write ──────────────────────────────────────────────────

export async function getOwnerPaymentConfig(
  shopId: string
): Promise<{ error?: string; config?: OwnerPaymentConfig }> {
  const parse = ShopIdSchema.safeParse(shopId);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { data, error } = await supabase
    .rpc("get_owner_payment_config", { p_shop_id: parse.data })
    .maybeSingle<OwnerPaymentConfig>();
  if (error) return { error: error.message };
  if (!data) {
    return {
      config: {
        enabled_methods: ["cod"],
        esewa_merchant_code: null, esewa_environment: "sandbox", has_esewa_secret: false,
        khalti_public_key: null, khalti_environment: "sandbox", has_khalti_secret: false,
        bank_name: null, bank_account_holder: null, bank_account_number: null,
        bank_branch: null, bank_swift_code: null, qr_code_url: null,
        payment_instructions: null,
      },
    };
  }
  return { config: data };
}

const ConfigSchema = z.object({
  enabled_methods: z.array(z.string()).optional(),
  esewa_merchant_code: z.string().trim().max(80).optional(),
  esewa_secret_key: z.string().trim().max(512).optional(),
  esewa_environment: z.enum(["sandbox", "production"]).optional(),
  khalti_public_key: z.string().trim().max(120).optional(),
  khalti_secret_key: z.string().trim().max(512).optional(),
  khalti_environment: z.enum(["sandbox", "production"]).optional(),
  bank_name: z.string().trim().max(120).optional(),
  bank_account_holder: z.string().trim().max(120).optional(),
  bank_account_number: z.string().trim().max(60).optional(),
  bank_branch: z.string().trim().max(120).optional(),
  bank_swift_code: z.string().trim().max(20).optional(),
  qr_code_url: z.string().trim().max(1000).optional(),
  payment_instructions: z.string().trim().max(1000).optional(),
});

/** Convert "" → null so the COALESCE in the RPC preserves the existing value. */
function emptyToNull<T extends string | undefined>(v: T): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function updateOwnerPaymentConfig(
  shopId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: idParse.error.issues[0].message };

  // enabled_methods comes through as repeated form fields
  const rawMethods = formData.getAll("enabled_methods").map(String);
  const cleanMethods = rawMethods
    .map((m) => m.trim())
    .filter((m): m is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(m));

  const parsed = ConfigSchema.safeParse({
    enabled_methods: cleanMethods.length ? cleanMethods : undefined,
    esewa_merchant_code: formData.get("esewa_merchant_code")?.toString(),
    esewa_secret_key:    formData.get("esewa_secret_key")?.toString(),
    esewa_environment:   formData.get("esewa_environment")?.toString() as "sandbox" | "production" | undefined,
    khalti_public_key:   formData.get("khalti_public_key")?.toString(),
    khalti_secret_key:   formData.get("khalti_secret_key")?.toString(),
    khalti_environment:  formData.get("khalti_environment")?.toString() as "sandbox" | "production" | undefined,
    bank_name:           formData.get("bank_name")?.toString(),
    bank_account_holder: formData.get("bank_account_holder")?.toString(),
    bank_account_number: formData.get("bank_account_number")?.toString(),
    bank_branch:         formData.get("bank_branch")?.toString(),
    bank_swift_code:     formData.get("bank_swift_code")?.toString(),
    qr_code_url:         formData.get("qr_code_url")?.toString(),
    payment_instructions: formData.get("payment_instructions")?.toString(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.rpc("upsert_shop_payment_config", {
    p_shop_id:              idParse.data,
    p_enabled_methods:      parsed.data.enabled_methods ?? null,
    p_esewa_merchant_code:  emptyToNull(parsed.data.esewa_merchant_code),
    p_esewa_secret_key:     emptyToNull(parsed.data.esewa_secret_key),
    p_esewa_environment:    parsed.data.esewa_environment ?? null,
    p_khalti_public_key:    emptyToNull(parsed.data.khalti_public_key),
    p_khalti_secret_key:    emptyToNull(parsed.data.khalti_secret_key),
    p_khalti_environment:   parsed.data.khalti_environment ?? null,
    p_bank_name:            emptyToNull(parsed.data.bank_name),
    p_bank_account_holder:  emptyToNull(parsed.data.bank_account_holder),
    p_bank_account_number:  emptyToNull(parsed.data.bank_account_number),
    p_bank_branch:          emptyToNull(parsed.data.bank_branch),
    p_bank_swift_code:      emptyToNull(parsed.data.bank_swift_code),
    p_qr_code_url:          emptyToNull(parsed.data.qr_code_url),
    p_payment_instructions: emptyToNull(parsed.data.payment_instructions),
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/owner/payments");
  revalidatePath("/dashboard/owner/settings");
  return {};
}

/** Upload a QR-code image to the public shop_assets bucket; returns the URL. */
export async function uploadQrCodeImage(
  shopId: string,
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: idParse.error.issues[0].message };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "QR image is required." };
  if (file.size === 0) return { error: "QR image is empty." };
  if (file.size > 5 * 1024 * 1024) return { error: "QR image exceeds 5 MB." };
  const mime = file.type.toLowerCase();
  if (!/^image\/(png|jpe?g|webp)$/.test(mime)) {
    return { error: "Only PNG, JPG, WebP QR images are accepted." };
  }

  const { supabase, user } = await getAuthUser();
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/payment_qr/${idParse.data}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("shop_assets")
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { data: { publicUrl } } = supabase.storage.from("shop_assets").getPublicUrl(path);
  return { url: publicUrl };
}

// ─── Verification flow ────────────────────────────────────────────────────

export async function verifyPayment(paymentId: string): Promise<{ error?: string }> {
  const parse = PaymentIdSchema.safeParse(paymentId);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.rpc("verify_payment_by_owner", { p_payment_id: parse.data });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/orders");
  revalidatePath("/dashboard/owner/payments");
  return {};
}

export async function rejectPayment(
  paymentId: string,
  reason: string
): Promise<{ error?: string }> {
  const parse = PaymentIdSchema.safeParse(paymentId);
  if (!parse.success) return { error: parse.error.issues[0].message };
  const trimmed = reason.trim();
  if (!trimmed) return { error: "Rejection reason is required." };
  if (trimmed.length > 500) return { error: "Rejection reason is too long." };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.rpc("reject_payment_by_owner", {
    p_payment_id: parse.data,
    p_reason: trimmed,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/orders");
  revalidatePath("/dashboard/owner/payments");
  return {};
}

export async function markCodPaid(paymentId: string): Promise<{ error?: string }> {
  const parse = PaymentIdSchema.safeParse(paymentId);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.rpc("mark_cod_paid_by_owner", { p_payment_id: parse.data });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/orders");
  revalidatePath("/dashboard/owner/payments");
  return {};
}

// ─── Cross-shop reporting (one owner → many shops) ─────────────────────────

export interface OwnerShopRow {
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  role: string;
}

export async function getOwnerShops(): Promise<{ error?: string; shops?: OwnerShopRow[] }> {
  const { supabase } = await getAuthUser();
  const { data, error } = await supabase.rpc("get_owner_shops");
  if (error) return { error: error.message };
  return { shops: (data ?? []) as OwnerShopRow[] };
}

export interface OwnerPaymentOverviewRow {
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  payment_method: PaymentMethod;
  payment_status: string;
  payment_count: number;
  total_amount: number;
}

export async function getOwnerPaymentsOverview(
  from?: Date,
  to?: Date
): Promise<{ error?: string; rows?: OwnerPaymentOverviewRow[] }> {
  const { supabase } = await getAuthUser();
  const { data, error } = await supabase.rpc("get_owner_payments_overview", {
    p_from: from?.toISOString() ?? null,
    p_to:   to?.toISOString() ?? null,
  });
  if (error) return { error: error.message };
  return { rows: (data ?? []) as OwnerPaymentOverviewRow[] };
}

export interface OwnerPaymentListRow {
  payment_id: string;
  order_id: string;
  order_number: string;
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  payment_method: PaymentMethod;
  payment_status: string;
  amount: number;
  transaction_reference: string;
  receipt_url: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  rejected_reason: string | null;
  created_at: string;
}

export interface OwnerPaymentListFilter {
  shopId?: string | null;
  method?: PaymentMethod | null;
  status?: string | null;
  from?: Date | null;
  to?: Date | null;
  limit?: number;
  offset?: number;
}

export async function getOwnerPaymentsList(
  filter: OwnerPaymentListFilter = {}
): Promise<{ error?: string; rows?: OwnerPaymentListRow[] }> {
  const { supabase } = await getAuthUser();
  const { data, error } = await supabase.rpc("get_owner_payments_list", {
    p_shop_id: filter.shopId ?? null,
    p_method:  filter.method  ?? null,
    p_status:  filter.status  ?? null,
    p_from:    filter.from?.toISOString() ?? null,
    p_to:      filter.to?.toISOString() ?? null,
    p_limit:   filter.limit  ?? 50,
    p_offset:  filter.offset ?? 0,
  });
  if (error) return { error: error.message };
  return { rows: (data ?? []) as OwnerPaymentListRow[] };
}

/** Generate a short-lived signed URL for a private receipt path. */
export async function getReceiptSignedUrl(
  path: string,
  expiresInSec = 300
): Promise<{ error?: string; url?: string }> {
  const pathParse = ReceiptPathSchema.safeParse(path);
  if (!pathParse.success) return { error: pathParse.error.issues[0].message };
  const { supabase } = await getAuthUser();
  const { data, error } = await supabase.storage
    .from("payment_receipts")
    .createSignedUrl(pathParse.data, Math.max(60, Math.min(expiresInSec, 3600)));
  if (error) return { error: error.message };
  return { url: data?.signedUrl };
}
