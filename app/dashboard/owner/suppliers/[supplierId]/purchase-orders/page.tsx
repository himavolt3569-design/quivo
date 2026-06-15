import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { PurchaseOrdersView } from "@/components/dashboard/owner/suppliers/PurchaseOrdersView";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SupplierPurchaseOrdersPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = await params;
  const ctx = await getOwnerContext();
  const shop = ctx.activeShop;
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

  const [{ data: supplier }, { data: products }, { data: pos }] =
    await Promise.all([
      supabase
        .from("shop_suppliers")
        .select("id, name")
        .eq("id", supplierId)
        .eq("shop_id", shop.id)
        .maybeSingle(),
      supabase
        .from("products")
        .select("id, name, unit, cost_price, stock, low_stock_threshold")
        .eq("shop_id", shop.id)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("purchase_orders")
        .select(
          `
        id, status, ordered_at, expected_at, received_at, total_amount, notes,
        billed_after_receive, created_at,
        lines:purchase_order_lines(id, product_id, qty_ordered, qty_received, unit_cost,
                                   product:products!inner(name))
      `,
        )
        .eq("shop_id", shop.id)
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-lg font-bold text-[#27324A]">
          Supplier not found in this shop.
        </p>
        <Link
          href="/dashboard/owner/suppliers"
          className="text-sm text-[#A7653A] hover:underline font-bold"
        >
          ← Back to suppliers
        </Link>
      </div>
    );
  }

  type RawLine = {
    id: string;
    product_id: string;
    qty_ordered: number;
    qty_received: number;
    unit_cost: number;
    product?: { name?: string } | { name?: string }[] | null;
  };
  type RawPO = {
    id: string;
    status:
      | "draft"
      | "submitted"
      | "partial"
      | "received"
      | "closed"
      | "cancelled";
    ordered_at: string | null;
    expected_at: string | null;
    received_at: string | null;
    total_amount: number;
    notes: string | null;
    billed_after_receive: boolean;
    created_at: string;
    lines: RawLine[] | null;
  };

  const orders = ((pos ?? []) as unknown as RawPO[]).map((po) => ({
    id: po.id,
    status: po.status,
    ordered_at: po.ordered_at,
    expected_at: po.expected_at,
    received_at: po.received_at,
    total_amount: Number(po.total_amount ?? 0),
    notes: po.notes,
    billed_after_receive: po.billed_after_receive,
    created_at: po.created_at,
    lines: (po.lines ?? []).map((l) => {
      const product = Array.isArray(l.product) ? l.product[0] : l.product;
      return {
        id: l.id,
        product_id: l.product_id,
        product_name: product?.name ?? "?",
        qty_ordered: Number(l.qty_ordered),
        qty_received: Number(l.qty_received),
        unit_cost: Number(l.unit_cost),
      };
    }),
  }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <Link
          href={`/dashboard/owner/suppliers/${supplierId}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A]"
        >
          <ChevronLeft className="h-3 w-3" /> Back to supplier
        </Link>
        <h1 className="text-2xl font-black text-[#27324A] mt-1">
          {supplier.name}
        </h1>
      </div>

      <PurchaseOrdersView
        shopId={shop.id}
        supplierId={supplierId}
        supplierName={(supplier.name as string) ?? "Supplier"}
        products={
          (products ?? []) as {
            id: string;
            name: string;
            unit: string | null;
            cost_price: number | null;
            stock: number;
            low_stock_threshold: number | null;
          }[]
        }
        initialOrders={orders}
      />
    </div>
  );
}
