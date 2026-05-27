"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Users, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { getSalesByStaff, type SalesByStaffRow } from "@/app/actions/reports";
import { presetRange } from "@/lib/reports/range";
import { downloadCsv, fileStem } from "@/lib/reports/csv";
import { ReportDateBar } from "./ReportDateBar";

interface Props { shopId: string; shopName: string; }

function money(n: number) { return `Rs. ${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export function SalesByStaffView({ shopId, shopName }: Props) {
  const initial = useMemo(() => presetRange("30d"), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rows, setRows] = useState<SalesByStaffRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = (f: string, t: string) => {
    startTransition(async () => {
      setError(null);
      const startIso = new Date(`${f}T00:00:00Z`).toISOString();
      const endIso = new Date(new Date(`${t}T00:00:00Z`).getTime() + 864e5).toISOString();
      const res = await getSalesByStaff(shopId, startIso, endIso);
      if (res.error) { setError(res.error); setRows([]); return; }
      setRows(res.rows ?? []);
    });
  };

  useEffect(() => {
    load(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const exportCsv = () => {
    if (rows.length === 0) { toast.error("Nothing to export."); return; }
    downloadCsv(`${fileStem(shopName)}-sales-by-staff-${from}_to_${to}.csv`, [
      ["Staff", "Linked account", "Sales", "Gross", "Hours", "Sales / hour"],
      ...rows.map((r) => [r.staff_name, r.user_id ? "yes" : "no", r.sales_count, r.gross_sales.toFixed(2), r.hours_worked, r.sales_per_hour.toFixed(2)]),
    ]);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <Link href="/dashboard/owner/staff" className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2">
          <ChevronLeft className="h-3 w-3" /> Back to Staff
        </Link>
        <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
          <Users className="h-6 w-6 text-[#A7653A]" /> Sales by staff
        </h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">
          POS sales attributed to each staff member (via their linked account), against completed shift hours.
        </p>
      </div>

      <ReportDateBar
        from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }}
        right={
          <button onClick={exportCsv} disabled={isPending || rows.length === 0}
            className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40">
            <Download className="h-4 w-4" /> CSV
          </button>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm font-bold text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
        {isPending ? (
          <div className="py-12 text-center text-sm font-bold text-[#746E73]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-[#746E73]">No active staff for this shop.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73] font-black">
                <tr>
                  <th className="px-4 py-3 text-left">Staff</th>
                  <th className="px-4 py-3 text-right">Sales</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                  <th className="px-4 py-3 text-right">Rs. / hour</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E3344]/5">
                {rows.map((r) => (
                  <tr key={r.staff_id} className="hover:bg-[#f8f8f7]/50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#27324A]">{r.staff_name}</p>
                      {!r.user_id && <p className="text-[10px] text-[#A7653A]">no linked account — sales can&apos;t be attributed</p>}
                    </td>
                    <td className="px-4 py-3 text-right">{r.sales_count}</td>
                    <td className="px-4 py-3 text-right font-bold">{money(r.gross_sales)}</td>
                    <td className="px-4 py-3 text-right text-[#746E73] inline-flex items-center gap-1 justify-end w-full">
                      <Clock className="h-3 w-3" /> {r.hours_worked}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#27324A]">{r.sales_per_hour > 0 ? money(r.sales_per_hour) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-[#746E73]">
        Hours come from completed shifts (clock-out − clock-in, falling back to the scheduled window). Staff without a linked
        login show 0 sales — link them under Staff &amp; Roles to attribute their tills.
      </p>
    </div>
  );
}
