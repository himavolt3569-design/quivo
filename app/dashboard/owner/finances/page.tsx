import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { FinanceDashboard } from "@/components/dashboard/owner/finances/FinanceDashboard";
import Link from "next/link";
import { Banknote, FileSpreadsheet, TrendingUp } from "lucide-react";

export default async function FinancesPage() {
  const ctx = await getOwnerContext();
  const shopId = ctx.activeShop?.id ?? null;

  if (!shopId) {
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

  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStartIso = monthStart.toISOString();
  const prevMonthStartIso = prevMonthStart.toISOString();

  // Pull the current + previous month window for accurate "vs last month"
  // deltas, plus the most-recent 50 for the activity feed.
  const [{ data: windowTxns }, { data: recent }] = await Promise.all([
    supabase
      .from("shop_transactions")
      .select("amount, type, created_at")
      .eq("shop_id", shopId)
      .gte("created_at", prevMonthStartIso)
      .limit(10000),
    supabase
      .from("shop_transactions")
      .select("id, amount, type, description, payment_method, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const win = windowTxns ?? [];
  const allTxns = recent ?? [];

  const sumWhere = (type: string, fromIso: string, toIso?: string) =>
    win
      .filter(
        (t) =>
          t.type === type &&
          t.created_at >= fromIso &&
          (!toIso || t.created_at < toIso),
      )
      .reduce((acc, t) => acc + (t.amount ?? 0), 0);

  const monthlyIncome = sumWhere("sale", monthStartIso);
  const monthlyExpenses = sumWhere("expense", monthStartIso);
  const prevIncome = sumWhere("sale", prevMonthStartIso, monthStartIso);
  const prevExpenses = sumWhere("expense", prevMonthStartIso, monthStartIso);

  return (
    <div className="space-y-6">
      {/* Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-5xl mx-auto px-1">
        <Link
          href="/dashboard/owner/finances/day-end"
          className="bg-white p-4 rounded-2xl border border-[#2E3344]/8 shadow-sm hover:shadow-md transition flex items-center gap-3"
        >
          <span className="h-10 w-10 rounded-xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center">
            <Banknote className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-[#27324A] text-sm">Day end</p>
            <p className="text-[11px] text-[#746E73]">
              Cash drawer reconciliation + Z-report.
            </p>
          </div>
        </Link>
        <Link
          href="/dashboard/owner/finances/vat"
          className="bg-white p-4 rounded-2xl border border-[#2E3344]/8 shadow-sm hover:shadow-md transition flex items-center gap-3"
        >
          <span className="h-10 w-10 rounded-xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-[#27324A] text-sm">VAT-3 export</p>
            <p className="text-[11px] text-[#746E73]">
              Monthly IRD-format VAT report.
            </p>
          </div>
        </Link>
        <Link
          href="/dashboard/owner/products/profitability"
          className="bg-white p-4 rounded-2xl border border-[#2E3344]/8 shadow-sm hover:shadow-md transition flex items-center gap-3"
        >
          <span className="h-10 w-10 rounded-xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-[#27324A] text-sm">Profitability</p>
            <p className="text-[11px] text-[#746E73]">
              Margin per product + top sellers.
            </p>
          </div>
        </Link>
      </div>

      <FinanceDashboard
        shopId={shopId}
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
        prevIncome={prevIncome}
        prevExpenses={prevExpenses}
        recentTransactions={allTxns.slice(0, 10)}
      />
    </div>
  );
}
