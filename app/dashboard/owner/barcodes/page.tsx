import { getOwnerContext } from "@/lib/shop";
import { BarcodeManager } from "@/components/dashboard/owner/barcodes/BarcodeManager";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function BarcodesPage() {
  const ctx = await getOwnerContext();
  const shop = ctx.activeShop ?? null;

  if (!shop) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-lg font-bold text-slate-900">No shop selected.</p>
        <Link
          href="/onboarding/owner"
          className="text-sm text-blue-500 hover:underline font-bold"
        >
          Create your first shop →
        </Link>
      </div>
    );
  }

  const products = await prisma.products.findMany({
    where: {
      shop_id: shop.id,
      status: { not: "archived" },
    },
    select: {
      id: true,
      name: true,
      price: true,
      barcode: true,
      stock: true,
      low_stock_threshold: true,
    },
    orderBy: { name: "asc" },
  });

  const mappedCatalog = products.map(p => ({
    ...p,
    price: Number(p.price),
    stock: p.stock ? Number(p.stock) : null,
    low_stock_threshold: p.low_stock_threshold ? Number(p.low_stock_threshold) : null,
  }));

  return (
    <BarcodeManager
      shopId={shop.id}
      shopName={shop.name}
      catalog={mappedCatalog}
    />
  );
}
