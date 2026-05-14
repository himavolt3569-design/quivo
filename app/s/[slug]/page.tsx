import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StorefrontPage } from "@/components/storefront/StorefrontPage";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("name, description, theme_color")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

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
    .from("shops")
    .select(
      "id, name, slug, description, phone, address, opening_time, closing_time, logo_url, " +
      "theme_color, theme_layout, template, font_family, " +
      "hero_headline, hero_subtext, cover_image_url, " +
      "announcement_text, announcement_active, sections_order, " +
      "whatsapp_number, featured_product_ids"
    )
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!shop) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopRow = shop as any;

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, category, unit, variant, price, stock, image_url, images, barcode, description")
    .eq("shop_id", shopRow.id)
    .eq("status", "active")
    .gt("stock", 0)
    .order("category")
    .order("name");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <StorefrontPage shop={shop as any} products={products ?? []} />;
}
