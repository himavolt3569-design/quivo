import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { StockTransferView } from "@/components/dashboard/owner/products/StockTransferView";
import { listRecentTransfers } from "@/app/actions/stock-transfers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StockTransfersPage() {
  const ctx = await getOwnerContext();
  const shops = ctx.shops;
  const active = ctx.activeShop;

  if (!active || shops.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center max-w-md mx-auto px-6">
        <p className="text-lg font-bold text-[#27324A]">Inter-shop transfer</p>
        <p className="text-sm font-medium text-[#746E73]">
          You need at least two shops you own or manage to transfer stock between them.
        </p>
        <Link href="/dashboard/owner" className="text-sm text-[#A7653A] hover:underline font-bold">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: products }, history] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, unit, stock")
      .eq("shop_id", active.id)
      .eq("status", "active")
      .gt("stock", 0)
      .order("name"),
    listRecentTransfers(active.id),
  ]);

  return (
    <StockTransferView
      shops={shops.map((s) => ({ id: s.id, name: s.name }))}
      activeShopId={active.id}
      sourceProducts={(products ?? []) as Parameters<typeof StockTransferView>[0]["sourceProducts"]}
      history={(history.rows ?? []) as unknown as Parameters<typeof StockTransferView>[0]["history"]}
    />
  );
}
