import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { SupplierList } from "@/components/dashboard/owner/suppliers/SupplierList";
import Link from "next/link";

export default async function SuppliersPage() {
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
  const { data: suppliers } = await supabase
    .from("shop_suppliers")
    .select("id, name, contact_person, phone, email, address, category, logo_url, tax_id, notes, opening_balance, balance_due, status, created_at")
    .eq("shop_id", shopId)
    .eq("status", "active")
    .order("balance_due", { ascending: false });

  return <SupplierList shopId={shopId} initialSuppliers={suppliers ?? []} />;
}
