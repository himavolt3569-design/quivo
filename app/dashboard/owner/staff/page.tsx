import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { StaffList } from "@/components/dashboard/owner/staff/StaffList";
import Link from "next/link";

export default async function StaffPage() {
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
  const { data: staff } = await supabase
    .from("shop_staff")
    .select("id, name, role, phone, email, notes, status, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: true });

  return <StaffList shopId={shopId} initialStaff={staff ?? []} />;
}
