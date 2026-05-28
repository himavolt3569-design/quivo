"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const UUID = z.string().uuid();

export interface SavedProductRow {
  id: string;
  product_uuid: string;
  shop_uuid: string;
  product_name: string;
  product_image: string | null;
  price_at_save: number | null;
  price_now: number;
  in_stock: boolean;
  shop_slug: string;
  barcode: string | null;
  saved_at: string;
}

export async function toggleSavedProduct(productId: string): Promise<{ saved?: boolean; error?: string }> {
  const parse = UUID.safeParse(productId);
  if (!parse.success) return { error: "Invalid product id" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to save items." };

  // Existing row?
  const { data: existing } = await supabase
    .from("saved_products")
    .select("id")
    .eq("customer_id", user.id)
    .eq("product_uuid", parse.data)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("saved_products")
      .delete()
      .eq("id", existing.id)
      .eq("customer_id", user.id);
    if (error) {
      log.warn("toggleSavedProduct delete failed", { code: error.code, message: error.message });
      return { error: "Could not remove." };
    }
    revalidatePath("/dashboard/saved");
    return { saved: false };
  }

  // Look up the product so we can populate the denormalized snapshot fields
  // used by the legacy /dashboard/(customer)/saved view + price_at_save.
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, shop_id, name, price, image_url, images")
    .eq("id", parse.data)
    .eq("status", "active")
    .maybeSingle();
  if (prodErr || !product) return { error: "Product not found." };

  const image = (product.images as string[] | null)?.[0] ?? (product.image_url as string | null) ?? null;
  const { error } = await supabase.from("saved_products").insert({
    customer_id: user.id,
    product_uuid: product.id,
    shop_uuid: product.shop_id,
    price_at_save: product.price,
    // Legacy non-null columns kept populated.
    product_id: product.id, // TEXT col; UUID coerces.
    product_name: product.name,
    product_price: String(product.price),
    product_image: image,
  });
  if (error) {
    log.warn("toggleSavedProduct insert failed", { code: error.code, message: error.message });
    return { error: "Could not save." };
  }
  revalidatePath("/dashboard/saved");
  return { saved: true };
}

export async function isProductSaved(productId: string): Promise<boolean> {
  if (!UUID.safeParse(productId).success) return false;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("saved_products")
    .select("id")
    .eq("customer_id", user.id)
    .eq("product_uuid", productId)
    .maybeSingle();
  return data != null;
}

export async function listMySavedProducts(): Promise<{ rows: SavedProductRow[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { rows: [] };

  const { data, error } = await supabase
    .from("saved_products")
    .select(`
      id, product_uuid, shop_uuid, price_at_save, created_at,
      product_name, product_image,
      products!saved_products_product_uuid_fkey ( id, name, price, stock, image_url, images, barcode, status ),
      shops!saved_products_shop_uuid_fkey ( slug, status )
    `)
    .eq("customer_id", user.id)
    .not("product_uuid", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    log.warn("listMySavedProducts failed", { code: error.code, message: error.message });
    return { rows: [], error: error.message };
  }

  type Row = {
    id: string;
    product_uuid: string;
    shop_uuid: string;
    price_at_save: number | null;
    created_at: string;
    product_name: string | null;
    product_image: string | null;
    products: { id: string; name: string; price: number; stock: number; image_url: string | null; images: string[] | null; barcode: string | null; status: string } | null;
    shops: { slug: string; status: string } | null;
  };

  const rows: SavedProductRow[] = ((data ?? []) as unknown as Row[])
    .filter((r) => r.products && r.shops)
    .map((r) => ({
      id: r.id,
      product_uuid: r.product_uuid,
      shop_uuid: r.shop_uuid,
      product_name: r.products!.name ?? r.product_name ?? "Item",
      product_image: r.products!.images?.[0] ?? r.products!.image_url ?? r.product_image ?? null,
      price_at_save: r.price_at_save,
      price_now: Number(r.products!.price ?? 0),
      in_stock: Number(r.products!.stock ?? 0) > 0 && r.products!.status === "active" && r.shops!.status === "active",
      shop_slug: r.shops!.slug,
      barcode: r.products!.barcode,
      saved_at: r.created_at,
    }));

  return { rows };
}
