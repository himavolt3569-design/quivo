"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const ShopIdSchema = z.string().uuid("Invalid shop ID");
const OptionalUuid = z.string().uuid().nullable().optional();

const RefundLineSchema = z.object({
  product_id: z.string().uuid("Invalid product ID"),
  qty: z.number().positive("Quantity must be > 0"),
  line_amount: z.number().nonnegative("Line amount must be ≥ 0"),
});

const CreateRefundSchema = z
  .object({
    shopId: ShopIdSchema,
    transactionId: OptionalUuid,
    orderId: OptionalUuid,
    items: z.array(RefundLineSchema).min(1, "Add at least one line to refund"),
    reason: z.string().trim().min(2, "Reason is required").max(500),
    taxRefunded: z.number().nonnegative().optional(),
  })
  .refine((v) => Boolean(v.transactionId) || Boolean(v.orderId), {
    message: "Either transactionId or orderId is required",
    path: ["transactionId"],
  });

export type CreateRefundInput = z.infer<typeof CreateRefundSchema>;

async function authedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

/**
 * Create a refund row, attach its line items, then process it atomically via
 * the SECURITY DEFINER process_refund RPC. Returns the refund_id on success.
 *
 * Manager / admin / owner-only — RLS on `refunds` enforces.
 */
export async function createRefund(input: CreateRefundInput) {
  const parsed = CreateRefundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid refund payload",
    };
  }
  const data = parsed.data;
  const totalAmount =
    Math.round(data.items.reduce((a, l) => a + l.line_amount, 0) * 100) / 100;
  if (totalAmount <= 0)
    return { error: "Refund amount must be greater than zero" };

  try {
    const { supabase, user } = await authedClient();

    const { data: refundRow, error: refundErr } = await supabase
      .from("refunds")
      .insert({
        shop_id: data.shopId,
        transaction_id: data.transactionId ?? null,
        order_id: data.orderId ?? null,
        refund_amount: totalAmount,
        tax_refunded: data.taxRefunded ?? 0,
        reason: data.reason,
        status: "pending",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (refundErr || !refundRow) {
      log.error("createRefund: insert failed", {
        code: refundErr?.code,
        message: refundErr?.message,
      });
      return { error: refundErr?.message ?? "Could not create refund" };
    }
    const refundId = refundRow.id as string;

    const { error: linesErr } = await supabase.from("refund_items").insert(
      data.items.map((l) => ({
        refund_id: refundId,
        product_id: l.product_id,
        qty: l.qty,
        line_amount: l.line_amount,
      })),
    );

    if (linesErr) {
      log.error("createRefund: line insert failed", {
        code: linesErr.code,
        message: linesErr.message,
      });
      // Roll back the parent row so we don't strand an empty refund.
      await supabase.from("refunds").delete().eq("id", refundId);
      return { error: linesErr.message };
    }

    const { data: processed, error: rpcErr } = await supabase.rpc(
      "process_refund",
      {
        p_refund_id: refundId,
      },
    );

    if (rpcErr) {
      log.error("createRefund: process_refund failed", {
        code: rpcErr.code,
        message: rpcErr.message,
      });
      return { error: rpcErr.message };
    }

    revalidatePath("/dashboard/owner/orders");
    revalidatePath("/dashboard/owner/finances");
    revalidatePath("/dashboard/owner");
    revalidatePath("/dashboard/owner/products");

    return { success: true, refundId: processed as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("createRefund: unexpected", { message });
    return { error: message };
  }
}

export interface RefundSummary {
  id: string;
  shop_id: string;
  refund_amount: number;
  tax_refunded: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "completed";
  transaction_id: string | null;
  order_id: string | null;
  processed_at: string | null;
  created_at: string;
}

export async function listRefunds(shopId: string) {
  const parse = ShopIdSchema.safeParse(shopId);
  if (!parse.success) return { error: "Invalid shop ID" };

  try {
    const { supabase } = await authedClient();
    const { data, error } = await supabase
      .from("refunds")
      .select(
        "id, shop_id, refund_amount, tax_refunded, reason, status, transaction_id, order_id, processed_at, created_at",
      )
      .eq("shop_id", parse.data)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      log.error("listRefunds: failed", {
        code: error.code,
        message: error.message,
      });
      return { error: error.message };
    }
    return { rows: (data ?? []) as RefundSummary[] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
