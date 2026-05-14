import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { ShopSettings } from "@/components/dashboard/owner/settings/ShopSettings";
import Link from "next/link";

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
    .select("id, name, description, phone, address, opening_time, closing_time, pan_number, logo_url")
    .eq("id", activeShop.id)
    .single();

  return <ShopSettings shopId={activeShop.id} initialData={shop ?? { id: activeShop.id, name: activeShop.name }} />;
}
