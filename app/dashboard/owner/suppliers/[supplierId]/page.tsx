import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { SupplierLedgerView } from "@/components/dashboard/owner/suppliers/SupplierLedgerView";

interface Props {
  params: Promise<{ supplierId: string }>;
}

export default async function SupplierLedgerPage({ params }: Props) {
  const { supplierId } = await params;
  const ctx = await getOwnerContext();
  const shop = ctx.activeShop ?? null;

  if (!shop) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-bold text-[#27324A]">No shop selected.</p>
        <Link
          href="/onboarding/owner"
          className="text-sm font-bold text-[#A7653A] hover:underline"
        >
          Create your first shop →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: supplier }, { data: transactions }] = await Promise.all([
    supabase
      .from("shop_suppliers")
      .select(
        "id, name, contact_person, phone, email, address, category, logo_url, tax_id, notes, opening_balance, balance_due, created_at",
      )
      .eq("id", supplierId)
      .eq("shop_id", shop.id)
      .neq("status", "inactive")
      .single(),
    supabase
      .from("shop_transactions")
      .select(
        "id, amount, type, reference_id, description, payment_method, created_at",
      )
      .eq("shop_id", shop.id)
      .eq("reference_id", supplierId)
      .in("type", ["expense", "supplier_payment"])
      .order("created_at", { ascending: true }),
  ]);

  if (!supplier) notFound();

  return (
    <div className="space-y-4">
      <div className="max-w-6xl mx-auto px-1 flex justify-end">
        <Link
          href={`/dashboard/owner/suppliers/${supplierId}/purchase-orders`}
          className="h-10 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm inline-flex items-center gap-2"
        >
          Purchase orders →
        </Link>
      </div>
      <SupplierLedgerView
        shopId={shop.id}
        shopName={shop.name}
        supplier={supplier}
        transactions={
          (transactions ?? []) as Parameters<
            typeof SupplierLedgerView
          >[0]["transactions"]
        }
        generatedAt={new Date().toISOString()}
      />
    </div>
  );
}
