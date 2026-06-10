import { getOwnerContext } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Settings as SettingsIcon, BarChart3, CreditCard } from "lucide-react";
import { PendingPaymentsList } from "@/components/dashboard/owner/payments/PendingPaymentsList";
import { PaymentMethodBadges } from "@/components/dashboard/owner/payments/PaymentMethodBadges";
import type { PaymentMethod, PaymentStatus } from "@/lib/payments";

interface PaymentRow {
  id: string;
  order_id: string;
  shop_id: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount: number;
  receipt_url: string | null;
  rejected_reason: string | null;
  created_at: string;
  orders: {
    order_number: string;
    customer_name: string | null;
    customer_phone: string | null;
  } | null;
}

export default async function PaymentsPage() {
  const ctx = await getOwnerContext();
  const shop = ctx.activeShop ?? null;

  if (!shop) {
    return (
      <div className="p-6">
        <p className="text-sm text-[#746E73]">No shop selected.</p>
      </div>
    );
  }

  const supabase = await createClient();

  // Pending verification queue for the active shop.
  const { data: pending } = await supabase
    .from("payments")
    .select(
      "id, order_id, shop_id, payment_method, payment_status, amount, receipt_url, rejected_reason, created_at, orders(order_number, customer_name, customer_phone)",
    )
    .eq("shop_id", shop.id)
    .in("payment_status", [
      "paid_pending_owner_confirmation",
      "bank_transfer_pending_verification",
      "qr_payment_pending_verification",
      "cod_pending",
    ])
    .order("created_at", { ascending: false })
    .limit(50);

  // Aggregate stats for the active shop (current month).
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: monthRows } = await supabase
    .from("payments")
    .select("payment_status, amount")
    .eq("shop_id", shop.id)
    .gte("created_at", monthStart.toISOString());

  const stats = (monthRows ?? []).reduce(
    (acc, r) => {
      const amt = Number(r.amount) || 0;
      if (
        r.payment_status === "payment_verified" ||
        r.payment_status === "cod_paid"
      )
        acc.received += amt;
      else if (
        r.payment_status === "payment_rejected" ||
        r.payment_status === "payment_failed"
      )
        acc.failed += amt;
      else acc.pending += amt;
      return acc;
    },
    { received: 0, pending: 0, failed: 0 },
  );

  const rows = (pending ?? []) as unknown as PaymentRow[];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-[#27324A] flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#27324A]">Payments</h1>
            <p className="text-xs text-[#746E73]">
              Verify customer payments, manage methods, view reports.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/owner/payments/reports"
            className="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-xl bg-white border border-[#2E3344]/10 text-xs font-bold text-[#27324A] hover:bg-[#f8f8f7]"
          >
            <BarChart3 className="h-4 w-4" /> Reports
          </Link>
          <Link
            href="/dashboard/owner/payments/settings"
            className="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-xl bg-[#27324A] text-white text-xs font-bold hover:bg-[#1b2333]"
          >
            <SettingsIcon className="h-4 w-4" /> Configure Methods
          </Link>
        </div>
      </div>

      {/* Enabled methods */}
      <PaymentMethodBadges shopId={shop.id} />

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Received this month"
          amount={stats.received}
          accent="text-green-700"
          bg="bg-green-50 border-green-200"
        />
        <StatCard
          label="Pending action"
          amount={stats.pending}
          accent="text-amber-700"
          bg="bg-amber-50 border-amber-200"
        />
        <StatCard
          label="Failed / rejected"
          amount={stats.failed}
          accent="text-red-700"
          bg="bg-red-50 border-red-200"
        />
      </div>

      {/* Pending payments */}
      <div className="bg-white rounded-3xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2E3344]/8">
          <h2 className="font-black text-[#27324A]">Awaiting Your Action</h2>
          <p className="text-xs text-[#746E73] mt-0.5">
            Verify or reject customer payments below. Bank / QR receipts open in
            a new tab.
          </p>
        </div>
        <PendingPaymentsList payments={rows} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  amount,
  accent,
  bg,
}: {
  label: string;
  amount: number;
  accent: string;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
        {label}
      </p>
      <p className={`text-xl font-black mt-1 ${accent}`}>
        Rs. {amount.toLocaleString()}
      </p>
    </div>
  );
}
