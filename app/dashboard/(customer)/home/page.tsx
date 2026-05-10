import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HomeTab } from "@/components/dashboard/customer/HomeTab";
import type { Order, Profile, SavedShop, SavedProduct, Transaction } from "@/lib/types";

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
    { data: profile },
    { data: activeOrders },
    { data: pastOrders },
    { data: savedShops },
    { data: savedProducts },
    { count: totalOrderCount },
    { count: pastOrderCount },
    { count: addressCount },
    { data: monthOrders },
    { data: recentTransactions },
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
  ]);

  const monthlySpend =
    monthOrders?.reduce((sum, o) => sum + o.total_amount, 0) ?? 0;

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
    />
  );
}
