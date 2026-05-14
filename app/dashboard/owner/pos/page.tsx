import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { POSView } from "@/components/dashboard/owner/pos/POSView";
import Link from "next/link";

export default async function POSPage() {
  const ctx = await getOwnerContext();
  const shopId = ctx.activeShop?.id ?? null;

  if (!shopId) {
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
  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, unit, variant, category, price, stock, image_url")
    .eq("shop_id", shopId)
    .eq("status", "active")
    .gt("stock", 0)
    .order("name");

  return <POSView shopId={shopId} catalogProducts={products ?? []} />;
}
