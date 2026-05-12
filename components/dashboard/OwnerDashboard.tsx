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
import { quickSignals, incomingOrders } from "@/lib/data";
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

// Mock Data for Charts
const revenueData = [
  { name: 'Mon', revenue: 40000 },
  { name: 'Tue', revenue: 30000 },
  { name: 'Wed', revenue: 20000 },
  { name: 'Thu', revenue: 27800 },
  { name: 'Fri', revenue: 18900 },
  { name: 'Sat', revenue: 23900 },
  { name: 'Sun', revenue: 34900 },
];

const salesByCategory = [
  { name: 'Grocery', sales: 4000 },
  { name: 'Dairy', sales: 3000 },
  { name: 'Beverages', sales: 2000 },
  { name: 'Snacks', sales: 2780 },
  { name: 'Personal Care', sales: 1890 },
];

interface OwnerDashboardProps {
  shop: { id: string; slug: string; name: string; status: string } | null;
  shopCount: number;
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

export function OwnerDashboard({ shop, shopCount }: OwnerDashboardProps) {
  const nameParts = (shop?.name ?? "Your Shop").split(/\s+/);
  const firstWord = nameParts[0];
  const restName = nameParts.slice(1).join(" ");
  const statusKey = shop?.status ?? "active";
  const statusLabel = STATUS_LABEL[statusKey] ?? statusKey;
  const statusDot = STATUS_DOT[statusKey] ?? "bg-zinc-400";

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both pb-10">

      {/* ── Top Header & Greeting ────────────────────────────────────────── */}
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
              <a
                href="/onboarding/owner"
                className="text-[#A7653A] hover:underline"
              >
                + New shop
              </a>
              {shopCount > 1 && (
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#746E73]">
                  {shopCount} shops
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm font-bold text-[#746E73]">
              You haven&apos;t created a shop yet.{" "}
              <a
                href="/onboarding/owner"
                className="text-[#A7653A] hover:underline"
              >
                Set up your first shop →
              </a>
            </p>
          )}
        </div>
        <div className="relative z-10 flex items-center gap-2 bg-[#F7F0E6] py-2 px-4 rounded-xl border border-[#A7653A]/20 self-start sm:self-auto">
          <div className={`h-2 w-2 rounded-full ${statusDot} ${statusKey === "active" ? "animate-pulse" : ""}`} />
          <span className="text-xs font-bold text-[#A7653A] uppercase tracking-widest">{statusLabel}</span>
        </div>
      </div>

      {/* Demo data notice — KPIs/charts/lists below are placeholders until catalog, sales, and orders are wired in upcoming milestones */}
      <div className="rounded-2xl bg-amber-50/70 border border-amber-200/60 px-4 py-3 text-xs font-semibold text-amber-900 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          Showing demo metrics below. Real KPIs, charts, orders, inventory, and customers will appear once those modules are wired up
          (catalog/barcodes → POS/inventory → online orders → customers/suppliers).
        </span>
      </div>

      {/* ── KPI Metrics Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: "Today's Sales", value: "Rs. 42,500", icon: TrendingUp, trend: "+12%", trendUp: true },
          { label: "Pending Udhar", value: "Rs. 12,450", icon: WalletCards, trend: "-2%", trendUp: false },
          { label: "Net Profit (Mo)", value: "Rs. 1.2L", icon: Banknote, trend: "+5%", trendUp: true },
          { label: "Low Stock", value: "18 Items", icon: AlertTriangle, trend: "Requires Action", trendUp: false, alert: true },
          { label: "Pending Orders", value: "3", icon: ShoppingCart, trend: "Online", trendUp: true },
        ].map((kpi, i) => (
          <div key={i} className={`p-5 rounded-[1.5rem] bg-white border border-[#2E3344]/8 shadow-sm flex flex-col justify-between ${kpi.alert ? 'border-orange-200 bg-orange-50/50' : ''}`}>
            <div className="flex justify-between items-start">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${kpi.alert ? 'bg-orange-100 text-orange-600' : 'bg-[#F7F0E6] text-[#A7653A]'}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${kpi.trendUp ? 'bg-green-50 text-green-600' : kpi.alert ? 'bg-orange-100 text-orange-700' : 'bg-red-50 text-red-600'}`}>
                {kpi.trend}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black text-[#27324A]">{kpi.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73] mt-1">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Actions Grid ────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-[#746E73] mb-3 ml-2">Quick Actions</h2>
        <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-2 hide-scrollbar">
          {[
            { label: "Cash Sale", icon: Calculator, color: "bg-[#27324A] text-white hover:bg-[#1b2333]" },
            { label: "Add Product", icon: Plus, color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
            { label: "Add Expense", icon: ReceiptText, color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
            { label: "New Invoice", icon: FileText, color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
            { label: "Barcode", icon: Barcode, color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
            { label: "Shop QR", icon: QrCode, color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
            { label: "Customer", icon: UserPlus, color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
            { label: "Upload Bill", icon: Camera, color: "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]" },
          ].map((action, i) => (
            <button key={i} className={`${action.color} flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all active:scale-95 min-w-[90px] sm:min-w-0 shadow-sm`}>
              <action.icon className="h-5 w-5" />
              <span className="text-[10px] font-bold text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Main Charts Column ────────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-[#27324A]">Revenue Overview</h2>
                <p className="text-xs text-[#746E73] font-medium">Daily sales performance for this week</p>
              </div>
              <select className="text-xs font-bold bg-[#F7F0E6] text-[#27324A] rounded-xl px-3 py-1.5 outline-none">
                <option>This Week</option>
                <option>This Month</option>
              </select>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#746E73' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#746E73' }} />
                  <RechartsTooltip cursor={{ stroke: '#A7653A', strokeWidth: 1, strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#A7653A" strokeWidth={3} dot={{ r: 4, fill: '#A7653A', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm">
               <div className="flex items-center gap-3 mb-6">
                 <div className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                   <PackageMinus className="h-5 w-5" />
                 </div>
                 <div>
                   <h2 className="text-sm font-black text-[#27324A]">Expiring & Low Stock</h2>
                   <p className="text-[10px] uppercase tracking-widest text-[#746E73] font-bold">Needs Attention</p>
                 </div>
               </div>
               <div className="space-y-3">
                 {[
                   { name: "Amul Butter 500g", status: "Expires in 3 days", stock: 12 },
                   { name: "Wai Wai Noodles", status: "Low Stock", stock: 4 },
                   { name: "Aashirvaad Atta 5kg", status: "Low Stock", stock: 2 },
                 ].map((item, i) => (
                   <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#f8f8f7] border border-[#2E3344]/5">
                     <div>
                       <p className="text-xs font-bold text-[#27324A]">{item.name}</p>
                       <p className="text-[10px] text-red-500 font-bold mt-0.5">{item.status}</p>
                     </div>
                     <span className="text-xs font-black text-[#27324A] bg-white px-2 py-1 rounded-lg border border-[#2E3344]/5">{item.stock} left</span>
                   </div>
                 ))}
               </div>
               <button className="w-full mt-4 text-xs font-bold text-[#A7653A] hover:underline">View All Inventory Report</button>
            </div>

            <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm">
               <div className="flex items-center gap-3 mb-6">
                 <div className="h-10 w-10 rounded-xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center">
                   <Clock className="h-5 w-5" />
                 </div>
                 <div>
                   <h2 className="text-sm font-black text-[#27324A]">Recent Transactions</h2>
                   <p className="text-[10px] uppercase tracking-widest text-[#746E73] font-bold">Latest Sales</p>
                 </div>
               </div>
               <div className="space-y-3">
                 {[
                   { id: "INV-091", time: "10 mins ago", amount: "Rs. 1,250", type: "Cash" },
                   { id: "INV-090", time: "25 mins ago", amount: "Rs. 450", type: "eSewa" },
                   { id: "INV-089", time: "1 hour ago", amount: "Rs. 3,400", type: "Udhar" },
                 ].map((txn, i) => (
                   <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-[#2E3344]/5 hover:bg-[#f8f8f7] transition">
                     <div>
                       <p className="text-xs font-bold text-[#27324A]">{txn.id}</p>
                       <p className="text-[10px] text-[#746E73] font-medium mt-0.5 flex items-center gap-1">{txn.time} • <span className={`font-bold ${txn.type === 'Udhar' ? 'text-orange-500' : 'text-green-600'}`}>{txn.type}</span></p>
                     </div>
                     <span className="text-sm font-black text-[#27324A]">{txn.amount}</span>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar Column ────────────────────────────────────────── */}
        <aside className="lg:col-span-4 space-y-6">
          
          {/* Active Orders */}
          <div className="rounded-[2rem] bg-[#F7F0E6]/40 border border-[#A7653A]/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#8D5132]">
                Online Orders Queue
              </h2>
              <span className="h-6 w-6 rounded-full bg-[#A7653A] text-white text-[10px] font-bold flex items-center justify-center">3</span>
            </div>
            <div className="space-y-3">
              {incomingOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="group rounded-[1.25rem] bg-white border border-[#2E3344]/5 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[#746E73]">{order.id}</span>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${order.priority === "Urgent" ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"}`}>
                       {order.priority}
                    </span>
                  </div>
                  <h4 className="font-black text-[#27324A] text-sm">{order.customer}</h4>
                  <p className="text-xs font-medium text-[#746E73] mt-1 line-clamp-1">{order.items}</p>
                  <button className="mt-3 w-full py-2 rounded-xl bg-[#F7F0E6] text-[#A7653A] text-xs font-bold hover:bg-[#A7653A] hover:text-white transition">
                    Process Order
                  </button>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 text-xs font-bold text-[#A7653A] hover:underline text-center">View All Orders</button>
          </div>

          {/* Sales by Category Chart */}
          <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm">
             <h2 className="text-sm font-black text-[#27324A] mb-4">Sales by Category</h2>
             <div className="h-[180px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={salesByCategory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} layout="vertical">
                   <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#27324A', fontWeight: 'bold' }} width={80} />
                   <RechartsTooltip cursor={{ fill: '#F7F0E6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                   <Bar dataKey="sales" fill="#27324A" radius={[0, 4, 4, 0]} barSize={20} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* Supplier Dues Summary */}
          <div className="rounded-[2rem] bg-[#27324A] p-6 text-white shadow-xl flex flex-col justify-between">
             <div className="flex items-center gap-3 mb-2">
               <Truck className="h-5 w-5 text-[#D8C99A]" />
               <p className="text-[10px] font-black uppercase tracking-widest text-[#D8C99A]">Supplier Dues</p>
             </div>
             <p className="text-3xl font-black mt-2">Rs. 45,000</p>
             <p className="mt-2 text-xs text-white/60 font-medium">To be paid to 3 distributors this week.</p>
             <button className="mt-6 w-full py-3 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition">
                View Ledger
             </button>
          </div>

        </aside>
      </div>
    </div>
  );
}
