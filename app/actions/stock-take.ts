"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const ShopIdSchema = z.string().uuid("Invalid shop ID");
const TakeIdSchema = z.string().uuid("Invalid stock take ID");
const ProductIdSchema = z.string().uuid("Invalid product ID");

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function startStockTake(shopId: string, notes?: string) {
  const parse = ShopIdSchema.safeParse(shopId);
  if (!parse.success) return { error: "Invalid shop ID" };
  try {
    const { supabase, user } = await authed();
    const { data, error } = await supabase
      .from("stock_takes")
      .insert({
        shop_id: parse.data,
        started_by: user.id,
        notes: notes ?? null,
      })
      .select("id")
      .single();
    if (error) {
      log.error("startStockTake failed", { code: error.code, message: error.message });
      if (error.code === "23505") return { error: "A stock take is already open for this shop." };
      return { error: error.message };
    }
    revalidatePath("/dashboard/owner/products/stock-take");
    return { id: data.id as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

const UpsertCountSchema = z.object({
  takeId: TakeIdSchema,
  productId: ProductIdSchema,
  systemQty: z.coerce.number(),
  countedQty: z.coerce.number().min(0),
  notes: z.string().max(300).optional(),
});

export async function upsertStockTakeCount(input: z.infer<typeof UpsertCountSchema>) {
  const parse = UpsertCountSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Invalid input" };
  const data = parse.data;

  try {
    const { supabase } = await authed();
    const { error } = await supabase
      .from("stock_take_counts")
      .upsert(
        {
          stock_take_id: data.takeId,
          product_id: data.productId,
          system_qty: data.systemQty,
          counted_qty: data.countedQty,
          notes: data.notes ?? null,
        },
        { onConflict: "stock_take_id,product_id" }
      );
    if (error) {
      log.error("upsertStockTakeCount failed", { code: error.code, message: error.message });
      return { error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function completeStockTake(id: string) {
  const parse = TakeIdSchema.safeParse(id);
  if (!parse.success) return { error: "Invalid stock take ID" };
  try {
    const { supabase } = await authed();
    const { error } = await supabase.rpc("complete_stock_take", { p_id: parse.data });
    if (error) {
      log.error("completeStockTake failed", { code: error.code, message: error.message });
      return { error: error.message };
    }
    revalidatePath("/dashboard/owner/products/stock-take");
    revalidatePath("/dashboard/owner/products");
    revalidatePath("/dashboard/owner");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelStockTake(id: string) {
  const parse = TakeIdSchema.safeParse(id);
  if (!parse.success) return { error: "Invalid stock take ID" };
  try {
    const { supabase } = await authed();
    const { error } = await supabase
      .from("stock_takes")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", parse.data)
      .eq("status", "open");
    if (error) return { error: error.message };
    revalidatePath("/dashboard/owner/products/stock-take");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
