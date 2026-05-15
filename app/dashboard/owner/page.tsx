import { createClient } from "@/lib/supabase/server";
import { OwnerDashboard } from "@/components/dashboard/OwnerDashboard";
import { getOwnerContext } from "@/lib/shop";

export default async function OwnerPage() {
  const supabase = await createClient();
  const ctx = await getOwnerContext();
  const activeShop = ctx.activeShop;
  const shopId = activeShop?.id ?? null;

  type DashStats = {
    today_sales: number;
    pending_orders: number;
    low_stock_count: number;
    total_udhar: number;
    supplier_dues: number;
  };

  const defaultStats: DashStats = {
    today_sales: 0,
    pending_orders: 0,
    low_stock_count: 0,
    total_udhar: 0,
    supplier_dues: 0,
  };

  let dashStats: DashStats = defaultStats;
  let revenueChartData: { day: string; revenue: number }[] = [];
  let lowStockItems: { id: string; name: string; stock: number; low_stock_threshold: number | null }[] = [];
  let recentTransactions: { id: string; created_at: string; amount: number; type: string; payment_method: string | null }[] = [];
  let pendingOrders: { id: string; created_at: string; total_amount: number; status: string }[] = [];

  if (shopId) {
    const [statsRes, revenueRes, lowStockRes, txnRes, ordersRes] = await Promise.all([
      supabase.rpc("get_shop_dashboard_stats", { p_shop_id: shopId }),
      supabase.rpc("get_shop_revenue_by_day", { p_shop_id: shopId, p_days: 7 }),
      supabase
        .from("products")
        .select("id, name, stock, low_stock_threshold")
        .eq("shop_id", shopId)
        .eq("status", "active")
        .lte("stock", 10)
        .order("stock", { ascending: true })
        .limit(5),
      supabase
        .from("shop_transactions")
        .select("id, created_at, amount, type, payment_method")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("orders")
        .select("id, created_at, total_amount, status")
        .eq("shop_id", shopId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const raw = statsRes.data;
    const statsRow = Array.isArray(raw) ? raw[0] : raw;
    if (statsRow) dashStats = statsRow as DashStats;

    revenueChartData = Array.isArray(revenueRes.data) ? (revenueRes.data as { day: string; revenue: number }[]) : [];
    lowStockItems = (lowStockRes.data ?? []) as typeof lowStockItems;
    recentTransactions = (txnRes.data ?? []) as typeof recentTransactions;
    pendingOrders = (ordersRes.data ?? []) as typeof pendingOrders;
  }

  const shopForUI = activeShop
    ? { id: activeShop.id, slug: activeShop.slug, name: activeShop.name, status: activeShop.status }
    : null;

  return (
    <OwnerDashboard
      shop={shopForUI}
      shopCount={ctx.shops.length}
      dashStats={dashStats}
      revenueChartData={revenueChartData}
      lowStockItems={lowStockItems}
      recentTransactions={recentTransactions}
      pendingOrders={pendingOrders}
    />
  );
}
