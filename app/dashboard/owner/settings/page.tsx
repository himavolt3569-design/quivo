import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { ShopSettings } from "@/components/dashboard/owner/settings/ShopSettings";
import Link from "next/link";
import { ShieldCheck, FileSpreadsheet, Bell } from "lucide-react";

export default async function SettingsPage() {
  const ctx = await getOwnerContext();
  const activeShop = ctx.activeShop;

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
  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, description, phone, address, opening_time, closing_time, pan_number, logo_url, vat_registered, vat_rate, timezone")
    .eq("id", activeShop.id)
    .single();

  return (
    <div className="space-y-6">
      {/* Compliance & audit shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl mx-auto">
        <Link
          href="/dashboard/owner/settings/audit"
          className="bg-white p-4 rounded-2xl border border-[#2E3344]/8 shadow-sm hover:shadow-md transition flex items-center gap-3"
        >
          <span className="h-10 w-10 rounded-xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-[#27324A] text-sm">Audit log</p>
            <p className="text-[11px] text-[#746E73]">Payment lifecycle + security events for this shop.</p>
          </div>
        </Link>
        <Link
          href="/dashboard/owner/finances/vat"
          className="bg-white p-4 rounded-2xl border border-[#2E3344]/8 shadow-sm hover:shadow-md transition flex items-center gap-3"
        >
          <span className="h-10 w-10 rounded-xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-[#27324A] text-sm">VAT-3 export</p>
            <p className="text-[11px] text-[#746E73]">Monthly IRD-format report for VAT-registered shops.</p>
          </div>
        </Link>
        <Link
          href="/dashboard/owner/settings/notifications"
          className="bg-white p-4 rounded-2xl border border-[#2E3344]/8 shadow-sm hover:shadow-md transition flex items-center gap-3"
        >
          <span className="h-10 w-10 rounded-xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-[#27324A] text-sm">Notifications</p>
            <p className="text-[11px] text-[#746E73]">Pick which updates land where (in-app, email).</p>
          </div>
        </Link>
      </div>

      <ShopSettings shopId={activeShop.id} initialData={shop ?? { id: activeShop.id, name: activeShop.name }} />
    </div>
  );
}
