import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { ProductForm } from "@/components/dashboard/owner/products/ProductForm";
import Link from "next/link";

export default async function AddProductPage() {
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
  const { data: catalog } = await supabase
    .from("products")
    .select("id, name, brand, category, unit, variant, price, image_url, images")
    .eq("shop_id", shop.id)
    .neq("status", "archived")
    .order("name");

  return <ProductForm shopId={shop.id} shopSlug={shop.slug} catalog={catalog ?? []} />;
}
