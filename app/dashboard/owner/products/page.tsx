import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { ProductList } from "@/components/dashboard/owner/products/ProductList";
import Link from "next/link";

type Filter = "all" | "low_stock" | "out_of_stock" | "active";

function parseFilter(v: string | string[] | undefined): Filter {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "low_stock" || s === "out_of_stock" || s === "active") return s;
  return "all";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
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

  const sp = await searchParams;
  const filter = parseFilter(sp.filter);

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, unit, variant, category, price, cost_price, stock, low_stock_threshold, barcode, status, image_url, images, created_at")
    .eq("shop_id", shop.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  return (
    <ProductList
      shopId={shop.id}
      shopSlug={shop.slug}
      initialProducts={products ?? []}
      initialFilter={filter}
      hasMultipleShops={ctx.shops.length >= 2}
    />
  );
}
