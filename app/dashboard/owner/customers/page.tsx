import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { CustomerList } from "@/components/dashboard/owner/customers/CustomerList";
import Link from "next/link";

export default async function CustomersPage() {
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
  const { data: customers } = await supabase
    .from("shop_customers")
    .select("id, name, phone, email, total_spent, order_count, udhar_balance, created_at, updated_at")
    .eq("shop_id", shopId)
    .order("udhar_balance", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 max-w-6xl mx-auto px-1">
        <Link
          href="/dashboard/owner/customers/reviews"
          className="h-9 px-3 rounded-xl bg-white border border-[#2E3344]/10 text-xs font-bold text-[#27324A] hover:bg-[#F7F0E6] inline-flex items-center gap-1"
        >
          Reviews →
        </Link>
        <Link
          href="/dashboard/owner/customers/top"
          className="h-9 px-3 rounded-xl bg-white border border-[#2E3344]/10 text-xs font-bold text-[#27324A] hover:bg-[#F7F0E6] inline-flex items-center gap-1"
        >
          Top customers →
        </Link>
      </div>
      <CustomerList shopId={shopId} initialCustomers={customers ?? []} />
    </div>
  );
}
