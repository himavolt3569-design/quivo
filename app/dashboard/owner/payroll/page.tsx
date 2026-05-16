import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { PayrollView, type StaffRateRow, type StaffOption } from "@/components/dashboard/owner/payroll/PayrollView";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
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
  const [{ data: staff }, { data: rates }] = await Promise.all([
    supabase
      .from("shop_staff")
      .select("id, name, status")
      .eq("shop_id", shopId)
      .order("name", { ascending: true }),
    supabase
      .from("staff_rates")
      .select("id, staff_id, hourly_rate, currency, effective_from, note")
      .eq("shop_id", shopId)
      .order("effective_from", { ascending: false }),
  ]);

  const staffOptions: StaffOption[] = (staff ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
  }));

  const ratesByStaff = new Map<string, StaffRateRow[]>();
  for (const r of rates ?? []) {
    const list = ratesByStaff.get(r.staff_id) ?? [];
    list.push({
      id: r.id,
      staff_id: r.staff_id,
      hourly_rate: Number(r.hourly_rate),
      currency: r.currency,
      effective_from: r.effective_from,
      note: r.note,
    });
    ratesByStaff.set(r.staff_id, list);
  }

  return (
    <PayrollView
      shopId={shopId}
      shopName={ctx.activeShop?.name ?? "Shop"}
      staff={staffOptions}
      ratesByStaff={Object.fromEntries(ratesByStaff)}
    />
  );
}
