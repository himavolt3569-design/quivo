import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductView } from "@/components/storefront/ProductView";

interface Props {
  params: Promise<{ slug: string; barcode: string }>;
}

interface ProductResult {
  product_id: string;
  shop_id: string;
  shop_slug: string;
  shop_name: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string | null;
  variant: string | null;
  description: string | null;
  price: number;
  stock: number;
  images: string[] | null;
  image_url: string | null;
  barcode: string;
  is_available?: boolean;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { barcode } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.rpc as any)("get_product_by_barcode", { p_barcode: barcode });
  const product = data as ProductResult | null;
  if (!product) return { title: "Product Not Found" };
  return {
    title: `${product.name}${product.brand ? ` — ${product.brand}` : ""} · Rs. ${product.price}`,
    description: product.description ?? `Buy ${product.name} online`,
    openGraph: {
      title: product.name,
      images: product.images?.length ? [product.images[0]] : product.image_url ? [product.image_url] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug, barcode } = await params;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.rpc as any)("get_product_by_barcode", { p_barcode: barcode });
  const product = data as ProductResult | null;

  if (!product || product.shop_slug !== slug) notFound();

  const [{ data: shop }, { data: similar }] = await Promise.all([
    supabase
      .from("shops")
      .select("id, name, slug, theme_color, logo_url, phone, whatsapp_number")
      .eq("slug", slug)
      .single(),
    supabase.rpc("get_similar_products", { p_product_id: product.product_id, p_limit: 8 }),
  ]);

  if (!shop) notFound();

  const similarProducts = (similar ?? []) as Array<{
    product_id: string; shop_slug: string; name: string; brand: string | null;
    category: string | null; unit: string | null; variant: string | null;
    price: number; stock: number; image_url: string | null; images: string[] | null;
    barcode: string; match_score: number;
  }>;

  return <ProductView product={product} shop={shop} similar={similarProducts} />;
}
