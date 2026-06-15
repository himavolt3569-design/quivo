import { getOwnerContext } from "@/lib/shop";
import { ProductImportView } from "@/components/dashboard/owner/products/ProductImportView";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProductImportPage() {
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

  return <ProductImportView shopId={shop.id} />;
}
