"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const UUID = z.string().uuid();

export interface ReorderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  maxStock: number;
  image_url: string | null;
}

export interface ReorderResult {
  shopSlug: string;
  items: ReorderItem[];
  skipped: Array<{
    name: string;
    reason: "unavailable" | "out_of_stock" | "low_stock";
    requested: number;
    available: number;
  }>;
}

export async function reorderOrder(
  orderId: string,
): Promise<{ data?: ReorderResult; error?: string }> {
  const parse = UUID.safeParse(orderId);
  if (!parse.success) return { error: "Invalid order id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to reorder." };

  // RLS will only return the row if user owns it.
  const { data: order, error: ordErr } = await supabase
    .from("orders")
    .select("id, customer_id, shop_id, items, shops!inner(slug)")
    .eq("id", parse.data)
    .maybeSingle();
  if (ordErr || !order) return { error: "Order not found." };
  if ((order as { customer_id: string | null }).customer_id !== user.id)
    return { error: "Not your order." };

  const items = (
    order as unknown as {
      items: Array<{
        id?: string;
        name: string;
        price: number;
        qty: number;
        image?: string | null;
      }>;
    }
  ).items;
  const shopSlug = (order as unknown as { shops: { slug: string } }).shops.slug;

  const productIds = items
    .map((it) => it.id)
    .filter((x): x is string => typeof x === "string");
  if (productIds.length === 0)
    return { data: { shopSlug, items: [], skipped: [] } };

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, stock, status, image_url, images")
    .in("id", productIds);

  const productMap = new Map<
    string,
    {
      id: string;
      name: string;
      price: number;
      stock: number;
      status: string;
      image_url: string | null;
      images: string[] | null;
    }
  >();
  for (const p of products ?? []) productMap.set(p.id as string, p as never);

  const result: ReorderResult = { shopSlug, items: [], skipped: [] };

  for (const it of items) {
    if (!it.id) {
      result.skipped.push({
        name: it.name,
        reason: "unavailable",
        requested: it.qty,
        available: 0,
      });
      continue;
    }
    const p = productMap.get(it.id);
    if (!p || p.status !== "active") {
      result.skipped.push({
        name: it.name,
        reason: "unavailable",
        requested: it.qty,
        available: 0,
      });
      continue;
    }
    const stock = Number(p.stock ?? 0);
    if (stock <= 0) {
      result.skipped.push({
        name: p.name,
        reason: "out_of_stock",
        requested: it.qty,
        available: 0,
      });
      continue;
    }
    const qty = Math.min(it.qty, stock);
    if (qty < it.qty) {
      result.skipped.push({
        name: p.name,
        reason: "low_stock",
        requested: it.qty,
        available: qty,
      });
    }
    result.items.push({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      qty,
      maxStock: stock,
      image_url: p.images?.[0] ?? p.image_url ?? null,
    });
  }

  return { data: result };
}
