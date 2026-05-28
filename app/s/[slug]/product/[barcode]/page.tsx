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

interface PublicProductShop {
  id: string;
  name: string;
  slug: string;
  theme_color: string | null;
  logo_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
}

async function lookupProductInShop(slug: string, barcode: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_product_by_shop_barcode", { p_shop_slug: slug, p_barcode: barcode })
    .maybeSingle<ProductResult>();

  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, barcode } = await params;
  const product = await lookupProductInShop(slug, barcode);
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

  const product = await lookupProductInShop(slug, barcode);

  if (!product) notFound();

  const [{ data: shop }, { data: similar }] = await Promise.all([
    supabase
      .rpc("get_public_shop", { p_slug: slug })
      .maybeSingle<PublicProductShop>(),
    supabase.rpc("get_similar_products", { p_product_id: product.product_id, p_limit: 8 }),
  ]);

  if (!shop) notFound();

  const similarProducts = (similar ?? []) as Array<{
    product_id: string; shop_slug: string; name: string; brand: string | null;
    category: string | null; unit: string | null; variant: string | null;
    price: number; stock: number; image_url: string | null; images: string[] | null;
    barcode: string; match_score: number;
  }>;

  // Product JSON-LD for Google Merchant + rich results.
  const productImage = product.images?.[0] ?? product.image_url ?? null;
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    description: product.description ?? `${product.name} at ${shop.name}.`,
    gtin: product.barcode,
    sku: product.barcode,
    image: productImage ?? undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "NPR",
      price: product.price,
      availability:
        Number(product.stock ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: shop.name },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductView product={product} shop={shop} similar={similarProducts} />
    </>
  );
}
