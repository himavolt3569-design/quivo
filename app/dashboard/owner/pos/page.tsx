import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { POSView } from "@/components/dashboard/owner/pos/POSView";
import { listHeldSales } from "@/app/actions/pos";
import Link from "next/link";

export default async function POSPage() {
  const ctx = await getOwnerContext();
  const activeShop = ctx.activeShop ?? null;

  if (!activeShop) {
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
  const { data: { user } } = await supabase.auth.getUser();
  const [
    { data: products },
    { data: profile },
    { data: shopRow },
    held,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, brand, unit, variant, category, price, stock, image_url")
      .eq("shop_id", activeShop.id)
      .eq("status", "active")
      .gt("stock", 0)
      .order("category")
      .order("name"),
    user
      ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("shops")
      .select("vat_registered, vat_rate, pan_number")
      .eq("id", activeShop.id)
      .maybeSingle(),
    listHeldSales(activeShop.id),
  ]);

  return (
    <POSView
      shopId={activeShop.id}
      shopName={activeShop.name}
      ownerName={profile?.full_name ?? ""}
      catalogProducts={products ?? []}
      shopVatRegistered={Boolean(shopRow?.vat_registered)}
      shopVatRate={Number(shopRow?.vat_rate ?? 13)}
      shopPanNumber={(shopRow?.pan_number as string | null) ?? null}
      initialHeldSales={held.rows ?? []}
    />
  );
}
