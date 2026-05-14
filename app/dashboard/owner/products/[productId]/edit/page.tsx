import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { notFound } from "next/navigation";
import { EditProductForm } from "@/components/dashboard/owner/products/EditProductForm";
import Link from "next/link";

interface Props {
  params: Promise<{ productId: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { productId } = await params;
  const ctx = await getOwnerContext();
  const shop = ctx.activeShop ?? null;

  if (!shop) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-lg font-bold text-[#27324A]">No shop selected.</p>
        <Link href="/onboarding/owner" className="text-sm text-[#A7653A] hover:underline font-bold">
          Create your first shop →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, name, brand, category, unit, variant, description, price, cost_price, stock, low_stock_threshold, barcode, status, image_url, images")
    .eq("id", productId)
    .eq("shop_id", shop.id)
    .neq("status", "archived")
    .single();

  if (!product) notFound();

  return (
    <EditProductForm
      shopId={shop.id}
      shopSlug={shop.slug}
      product={product as Parameters<typeof EditProductForm>[0]["product"]}
    />
  );
}
