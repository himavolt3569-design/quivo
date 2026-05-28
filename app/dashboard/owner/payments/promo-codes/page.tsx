import { getOwnerContext } from "@/lib/shop";
import { listPromoCodes } from "@/app/actions/promo";
import { PromoCodesView } from "@/components/dashboard/owner/payments/PromoCodesView";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PromoCodesPage() {
  const ctx = await getOwnerContext();
  const shop = ctx.activeShop;
  if (!shop) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-lg font-bold text-[#27324A]">No shop selected.</p>
        <Link href="/onboarding/owner" className="text-sm text-[#A7653A] hover:underline font-bold">
          Create your first shop →
        </Link>
      </div>
    );
  }
  const { rows } = await listPromoCodes(shop.id);
  return <PromoCodesView shopId={shop.id} initialRows={rows} />;
}
