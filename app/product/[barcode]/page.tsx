import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ barcode: string }>;
}

interface ProductBarcodeLookup {
  shop_slug: string;
  name: string;
  brand: string | null;
  description: string | null;
  price: number;
  images: string[] | null;
  image_url: string | null;
  barcode: string;
}

async function lookupProduct(barcode: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_product_by_barcode", { p_barcode: barcode })
    .limit(1)
    .maybeSingle<ProductBarcodeLookup>();

  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { barcode } = await params;
  const product = await lookupProduct(barcode);

  if (!product) {
    return {
      title: "Product Not Found",
    };
  }

  return {
    title: `${product.name}${product.brand ? ` - ${product.brand}` : ""} · Rs. ${product.price}`,
    description: product.description ?? `View ${product.name} on Quivo`,
    openGraph: {
      title: product.name,
      images: product.images?.length ? [product.images[0]] : product.image_url ? [product.image_url] : [],
    },
  };
}

export default async function ProductBarcodePage({ params }: Props) {
  const { barcode } = await params;
  const product = await lookupProduct(barcode);

  if (!product?.shop_slug || !product.barcode) {
    notFound();
  }

  redirect(`/s/${product.shop_slug}/product/${encodeURIComponent(product.barcode)}`);
}
