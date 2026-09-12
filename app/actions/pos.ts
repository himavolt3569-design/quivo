"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import { prisma } from "@/lib/prisma";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ShopIdSchema = z.string().uuid("Invalid shop ID");
const HeldIdSchema = z.string().uuid("Invalid held sale ID");

const CartLineSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  qty: z.number().positive(),
  maxStock: z.number().nonnegative(),
  unit: z.string().nullable(),
  cfg: z
    .object({
      kind: z.enum(["count", "weight", "volume"]),
      step: z.number().positive(),
      min: z.number().nonnegative(),
      label: z.string(),
      priceLabel: z.string(),
      digits: z.number().int().nonnegative(),
    })
    .passthrough(),
  lineDiscount: z.number().min(0).default(0),
});

const ParkSaleSchema = z.object({
  shopId: ShopIdSchema,
  cart: z.array(CartLineSchema).min(1, "Cart is empty"),
  note: z.string().max(500).optional().nullable(),
  customerName: z.string().max(120).optional().nullable(),
  orderDiscount: z.number().min(0).optional(),
  orderDiscountKind: z.enum(["flat", "percent"]).optional(),
  orderDiscountValue: z.number().min(0).optional(),
  buyerName: z.string().max(120).optional().nullable(),
});

export type HeldCartPayload = z.infer<typeof ParkSaleSchema>;
export type HeldCartLine = z.infer<typeof CartLineSchema>;

// ─── Actions ─────────────────────────────────────────────────────────────────

async function authedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

/**
 * Park the current cart so the cashier can resume it later. Returns the
 * server-assigned `held_sales.id` so the client can keep it for resume.
 */
export async function parkSale(input: HeldCartPayload) {
  const parse = ParkSaleSchema.safeParse(input);
  if (!parse.success) {
    return { error: parse.error.issues[0]?.message ?? "Invalid cart payload" };
  }
  const {
    shopId,
    cart,
    note,
    customerName,
    orderDiscount,
    orderDiscountKind,
    orderDiscountValue,
    buyerName,
  } = parse.data;

  try {
    const { user } = await authedClient();

    const payload = {
      version: 1 as const,
      cart,
      orderDiscount: orderDiscount ?? 0,
      orderDiscountKind: orderDiscountKind ?? "flat",
      orderDiscountValue: orderDiscountValue ?? 0,
      buyerName: buyerName ?? null,
    };

    const data = await prisma.held_sales.create({
      data: {
        shop_id: shopId,
        created_by: user.id,
        cart: payload as any,
        note: note ?? null,
        customer_name: customerName ?? null,
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/owner/pos");
    return { success: true, id: data.id };
  } catch (err: any) {
    log.error("parkSale: insert failed", {
      message: err.message,
      shopId,
    });
    return { error: err.message };
  }
}

export interface HeldSaleSummary {
  id: string;
  created_at: string;
  note: string | null;
  customer_name: string | null;
  item_count: number;
  total: number;
}

/**
 * List open held sales for a shop, most recent first.
 */
export async function listHeldSales(
  shopId: string,
): Promise<{ rows?: HeldSaleSummary[]; error?: string }> {
  const parse = ShopIdSchema.safeParse(shopId);
  if (!parse.success) return { error: "Invalid shop ID" };

  try {
    const data = await prisma.held_sales.findMany({
      where: { shop_id: parse.data },
      select: {
        id: true,
        created_at: true,
        note: true,
        customer_name: true,
        cart: true,
      },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    const rows: HeldSaleSummary[] = data.map((r) => {
      const cart = (r.cart ?? {}) as { cart?: HeldCartLine[] };
      const lines = Array.isArray(cart.cart) ? cart.cart : [];
      const total = lines.reduce(
        (a, l) => a + l.price * l.qty - (l.lineDiscount ?? 0),
        0,
      );
      return {
        id: r.id as string,
        created_at: (r.created_at as Date).toISOString(),
        note: (r.note as string | null) ?? null,
        customer_name: (r.customer_name as string | null) ?? null,
        item_count: lines.length,
        total: Math.max(0, Math.round(total * 100) / 100),
      };
    });
    return { rows };
  } catch (err: any) {
    log.error("listHeldSales: select failed", {
      message: err.message,
    });
    return { error: err.message };
  }
}

/**
 * Return the full cart of a held sale so the client can rehydrate state.
 */
export async function getHeldSale(id: string) {
  const parse = HeldIdSchema.safeParse(id);
  if (!parse.success) return { error: "Invalid held sale ID" };

  try {
    const data = await prisma.held_sales.findUnique({
      where: { id: parse.data },
      select: {
        id: true,
        shop_id: true,
        cart: true,
        note: true,
        customer_name: true,
        created_at: true,
      },
    });

    if (!data) return { error: "Held sale not found" };
    return { row: { ...data, created_at: (data.created_at as Date).toISOString() } };
  } catch (err: any) {
    log.error("getHeldSale: select failed", {
      message: err.message,
    });
    return { error: err.message };
  }
}

/**
 * Drop a held sale once it has been resumed or explicitly cancelled.
 */
export async function deleteHeldSale(id: string) {
  const parse = HeldIdSchema.safeParse(id);
  if (!parse.success) return { error: "Invalid held sale ID" };

  try {
    await prisma.held_sales.delete({
      where: { id: parse.data },
    });
    revalidatePath("/dashboard/owner/pos");
    return { success: true };
  } catch (err: any) {
    log.error("deleteHeldSale: failed", {
      message: err.message,
    });
    return { error: err.message };
  }
}
