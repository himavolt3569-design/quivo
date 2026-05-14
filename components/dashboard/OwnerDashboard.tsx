"use client";

import {
  ReceiptText,
  WalletCards,
  Store,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Plus,
  Banknote,
  FileText,
  Barcode,
  QrCode,
  UserPlus,
  Truck,
  Camera,
  Clock,
  PackageMinus,
  Calculator,
} from "lucide-react";
import Link from "next/link";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

interface DashStats {
  today_sales: number;
  pending_orders: number;
  low_stock_count: number;
  total_udhar: number;
  supplier_dues: number;
}

interface RevenueDay {
  day: string;
  revenue: number;
}

interface LowStockItem {
  id: string;
  name: string;
  stock: number;
  low_stock_threshold: number | null;
}

interface RecentTransaction {
  id: string;
  created_at: string;
  amount: number;
  type: string;
  payment_method: string | null;
}

interface PendingOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
}

interface OwnerDashboardProps {
  shop: { id: string; slug: string; name: string; status: string } | null;
  shopCount: number;
  dashStats: DashStats;
  revenueChartData: RevenueDay[];
  lowStockItems: LowStockItem[];
  recentTransactions: RecentTransaction[];
  pendingOrders: PendingOrder[];
}

const STATUS_LABEL: Record<string, string> = {
  active: "Business is Open",
  paused: "Paused",
  closed: "Closed",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  paused: "bg-amber-500",
  closed: "bg-zinc-400",
};

const TXN_TYPE_COLOR: Record<string, string> = {
  sale: "text-green-600",
  expense: "text-red-500",
  udhar_payment: "text-blue-500",
  supplier_payment: "text-orange-500",
};

const TXN_TYPE_LABEL: Record<string, string> = {
  sale: "Sale",
  expense: "Expense",
  udhar_payment: "Udhar Rcvd",
  supplier_payment: "Supplier Paid",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const QUICK_ACTIONS = [
  { label: "Cash Sale", icon: Calculator, href: "/dashboard/owner/pos", color: "bg-[#27324A] text-white hover:bg-[#1b2333]" },
  { label: "Add Product", icon: Plus, href: "/dashboard/owner/products/add", color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
  { label: "Add Expense", icon: ReceiptText, href: "/dashboard/owner/finances", color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
  { label: "New Invoice", icon: FileText, href: null, color: "bg-white text-[#27324A] border border-[#2E3344]/10 opacity-50 cursor-not-allowed" },
  { label: "Barcode Scan", icon: Barcode, href: "/dashboard/owner/pos", color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
  { label: "Shop QR", icon: QrCode, href: "/dashboard/owner/storefront", color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
  { label: "Add Customer", icon: UserPlus, href: "/dashboard/owner/customers", color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
  { label: "Upload Bill", icon: Camera, href: null, color: "bg-white text-[#27324A] border border-[#2E3344]/10 opacity-50 cursor-not-allowed" },
];

export function OwnerDashboard({
  shop,
  shopCount,
  dashStats,
  revenueChartData,
  lowStockItems,
  recentTransactions,
  pendingOrders,
}: OwnerDashboardProps) {
  const nameParts = (shop?.name ?? "Your Shop").split(/\s+/);
  const firstWord = nameParts[0];
  const restName = nameParts.slice(1).join(" ");
  const statusKey = shop?.status ?? "active";
  const statusLabel = STATUS_LABEL[statusKey] ?? statusKey;
  const statusDot = STATUS_DOT[statusKey] ?? "bg-zinc-400";

  const chartData = revenueChartData.map((d) => ({
    name: new Date(d.day + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }),
    revenue: Number(d.revenue) || 0,
  }));

  const kpis = [
    {
      label: "Today's Sales",
      value: `Rs. ${dashStats.today_sales.toLocaleString()}`,
      icon: TrendingUp,
      badge: null,
      alert: false,
    },
    {
      label: "Pending Udhar",
      value: `Rs. ${dashStats.total_udhar.toLocaleString()}`,
      icon: WalletCards,
      badge: null,
      alert: false,
    },
    {
      label: "Supplier Dues",
      value: `Rs. ${dashStats.supplier_dues.toLocaleString()}`,
      icon: Truck,
      badge: null,
      alert: dashStats.supplier_dues > 0,
    },
    {
      label: "Low Stock",
      value: `${dashStats.low_stock_count} Items`,
      icon: AlertTriangle,
      badge: dashStats.low_stock_count > 0 ? "Action Needed" : "OK",
      alert: dashStats.low_stock_count > 0,
    },
    {
      label: "Pending Orders",
      value: `${dashStats.pending_orders}`,
      icon: ShoppingCart,
      badge: "Online",
      alert: false,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 opacity-[0.03] pointer-events-none">
          <Store className="w-64 h-64 rotate-12" />
        </div>
        <div className="relative z-10 min-w-0">
          <h1 className="text-3xl font-black tracking-[-0.03em] text-[#27324A]">
            {firstWord}
            {restName && <span className="text-[#A7653A]"> {restName}</span>}
          </h1>
          {shop ? (
            <p className="mt-1 text-sm font-bold text-[#746E73] flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Storefront{" "}
                <a
                  href={`/s/${shop.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#A7653A] hover:underline"
                >
                  /s/{shop.slug} ↗
                </a>
              </span>
              <span className="text-[#746E73]/30">·</span>
              <Link href="/onboarding/owner" className="text-[#A7653A] hover:underline">
                + New shop
              </Link>
              {shopCount > 1 && (
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#746E73]">
                  {shopCount} shops
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm font-bold text-[#746E73]">
              You haven&apos;t created a shop yet.{" "}
              <Link href="/onboarding/owner" className="text-[#A7653A] hover:underline">
                Set up your first shop →
              </Link>
            </p>
          )}
        </div>
        <div className="relative z-10 flex items-center gap-2 bg-[#F7F0E6] py-2 px-4 rounded-xl border border-[#A7653A]/20 self-start sm:self-auto">
          <div className={`h-2 w-2 rounded-full ${statusDot} ${statusKey === "active" ? "animate-pulse" : ""}`} />
          <span className="text-xs font-bold text-[#A7653A] uppercase tracking-widest">{statusLabel}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className={`p-5 rounded-[1.5rem] bg-white border border-[#2E3344]/8 shadow-sm flex flex-col justify-between ${
              kpi.alert ? "border-orange-200 bg-orange-50/50" : ""
            }`}
          >
            <div className="flex justify-between items-start">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  kpi.alert ? "bg-orange-100 text-orange-600" : "bg-[#F7F0E6] text-[#A7653A]"
                }`}
              >
                <kpi.icon className="h-5 w-5" />
              </div>
              {kpi.badge && (
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    kpi.alert ? "bg-orange-100 text-orange-700" : "bg-green-50 text-green-600"
                  }`}
                >
                  {kpi.badge}
                </span>
              )}
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black text-[#27324A]">{kpi.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73] mt-1">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-[#746E73] mb-3 ml-2">Quick Actions</h2>
        <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-2 hide-scrollbar">
          {QUICK_ACTIONS.map((action, i) => {
            const inner = (
              <>
                <action.icon className="h-5 w-5" />
                <span className="text-[10px] font-bold text-center leading-tight">{action.label}</span>
              </>
            );
            const cls = `${action.color} flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all active:scale-95 min-w-[90px] sm:min-w-0 shadow-sm`;
            if (action.href) {
              return (
                <Link key={i} href={action.href} className={cls}>
                  {inner}
                </Link>
              );
            }
            return (
              <button key={i} disabled className={cls}>
                {inner}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Charts & Lists Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Revenue Chart */}
          <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-[#27324A]">Revenue Overview</h2>
                <p className="text-xs text-[#746E73] font-medium">Daily sales — last 7 days</p>
              </div>
              <Link
                href="/dashboard/owner/finances"
                className="text-xs font-bold text-[#A7653A] hover:underline"
              >
                Full Report →
              </Link>
            </div>
            {chartData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-[#746E73] font-medium">
                No sales data yet. Start selling via POS!
              </div>
            ) : (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#746E73" }}
                      dy={10}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#746E73" }} />
                    <RechartsTooltip
                      cursor={{ stroke: "#A7653A", strokeWidth: 1, strokeDasharray: "3 3" }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(v) => [`Rs. ${Number(v).toLocaleString()}`, "Revenue"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#A7653A"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#A7653A", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6 }}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Low Stock + Recent Transactions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Low Stock */}
            <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                  <PackageMinus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[#27324A]">Low Stock Items</h2>
                  <p className="text-[10px] uppercase tracking-widest text-[#746E73] font-bold">Needs Restocking</p>
                </div>
              </div>
              {lowStockItems.length === 0 ? (
                <p className="text-xs text-[#746E73] font-medium text-center py-4">
                  All products well-stocked!
                </p>
              ) : (
                <div className="space-y-3">
                  {lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#f8f8f7] border border-[#2E3344]/5"
                    >
                      <div>
                        <p className="text-xs font-bold text-[#27324A] line-clamp-1">{item.name}</p>
                        <p className="text-[10px] text-red-500 font-bold mt-0.5">Low Stock</p>
                      </div>
                      <span className="text-xs font-black text-[#27324A] bg-white px-2 py-1 rounded-lg border border-[#2E3344]/5 shrink-0">
                        {item.stock} left
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/dashboard/owner/products"
                className="block w-full mt-4 text-xs font-bold text-[#A7653A] hover:underline text-center"
              >
                View All Inventory →
              </Link>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[#27324A]">Recent Transactions</h2>
                  <p className="text-[10px] uppercase tracking-widest text-[#746E73] font-bold">Latest Activity</p>
                </div>
              </div>
              {recentTransactions.length === 0 ? (
                <p className="text-xs text-[#746E73] font-medium text-center py-4">
                  No transactions yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentTransactions.map((txn) => {
                    const typeLabel = TXN_TYPE_LABEL[txn.type] ?? txn.type;
                    const typeColor = TXN_TYPE_COLOR[txn.type] ?? "text-[#27324A]";
                    const isExpense = txn.type === "expense";
                    return (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-[#2E3344]/5 hover:bg-[#f8f8f7] transition"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#27324A]">
                            {txn.payment_method ? txn.payment_method.charAt(0).toUpperCase() + txn.payment_method.slice(1) : typeLabel}
                          </p>
                          <p className="text-[10px] text-[#746E73] font-medium mt-0.5 flex items-center gap-1">
                            {timeAgo(txn.created_at)} ·{" "}
                            <span className={`font-bold ${typeColor}`}>{typeLabel}</span>
                          </p>
                        </div>
                        <span className={`text-sm font-black ${isExpense ? "text-red-500" : "text-[#27324A]"}`}>
                          {isExpense ? "-" : "+"}Rs. {Number(txn.amount).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link
                href="/dashboard/owner/finances"
                className="block w-full mt-4 text-xs font-bold text-[#A7653A] hover:underline text-center"
              >
                Full Finance Report →
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Online Orders Queue */}
          <div className="rounded-[2rem] bg-[#F7F0E6]/40 border border-[#A7653A]/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#8D5132]">
                Online Orders Queue
              </h2>
              <span className="h-6 w-6 rounded-full bg-[#A7653A] text-white text-[10px] font-bold flex items-center justify-center">
                {dashStats.pending_orders}
              </span>
            </div>
            {pendingOrders.length === 0 ? (
              <p className="text-xs text-[#746E73] font-medium text-center py-6">
                No pending orders right now.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-[1.25rem] bg-white border border-[#2E3344]/5 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[#746E73]">
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-500">
                        Pending
                      </span>
                    </div>
                    <p className="font-black text-[#27324A] text-sm">
                      Rs. {Number(order.total_amount).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[#746E73] mt-1">{timeAgo(order.created_at)}</p>
                    <Link
                      href="/dashboard/owner/orders"
                      className="mt-3 block w-full py-2 rounded-xl bg-[#F7F0E6] text-[#A7653A] text-xs font-bold hover:bg-[#A7653A] hover:text-white transition text-center"
                    >
                      Process Order
                    </Link>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/dashboard/owner/orders"
              className="block w-full mt-4 text-xs font-bold text-[#A7653A] hover:underline text-center"
            >
              View All Orders →
            </Link>
          </div>

          {/* Supplier Dues */}
          <div className="rounded-[2rem] bg-[#27324A] p-6 text-white shadow-xl flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="h-5 w-5 text-[#D8C99A]" />
              <p className="text-[10px] font-black uppercase tracking-widest text-[#D8C99A]">Supplier Dues</p>
            </div>
            <p className="text-3xl font-black mt-2">
              Rs. {dashStats.supplier_dues.toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-white/60 font-medium">
              {dashStats.supplier_dues > 0
                ? "Outstanding payments to your suppliers."
                : "No outstanding supplier dues."}
            </p>
            <Link
              href="/dashboard/owner/suppliers"
              className="mt-6 block w-full py-3 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition text-center"
            >
              Manage Suppliers →
            </Link>
          </div>

          {/* Udhar Overview */}
          <div className="rounded-[2rem] bg-white border border-[#2E3344]/8 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center">
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[#27324A]">Customer Udhar</h2>
                <p className="text-[10px] uppercase tracking-widest text-[#746E73] font-bold">Outstanding</p>
              </div>
            </div>
            <p className="text-2xl font-black text-[#27324A]">
              Rs. {dashStats.total_udhar.toLocaleString()}
            </p>
            <p className="text-xs text-[#746E73] font-medium mt-1">Total credit given to customers.</p>
            <Link
              href="/dashboard/owner/customers"
              className="mt-4 block w-full py-3 rounded-xl bg-[#F7F0E6] text-[#A7653A] text-xs font-bold hover:bg-[#A7653A] hover:text-white transition text-center"
            >
              Manage Customers →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
