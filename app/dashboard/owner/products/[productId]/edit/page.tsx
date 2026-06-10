import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { notFound } from "next/navigation";
import { EditProductForm } from "@/components/dashboard/owner/products/EditProductForm";
import { BatchesPanel } from "@/components/dashboard/owner/products/BatchesPanel";
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
        <Link
          href="/onboarding/owner"
          className="text-sm text-[#A7653A] hover:underline font-bold"
        >
          Create your first shop →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: product }, { data: batches }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, brand, category, unit, variant, description, price, cost_price, stock, low_stock_threshold, barcode, status, image_url, images",
      )
      .eq("id", productId)
      .eq("shop_id", shop.id)
      .neq("status", "archived")
      .single(),
    supabase
      .from("product_batches")
      .select(
        "id, batch_no, expiry_date, received_qty, remaining_qty, cost_price, received_at",
      )
      .eq("product_id", productId)
      .eq("shop_id", shop.id)
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .order("received_at", { ascending: false })
      .limit(60),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <EditProductForm
        shopId={shop.id}
        shopSlug={shop.slug}
        product={product as Parameters<typeof EditProductForm>[0]["product"]}
      />
      <div className="max-w-4xl mx-auto">
        <BatchesPanel
          shopId={shop.id}
          productId={productId}
          productName={(product.name as string) ?? "Product"}
          initialBatches={
            (batches ?? []) as Parameters<
              typeof BatchesPanel
            >[0]["initialBatches"]
          }
        />
      </div>
    </div>
  );
}
