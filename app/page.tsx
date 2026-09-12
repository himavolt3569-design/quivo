import { Suspense } from "react";
import { AuthErrorToast } from "@/components/AuthErrorToast";
import HomeClient from "./HomeClient";
import { prisma } from "@/lib/prisma";
import { TrendingProduct } from "@/lib/types";

export default async function Home() {

  const productsData = await prisma.products.findMany({
    where: { status: "active" },
    take: 8,
    include: { shops: true },
  });

  const trendingProducts: TrendingProduct[] = productsData.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    stock: p.stock ? Number(p.stock) : 0,
    image_url: p.image_url,
    barcode: p.barcode,
    shop_id: p.shop_id,
    shop_name: p.shops?.name || "Unknown Shop",
    shop_slug: p.shops?.slug || "",
  }));

  const activeShops = await prisma.shops.findMany({
    where: { status: "active" },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      logo_url: true,
      created_at: true,
    },
    take: 12,
  });

  const mappedShops = activeShops.map(shop => ({
    ...shop,
    image_url: shop.logo_url,
  }));

  return (
    <>
      <Suspense fallback={null}>
        <AuthErrorToast />
      </Suspense>
      <HomeClient trendingProducts={trendingProducts} activeShops={mappedShops as any} />
    </>
  );
}
