"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const UUID = z.string().uuid();

const ItemSchema = z.object({
  id:  UUID,
  qty: z.number().int().min(1).max(99),
});

const SyncSchema = z.object({
  shopId: UUID,
  items:  z.array(ItemSchema).max(50),
});

export interface HydratedCartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  maxStock: number;
  image_url: string | null;
}

/** Idempotent upsert: replaces the customer's row for this shop. */
export async function syncCartToServer(input: z.infer<typeof SyncSchema>): Promise<{ ok?: true; error?: string }> {
  const parse = SyncSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const { error } = await supabase
    .from("carts")
    .upsert(
      {
        customer_id: user.id,
        shop_id:     parse.data.shopId,
        items:       parse.data.items,
        updated_at:  new Date().toISOString(),
        abandoned_email_sent_at: null, // any mutation resets the abandonment clock
      },
      { onConflict: "customer_id,shop_id" }
    );
  if (error) return { error: error.message };
  return { ok: true };
}

/** Drop the cart (e.g. after successful checkout for that shop). */
export async function clearServerCart(shopId: string): Promise<void> {
  const parse = UUID.safeParse(shopId);
  if (!parse.success) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("carts").delete().eq("customer_id", user.id).eq("shop_id", parse.data);
}

/** Returns a fresh cart for the (signed-in customer, shop) — items are
 *  re-priced against the products table; missing/inactive items are dropped. */
export async function hydrateServerCart(shopId: string): Promise<{ items: HydratedCartItem[] }> {
  const parse = UUID.safeParse(shopId);
  if (!parse.success) return { items: [] };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [] };

  const { data: row } = await supabase
    .from("carts")
    .select("items")
    .eq("customer_id", user.id)
    .eq("shop_id", parse.data)
    .maybeSingle();
  const items = ((row?.items as Array<{ id: string; qty: number }> | null) ?? []).filter((it) => typeof it?.id === "string");
  if (items.length === 0) return { items: [] };

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, stock, status, image_url, images")
    .in("id", items.map((i) => i.id));
  const pm = new Map<string, { name: string; price: number; stock: number; status: string; image_url: string | null; images: string[] | null }>();
  for (const p of products ?? []) pm.set(p.id as string, p as never);

  const hydrated: HydratedCartItem[] = [];
  for (const it of items) {
    const p = pm.get(it.id);
    if (!p || p.status !== "active") continue;
    const stock = Number(p.stock ?? 0);
    if (stock <= 0) continue;
    hydrated.push({
      id: it.id,
      name: p.name,
      price: Number(p.price),
      qty: Math.min(it.qty, stock),
      maxStock: stock,
      image_url: p.images?.[0] ?? p.image_url ?? null,
    });
  }
  return { items: hydrated };
}
