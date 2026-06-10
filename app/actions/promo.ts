"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const UUID = z.string().uuid();

const PromoSchema = z.object({
  shopId: UUID,
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/i, "Letters, digits, _ and - only"),
  kind: z.enum(["percent", "flat"]),
  value: z.coerce.number().min(0.01).max(1_000_000),
  minSubtotal: z.coerce.number().min(0).max(10_000_000).optional().default(0),
  maxDiscount: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  maxUses: z.coerce.number().int().min(1).max(1_000_000).optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
  active: z.boolean().default(true),
});

export interface PromoRow {
  id: string;
  code: string;
  kind: "percent" | "flat";
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_to: string | null;
  active: boolean;
  created_at: string;
}

export async function listPromoCodes(
  shopId: string,
): Promise<{ rows: PromoRow[]; error?: string }> {
  const parse = UUID.safeParse(shopId);
  if (!parse.success) return { rows: [], error: "Invalid shop id" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .select(
      "id, code, kind, value, min_subtotal, max_discount, max_uses, used_count, valid_from, valid_to, active, created_at",
    )
    .eq("shop_id", parse.data)
    .order("created_at", { ascending: false });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as PromoRow[] };
}

export async function createPromoCode(
  input: z.infer<typeof PromoSchema>,
): Promise<{ id?: string; error?: string }> {
  const parse = PromoSchema.safeParse(input);
  if (!parse.success)
    return { error: parse.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (parse.data.kind === "percent" && parse.data.value > 100) {
    return { error: "Percent codes can't exceed 100%." };
  }
  if (
    parse.data.validFrom &&
    parse.data.validTo &&
    new Date(parse.data.validFrom) >= new Date(parse.data.validTo)
  ) {
    return { error: "valid_from must be before valid_to." };
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .insert({
      shop_id: parse.data.shopId,
      code: parse.data.code.toUpperCase(),
      kind: parse.data.kind,
      value: parse.data.value,
      min_subtotal: parse.data.minSubtotal ?? 0,
      max_discount: parse.data.maxDiscount ?? null,
      max_uses: parse.data.maxUses ?? null,
      valid_from: parse.data.validFrom ?? null,
      valid_to: parse.data.validTo ?? null,
      active: parse.data.active,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    log.warn("createPromoCode failed", {
      code: error.code,
      message: error.message,
    });
    if (error.code === "23505")
      return { error: "A code with that name already exists for this shop." };
    return { error: "Could not create promo code." };
  }
  revalidatePath("/dashboard/owner/payments/promo-codes");
  return { id: data!.id as string };
}

export async function togglePromoActive(
  id: string,
  active: boolean,
): Promise<{ ok?: true; error?: string }> {
  const parse = UUID.safeParse(id);
  if (!parse.success) return { error: "Invalid id" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("promo_codes")
    .update({ active })
    .eq("id", parse.data);
  if (error) return { error: "Could not update." };
  revalidatePath("/dashboard/owner/payments/promo-codes");
  return { ok: true };
}

export async function deletePromoCode(
  id: string,
): Promise<{ ok?: true; error?: string }> {
  const parse = UUID.safeParse(id);
  if (!parse.success) return { error: "Invalid id" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("promo_codes")
    .delete()
    .eq("id", parse.data);
  if (error) return { error: "Could not delete." };
  revalidatePath("/dashboard/owner/payments/promo-codes");
  return { ok: true };
}

const ApplySchema = z.object({
  shopId: UUID,
  code: z.string().trim().min(1).max(40),
  subtotal: z.coerce.number().min(0.01).max(10_000_000),
});

export interface PromoPreview {
  code: string;
  discount: number;
}

export async function previewPromoCode(
  input: z.infer<typeof ApplySchema>,
): Promise<{ preview?: PromoPreview; error?: string }> {
  const parse = ApplySchema.safeParse(input);
  if (!parse.success)
    return { error: parse.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("apply_promo_code", {
      p_shop_id: parse.data.shopId,
      p_code: parse.data.code,
      p_subtotal: parse.data.subtotal,
    })
    .maybeSingle<{ promo_id: string; code: string; discount: number }>();
  if (error) {
    if (error.message.startsWith("MIN_SUBTOTAL:")) {
      const m = error.message.slice("MIN_SUBTOTAL:".length);
      return { error: `Code needs a minimum subtotal of Rs. ${m}.` };
    }
    const codeMap: Record<string, string> = {
      CODE_EMPTY: "Enter a code.",
      CODE_NOT_FOUND: "Code not found.",
      CODE_INACTIVE: "This code isn't active.",
      CODE_NOT_YET_VALID: "This code isn't valid yet.",
      CODE_EXPIRED: "This code has expired.",
      CODE_USED_UP: "This code has reached its usage limit.",
      INVALID_SUBTOTAL: "Add items to your cart first.",
    };
    if (codeMap[error.message]) return { error: codeMap[error.message] };
    return { error: error.message };
  }
  if (!data) return { error: "Code not found." };
  return { preview: { code: data.code, discount: Number(data.discount) } };
}
