import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StorefrontPage } from "@/components/storefront/StorefrontPage";
import type { ShopData, StoreProduct } from "@/components/storefront/templates/types";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: shop } = await supabase
    .rpc("get_public_shop", { p_slug: slug })
    .maybeSingle<ShopData>();

  if (!shop) return { title: "Shop Not Found" };

  return {
    title: `${shop.name} — Shop Online`,
    description: shop.description ?? `Browse and order from ${shop.name}`,
    openGraph: {
      title: shop.name,
      description: shop.description ?? `Browse and order from ${shop.name}`,
    },
  };
}

export default async function PublicShopPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .rpc("get_public_shop", { p_slug: slug })
    .maybeSingle<ShopData>();

  if (!shop) notFound();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, category, unit, variant, price, stock, image_url, images, barcode, description")
    .eq("shop_id", shop.id)
    .eq("status", "active")
    .gt("stock", 0)
    .order("category")
    .order("name");

  return <StorefrontPage shop={shop} products={(products ?? []) as StoreProduct[]} />;
}
