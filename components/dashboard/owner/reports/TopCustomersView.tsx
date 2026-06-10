"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getTopCustomers, type TopCustomerRow } from "@/app/actions/reports";
import { downloadCsv, fileStem } from "@/lib/reports/csv";

interface Props {
  shopId: string;
  shopName: string;
}

function money(n: number) {
  return `Rs. ${(Number(n) || 0).toLocaleString()}`;
}

export function TopCustomersView({ shopId, shopName }: Props) {
  const [by, setBy] = useState<"spent" | "orders">("spent");
  const [rows, setRows] = useState<TopCustomerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      const res = await getTopCustomers(shopId, by, 50);
      if (res.error) {
        setError(res.error);
        setRows([]);
        return;
      }
      setRows(res.rows ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [by]);

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    downloadCsv(`${fileStem(shopName)}-top-customers.csv`, [
      ["Rank", "Name", "Phone", "Total spent", "Orders", "Udhar balance"],
      ...rows.map((r, i) => [
        i + 1,
        r.name,
        r.phone ?? "",
        r.total_spent.toFixed(2),
        r.order_count,
        r.udhar_balance.toFixed(2),
      ]),
    ]);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/dashboard/owner/customers"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2"
          >
            <ChevronLeft className="h-3 w-3" /> Back to Customers
          </Link>
          <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
            <Users className="h-6 w-6 text-[#A7653A]" /> Top customers
          </h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">
            Your most valuable customers by lifetime spend or order count.
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex rounded-xl border border-[#2E3344]/15 overflow-hidden h-11">
            {(
              [
                ["spent", "By spend"],
                ["orders", "By orders"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setBy(id)}
                className={`px-3 text-xs font-bold ${by === id ? "bg-[#27324A] text-white" : "bg-white text-[#27324A]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={exportCsv}
            disabled={isPending || rows.length === 0}
            className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm font-bold text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
        {isPending ? (
          <div className="py-12 text-center text-sm font-bold text-[#746E73]">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-[#746E73]">
            No customers recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73] font-black">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-right">Total spent</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Udhar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E3344]/5">
                {rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-[#f8f8f7]/50">
                    <td className="px-4 py-3 text-[#746E73]">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#27324A]">{r.name}</p>
                      {r.phone && (
                        <p className="text-[11px] text-[#746E73]">{r.phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {money(r.total_spent)}
                    </td>
                    <td className="px-4 py-3 text-right">{r.order_count}</td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${r.udhar_balance > 0 ? "text-[#A7653A]" : "text-[#746E73]"}`}
                    >
                      {money(r.udhar_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
