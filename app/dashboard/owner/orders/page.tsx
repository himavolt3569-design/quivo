import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { OrderList } from "@/components/dashboard/owner/orders/OrderList";
import Link from "next/link";

export default async function OrdersPage() {
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
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, customer_id, status, total_amount, tax_amount, tax_rate, items, notes, delivery_address, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(100);

  return <OrderList shopId={shopId} initialOrders={orders ?? []} />;
}
