import { getOwnerShops, getOwnerPaymentsOverview, getOwnerPaymentsList } from "@/app/actions/payment-config";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/payments/constants";
import type { PaymentMethod, PaymentStatus } from "@/lib/payments";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

const SUCCESS_STATUSES: Set<string> = new Set(["payment_verified", "cod_paid"]);

interface SP {
  shop?: string;
  method?: string;
  status?: string;
  days?: string;
}

export default async function PaymentsReportsPage({
  searchParams,
}: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const days = Math.max(1, Math.min(365, parseInt(sp.days ?? "30", 10) || 30));
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const to = new Date();

  const [shopsRes, overviewRes, listRes] = await Promise.all([
    getOwnerShops(),
    getOwnerPaymentsOverview(from, to),
    getOwnerPaymentsList({
      shopId: sp.shop || null,
      method: (sp.method as PaymentMethod) || null,
      status: sp.status || null,
      from, to,
      limit: 100,
    }),
  ]);

  const shops = shopsRes.shops ?? [];
  const overview = overviewRes.rows ?? [];
  const list = listRes.rows ?? [];

  // Cross-shop totals
  const totalReceived = overview
    .filter((r) => SUCCESS_STATUSES.has(r.payment_status))
    .reduce((s, r) => s + Number(r.total_amount), 0);
  const totalPending = overview
    .filter((r) => !SUCCESS_STATUSES.has(r.payment_status)
                && r.payment_status !== "payment_rejected"
                && r.payment_status !== "payment_failed")
    .reduce((s, r) => s + Number(r.total_amount), 0);

  // Per-shop summary
  const byShop = new Map<string, { name: string; slug: string; received: number; pending: number; count: number }>();
  for (const r of overview) {
    const entry = byShop.get(r.shop_id) ?? { name: r.shop_name, slug: r.shop_slug, received: 0, pending: 0, count: 0 };
    entry.count += Number(r.payment_count);
    if (SUCCESS_STATUSES.has(r.payment_status)) entry.received += Number(r.total_amount);
    else if (r.payment_status !== "payment_rejected" && r.payment_status !== "payment_failed") {
      entry.pending += Number(r.total_amount);
    }
    byShop.set(r.shop_id, entry);
  }

  // Per-method breakdown
  const byMethod = new Map<string, { count: number; received: number }>();
  for (const r of overview) {
    const e = byMethod.get(r.payment_method) ?? { count: 0, received: 0 };
    e.count += Number(r.payment_count);
    if (SUCCESS_STATUSES.has(r.payment_status)) e.received += Number(r.total_amount);
    byMethod.set(r.payment_method, e);
  }

  return (
    <div className="space-y-5 pb-12">
      <Link href="/dashboard/owner/payments"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#27324A] hover:text-[#A7653A]">
        <ArrowLeft className="h-4 w-4" /> Back to Payments
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-[#27324A] flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#27324A]">Cross-Shop Payments Report</h1>
          <p className="text-xs text-[#746E73]">All {shops.length} shop{shops.length !== 1 ? "s" : ""} you own, last {days} days.</p>
        </div>
      </div>

      {/* Filters */}
      <form className="bg-white rounded-3xl border border-[#2E3344]/8 shadow-sm p-4 grid grid-cols-2 md:grid-cols-4 gap-2.5 text-sm">
        <select name="shop" defaultValue={sp.shop ?? ""} className="h-10 px-2 rounded-xl border border-[#2E3344]/10 bg-white">
          <option value="">All shops</option>
          {shops.map((s) => <option key={s.shop_id} value={s.shop_id}>{s.shop_name}</option>)}
        </select>
        <select name="method" defaultValue={sp.method ?? ""} className="h-10 px-2 rounded-xl border border-[#2E3344]/10 bg-white">
          <option value="">All methods</option>
          {(["cod","esewa","khalti","bank_transfer","qr_code"] as PaymentMethod[]).map((m) =>
            <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="h-10 px-2 rounded-xl border border-[#2E3344]/10 bg-white">
          <option value="">All statuses</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) =>
            <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="days" defaultValue={String(days)} className="h-10 px-2 rounded-xl border border-[#2E3344]/10 bg-white flex-1">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <button type="submit" className="h-10 px-4 rounded-xl bg-[#27324A] text-white text-xs font-bold">Apply</button>
        </div>
      </form>

      {/* Top-line stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label={`Total received (${days}d)`} amount={totalReceived} accent="text-green-700" bg="bg-green-50 border-green-200" />
        <StatCard label="Pending action" amount={totalPending} accent="text-amber-700" bg="bg-amber-50 border-amber-200" />
        <StatCard label="Shops reporting" raw={`${byShop.size}/${shops.length}`} accent="text-[#27324A]" bg="bg-white border-[#2E3344]/8" />
      </div>

      {/* Per-shop */}
      {byShop.size > 0 && (
        <div className="bg-white rounded-3xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2E3344]/8">
            <h2 className="font-black text-[#27324A]">By Shop</h2>
          </div>
          <ul className="divide-y divide-[#2E3344]/8">
            {Array.from(byShop.entries()).map(([id, s]) => (
              <li key={id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#27324A] text-sm truncate">{s.name}</p>
                  <p className="text-[10px] text-[#746E73]">{s.count} payments · /s/{s.slug}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-green-700">Rs. {s.received.toLocaleString()}</p>
                  {s.pending > 0 && <p className="text-[10px] text-amber-700">Rs. {s.pending.toLocaleString()} pending</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-method */}
      {byMethod.size > 0 && (
        <div className="bg-white rounded-3xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2E3344]/8">
            <h2 className="font-black text-[#27324A]">By Method</h2>
          </div>
          <ul className="divide-y divide-[#2E3344]/8">
            {Array.from(byMethod.entries()).map(([m, e]) => (
              <li key={m} className="px-5 py-3 flex items-center justify-between gap-3">
                <p className="font-bold text-[#27324A] text-sm">{PAYMENT_METHOD_LABELS[m as PaymentMethod]}</p>
                <div className="text-right">
                  <p className="text-sm font-black text-green-700">Rs. {e.received.toLocaleString()}</p>
                  <p className="text-[10px] text-[#746E73]">{e.count} payments</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent list */}
      <div className="bg-white rounded-3xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2E3344]/8">
          <h2 className="font-black text-[#27324A]">Recent Payments {list.length === 100 && <span className="text-[10px] font-bold text-[#746E73]">(first 100)</span>}</h2>
        </div>
        {list.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#746E73]">No payments matched these filters.</p>
        ) : (
          <ul className="divide-y divide-[#2E3344]/8">
            {list.map((r) => (
              <li key={r.payment_id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono font-black text-sm text-[#27324A] truncate">{r.order_number}</p>
                  <p className="text-[10px] text-[#746E73] truncate">
                    {r.shop_name} · {PAYMENT_METHOD_LABELS[r.payment_method]} · {r.customer_name ?? "Anonymous"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-[#27324A]">Rs. {Number(r.amount).toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-[#746E73]">
                    {PAYMENT_STATUS_LABELS[r.payment_status as PaymentStatus] ?? r.payment_status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label, amount, raw, accent, bg,
}: { label: string; amount?: number; raw?: string; accent: string; bg: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">{label}</p>
      <p className={`text-xl font-black mt-1 ${accent}`}>
        {raw ?? `Rs. ${(amount ?? 0).toLocaleString()}`}
      </p>
    </div>
  );
}
