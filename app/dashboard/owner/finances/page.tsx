import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { FinanceDashboard } from "@/components/dashboard/owner/finances/FinanceDashboard";
import Link from "next/link";

export default async function FinancesPage() {
  const ctx = await getOwnerContext();
  const shopId = ctx.activeShop?.id ?? null;

  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-lg font-bold text-[#27324A]">No shop selected.</p>
        <Link href="/onboarding/owner" className="text-sm text-[#A7653A] hover:underline font-bold">
          Create your first shop →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();

  // Start of current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: transactions } = await supabase
    .from("shop_transactions")
    .select("id, amount, type, description, payment_method, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(50);

  const allTxns = transactions ?? [];

  // Monthly totals
  const monthlyIncome = allTxns
    .filter((t) => t.type === "sale" && t.created_at >= monthStart)
    .reduce((acc, t) => acc + (t.amount ?? 0), 0);

  const monthlyExpenses = allTxns
    .filter((t) => t.type === "expense" && t.created_at >= monthStart)
    .reduce((acc, t) => acc + (t.amount ?? 0), 0);

  return (
    <FinanceDashboard
      shopId={shopId}
      monthlyIncome={monthlyIncome}
      monthlyExpenses={monthlyExpenses}
      recentTransactions={allTxns.slice(0, 10)}
    />
  );
}
