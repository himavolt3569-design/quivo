"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const ShopIdSchema = z.string().uuid("Invalid shop ID");
const ProductIdSchema = z.string().uuid("Invalid product ID");
const BatchIdSchema = z.string().uuid("Invalid batch ID");

const ReceiveBatchSchema = z.object({
  shopId: ShopIdSchema,
  productId: ProductIdSchema,
  receivedQty: z.number().positive(),
  costPrice: z.number().nonnegative(),
  batchNo: z.string().max(120).optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
});

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function receiveBatch(input: z.infer<typeof ReceiveBatchSchema>) {
  const parse = ReceiveBatchSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Invalid batch input" };
  const data = parse.data;

  try {
    const { supabase } = await authed();
    const { error } = await supabase.from("product_batches").insert({
      shop_id: data.shopId,
      product_id: data.productId,
      received_qty: data.receivedQty,
      remaining_qty: data.receivedQty,
      cost_price: data.costPrice,
      batch_no: data.batchNo ?? null,
      expiry_date: data.expiryDate || null,
      supplier_id: data.supplierId ?? null,
    });
    if (error) {
      log.error("receiveBatch failed", { code: error.code, message: error.message });
      return { error: error.message };
    }
    revalidatePath(`/dashboard/owner/products/${data.productId}/edit`);
    revalidatePath("/dashboard/owner/products");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteEmptyBatch(batchId: string) {
  const parse = BatchIdSchema.safeParse(batchId);
  if (!parse.success) return { error: "Invalid batch ID" };
  try {
    const { supabase } = await authed();
    const { error } = await supabase
      .from("product_batches")
      .delete()
      .eq("id", parse.data)
      .eq("remaining_qty", 0);
    if (error) return { error: error.message };
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
