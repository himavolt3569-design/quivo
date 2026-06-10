import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StorefrontPage } from "@/components/storefront/StorefrontPage";
import type {
  ShopData,
  StoreProduct,
} from "@/components/storefront/templates/types";
import { WholesaleBanner } from "@/components/storefront/WholesaleBanner";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: shop } = await supabase
    .rpc("get_public_shop", { p_slug: slug })
    .maybeSingle<ShopData>();

  if (!shop) return { title: "Shop Not Found" };

  return {
    title: `${shop.name} — Shop Online`,
    description: shop.description ?? `Browse and order from ${shop.name}`,
    openGraph: {
      title: shop.name,
      description: shop.description ?? `Browse and order from ${shop.name}`,
    },
  };
}

export default async function PublicShopPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .rpc("get_public_shop", { p_slug: slug })
    .maybeSingle<ShopData>();

  if (!shop) notFound();

  // Wholesale Logic
  let isRetailer = false;
  let retailerShopId: string | null = null;
  let wholesaleStatus: string | null = null;
  let wholesaleDiscount: number | null = null;

  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user) {
    // Check if user is a retailer
    const { data: userShops } = await supabase
      .from("shop_staff")
      .select("shop_id")
      .eq("linked_user_id", userData.user.id)
      .limit(1);
    
    if (userShops && userShops.length > 0) {
      isRetailer = true;
      retailerShopId = userShops[0].shop_id;

      if (shop.is_wholesale) {
        // Check application status
        const { data: application } = await supabase
          .from("wholesale_applications")
          .select("status, override_discount_percent")
          .eq("wholesaler_shop_id", shop.id)
          .eq("retailer_shop_id", retailerShopId)
          .maybeSingle();

        if (application) {
          wholesaleStatus = application.status;
          if (application.status === "approved") {
            if (application.override_discount_percent !== null) {
              wholesaleDiscount = application.override_discount_percent;
            } else {
              // Fetch global discount
              const { data: wShop } = await supabase
                .from("shops")
                .select("wholesale_discount_percent")
                .eq("id", shop.id)
                .single();
              wholesaleDiscount = wShop?.wholesale_discount_percent ?? null;
            }
          }
        }
      }
    }
  }

  const { data: rawProducts } = await supabase
    .from("products")
    .select(
      "id, name, brand, category, unit, variant, price, stock, image_url, images, barcode, description",
    )
    .eq("shop_id", shop.id)
    .eq("status", "active")
    .gt("stock", 0)
    .order("category")
    .order("name");

  const products = (rawProducts ?? []).map((p) => {
    let price = p.price;
    let original_price: number | undefined = undefined;

    if (wholesaleDiscount !== null) {
      original_price = p.price;
      price = p.price * (1 - wholesaleDiscount / 100);
      price = Math.round(price * 100) / 100; // Round to 2 decimals
    }

    return { ...p, price, original_price } as StoreProduct;
  });

  return (
    <>
      <StorefrontPage shop={shop} products={products} />
      {shop.is_wholesale && isRetailer && retailerShopId && (
        <WholesaleBanner
          wholesalerShopId={shop.id}
          retailerShopId={retailerShopId}
          status={wholesaleStatus}
        />
      )}
    </>
  );
}
