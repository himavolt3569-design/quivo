import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HomeTab } from "@/components/dashboard/customer/HomeTab";
import type { Order, Profile, SavedShop, SavedProduct, Transaction, TrendingProduct, NearbyShop } from "@/lib/types";
import { log } from "@/lib/log";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/?login=true");
  }

  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).toISOString();

  const [
    { data: profile, error: profileError },
    { data: activeOrders, error: activeOrdersError },
    { data: pastOrders, error: pastOrdersError },
    { data: savedShops, error: savedShopsError },
    { data: savedProducts, error: savedProductsError },
    { count: totalOrderCount, error: totalCountError },
    { count: pastOrderCount, error: pastCountError },
    { count: addressCount, error: addressCountError },
    { data: monthOrders, error: monthOrdersError },
    { data: recentTransactions, error: recentTransactionsError },
    { data: rawTrending },
    { data: rawNearbyShops },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single<Profile>(),

    supabase
      .from("orders")
      .select("*")
      .eq("customer_id", user.id)
      .not("status", "in", "(delivered,cancelled)")
      .order("created_at", { ascending: false })
      .returns<Order[]>(),

    supabase
      .from("orders")
      .select("*")
      .eq("customer_id", user.id)
      .in("status", ["delivered", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<Order[]>(),

    supabase
      .from("saved_shops")
      .select("*")
      .eq("customer_id", user.id)
      .returns<SavedShop[]>(),

    supabase
      .from("saved_products")
      .select("*")
      .eq("customer_id", user.id)
      .returns<SavedProduct[]>(),

    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id),

    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id)
      .in("status", ["delivered", "cancelled"]),

    supabase
      .from("addresses")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id),

    supabase
      .from("orders")
      .select("total_amount")
      .eq("customer_id", user.id)
      .neq("status", "cancelled")
      .gte("created_at", monthStart)
      .returns<{ total_amount: number }[]>(),

    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4)
      .returns<Transaction[]>(),

    // Trending products from real catalog (non-archived, newest first)
    supabase
      .from("products")
      .select("id, name, price, stock, image_url, barcode, shop_id, shops(name, slug)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(8),

    // Verified shops for discovery — use SECURITY DEFINER RPC (direct SELECT
    // on shops is restricted to shop members by RLS; customers would get 0 rows).
    supabase.rpc("get_verified_shops"),
  ]);

  const errors = [
    profileError,
    activeOrdersError,
    pastOrdersError,
    savedShopsError,
    savedProductsError,
    totalCountError,
    pastCountError,
    addressCountError,
    monthOrdersError,
    recentTransactionsError,
  ].filter(Boolean);

  if (errors.length > 0) {
    log.error("customer/home: database query failures", { errors });
    throw new Error("Failed to load dashboard data. Please try again later.");
  }

  const monthlySpend =
    monthOrders?.reduce((sum, o) => sum + o.total_amount, 0) ?? 0;

  // Normalise Supabase join shape → flat TrendingProduct[]
  const trendingProducts: TrendingProduct[] = (rawTrending ?? [])
    .filter((p) => p.shops && !Array.isArray(p.shops))
    .map((p) => {
      const shop = p.shops as unknown as { name: string; slug: string };
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock ?? null,
        image_url: p.image_url ?? null,
        barcode: p.barcode ?? null,
        shop_id: p.shop_id,
        shop_name: shop.name,
        shop_slug: shop.slug,
      };
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nearbyShops: NearbyShop[] = (rawNearbyShops ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    category: s.category ?? null,
    image_url: s.image_url ?? null,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
  }));

  return (
    <HomeTab
      user={user}
      profile={profile}
      activeOrders={activeOrders ?? []}
      pastOrders={pastOrders ?? []}
      savedShops={savedShops ?? []}
      savedProducts={savedProducts ?? []}
      monthlySpend={monthlySpend}
      totalOrderCount={totalOrderCount ?? 0}
      pastOrderCount={pastOrderCount ?? 0}
      addressCount={addressCount ?? 0}
      recentTransactions={recentTransactions ?? []}
      trendingProducts={trendingProducts}
      nearbyShops={nearbyShops}
    />
  );
}
