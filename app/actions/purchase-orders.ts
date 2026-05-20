"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const ShopIdSchema = z.string().uuid("Invalid shop ID");
const SupplierIdSchema = z.string().uuid("Invalid supplier ID");
const PoIdSchema = z.string().uuid("Invalid PO ID");

const LineSchema = z.object({
  product_id: z.string().uuid(),
  qty_ordered: z.number().positive(),
  unit_cost: z.number().nonnegative(),
  expected_expiry: z.string().nullable().optional(),
  notes: z.string().max(300).optional().nullable(),
});

const CreatePoSchema = z.object({
  shopId: ShopIdSchema,
  supplierId: SupplierIdSchema,
  expectedAt: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  billedAfterReceive: z.boolean().default(true),
  lines: z.array(LineSchema).min(1, "Add at least one line"),
});

const ReceiveLineSchema = z.object({
  line_id: z.string().uuid(),
  qty: z.number().positive(),
  batch_no: z.string().max(120).optional().nullable(),
  expiry_date: z.string().optional().nullable(),
});

const ReceivePoSchema = z.object({
  poId: PoIdSchema,
  lines: z.array(ReceiveLineSchema).min(1, "Pick at least one line to receive"),
});

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function createPurchaseOrder(input: z.infer<typeof CreatePoSchema>) {
  const parse = CreatePoSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Invalid PO input" };
  const data = parse.data;

  try {
    const { supabase, user } = await authed();
    const total = Math.round(
      data.lines.reduce((a, l) => a + l.qty_ordered * l.unit_cost, 0) * 100
    ) / 100;

    const { data: po, error } = await supabase
      .from("purchase_orders")
      .insert({
        shop_id: data.shopId,
        supplier_id: data.supplierId,
        status: "submitted",
        ordered_at: new Date().toISOString(),
        expected_at: data.expectedAt ?? null,
        total_amount: total,
        notes: data.notes ?? null,
        billed_after_receive: data.billedAfterReceive,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !po) {
      log.error("createPO insert failed", { code: error?.code, message: error?.message });
      return { error: error?.message ?? "Could not create PO" };
    }

    const { error: lineErr } = await supabase
      .from("purchase_order_lines")
      .insert(
        data.lines.map((l) => ({
          purchase_order_id: po.id,
          product_id: l.product_id,
          qty_ordered: l.qty_ordered,
          unit_cost: l.unit_cost,
          expected_expiry: l.expected_expiry ?? null,
          notes: l.notes ?? null,
        }))
      );
    if (lineErr) {
      log.error("createPO line insert failed", { code: lineErr.code, message: lineErr.message });
      await supabase.from("purchase_orders").delete().eq("id", po.id as string);
      return { error: lineErr.message };
    }

    revalidatePath(`/dashboard/owner/suppliers/${data.supplierId}`);
    revalidatePath(`/dashboard/owner/suppliers/${data.supplierId}/purchase-orders`);
    return { id: po.id as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function receivePurchaseOrder(input: z.infer<typeof ReceivePoSchema>) {
  const parse = ReceivePoSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Invalid input" };
  try {
    const { supabase } = await authed();
    const { error } = await supabase.rpc("receive_purchase_order", {
      p_po_id: parse.data.poId,
      p_received_lines: parse.data.lines,
    });
    if (error) {
      log.error("receivePO RPC failed", { code: error.code, message: error.message });
      return { error: error.message };
    }
    revalidatePath("/dashboard/owner/suppliers");
    revalidatePath("/dashboard/owner/products");
    revalidatePath("/dashboard/owner");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelPurchaseOrder(poId: string) {
  const parse = PoIdSchema.safeParse(poId);
  if (!parse.success) return { error: "Invalid PO ID" };
  try {
    const { supabase } = await authed();
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: "cancelled" })
      .eq("id", parse.data)
      .in("status", ["draft", "submitted", "partial"]);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/owner/suppliers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
