"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const ShopIdSchema = z.string().uuid("Invalid shop ID");

const LineSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().positive(),
});

const TransferSchema = z
  .object({
    fromShopId: ShopIdSchema,
    toShopId: ShopIdSchema,
    notes: z.string().max(500).optional().nullable(),
    lines: z.array(LineSchema).min(1, "Add at least one line"),
  })
  .refine((v) => v.fromShopId !== v.toShopId, {
    message: "Source and destination must be different shops",
    path: ["toShopId"],
  });

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

/**
 * Single-step transfer: create transfer + lines, then execute_stock_transfer
 * (FEFO-drains source, mirrors product on dest, writes a new batch).
 */
export async function createAndExecuteTransfer(
  input: z.infer<typeof TransferSchema>,
) {
  const parse = TransferSchema.safeParse(input);
  if (!parse.success)
    return { error: parse.error.issues[0]?.message ?? "Invalid input" };

  try {
    const { supabase, user } = await authed();

    const { data: transfer, error: tErr } = await supabase
      .from("stock_transfers")
      .insert({
        from_shop_id: parse.data.fromShopId,
        to_shop_id: parse.data.toShopId,
        status: "draft",
        notes: parse.data.notes ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (tErr || !transfer) {
      log.error("createTransfer insert failed", {
        code: tErr?.code,
        message: tErr?.message,
      });
      return { error: tErr?.message ?? "Could not create transfer" };
    }

    const { error: lErr } = await supabase.from("stock_transfer_lines").insert(
      parse.data.lines.map((l) => ({
        transfer_id: transfer.id,
        product_id: l.product_id,
        qty: l.qty,
      })),
    );
    if (lErr) {
      await supabase
        .from("stock_transfers")
        .delete()
        .eq("id", transfer.id as string);
      log.error("createTransfer line insert failed", {
        code: lErr.code,
        message: lErr.message,
      });
      return { error: lErr.message };
    }

    const { error: rpcErr } = await supabase.rpc("execute_stock_transfer", {
      p_id: transfer.id,
    });
    if (rpcErr) {
      log.error("execute_stock_transfer RPC failed", {
        code: rpcErr.code,
        message: rpcErr.message,
      });
      // Leave the rows around for forensic review; the user can retry or cancel.
      return { error: rpcErr.message };
    }

    revalidatePath("/dashboard/owner/products");
    revalidatePath("/dashboard/owner/products/transfers");
    return { id: transfer.id as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listRecentTransfers(shopId: string) {
  const parse = ShopIdSchema.safeParse(shopId);
  if (!parse.success) return { error: "Invalid shop ID" };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase
      .from("stock_transfers")
      .select(
        `
        id, from_shop_id, to_shop_id, status, notes, created_at, completed_at,
        lines:stock_transfer_lines(id, product_id, qty,
                                   product:products!inner(name))
      `,
      )
      .or(`from_shop_id.eq.${parse.data},to_shop_id.eq.${parse.data}`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return { error: error.message };
    return { rows: data ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
