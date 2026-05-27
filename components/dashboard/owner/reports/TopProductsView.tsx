"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { ChevronLeft, Download, Trophy, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getTopProducts, type TopProductRow } from "@/app/actions/reports";
import { presetRange } from "@/lib/reports/range";
import { downloadCsv, fileStem } from "@/lib/reports/csv";
import { ReportDateBar } from "./ReportDateBar";

interface Props { shopId: string; shopName: string; }

function money(n: number) { return `Rs. ${(Number(n) || 0).toLocaleString()}`; }

export function TopProductsView({ shopId, shopName }: Props) {
  const initial = useMemo(() => presetRange("30d"), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [by, setBy] = useState<"revenue" | "units">("revenue");
  const [rows, setRows] = useState<TopProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = (f: string, t: string, b: "revenue" | "units") => {
    startTransition(async () => {
      setError(null);
      const startIso = new Date(`${f}T00:00:00Z`).toISOString();
      const endIso = new Date(new Date(`${t}T00:00:00Z`).getTime() + 864e5).toISOString();
      const res = await getTopProducts(shopId, startIso, endIso, b, 20);
      if (res.error) { setError(res.error); setRows([]); return; }
      setRows(res.rows ?? []);
    });
  };

  useEffect(() => {
    load(from, to, by);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, by]);

  // Pareto: sorted desc + cumulative % of total.
  const chartData = useMemo(() => {
    const val = (r: TopProductRow) => (by === "units" ? r.units : r.revenue);
    const total = rows.reduce((a, r) => a + val(r), 0) || 1;
    const top = rows.slice(0, 12);
    return top.map((r, i) => {
      const cum = top.slice(0, i + 1).reduce((a, x) => a + val(x), 0);
      return {
        name: r.name.length > 14 ? r.name.slice(0, 13) + "…" : r.name,
        value: Math.round(val(r) * 100) / 100,
        cumulative: Math.round((cum / total) * 1000) / 10,
      };
    });
  }, [rows, by]);

  const exportCsv = () => {
    if (rows.length === 0) { toast.error("Nothing to export."); return; }
    downloadCsv(`${fileStem(shopName)}-top-products-${from}_to_${to}.csv`, [
      ["Rank", "Product", "Units", "Revenue"],
      ...rows.map((r, i) => [i + 1, r.name, r.units, r.revenue.toFixed(2)]),
    ]);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <Link href="/dashboard/owner/products" className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2">
          <ChevronLeft className="h-3 w-3" /> Back to Products
        </Link>
        <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
          <Trophy className="h-6 w-6 text-[#A7653A]" /> Top products
        </h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">Best sellers by revenue or units, with a Pareto cumulative line.</p>
      </div>

      <ReportDateBar
        from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }}
        right={
          <>
            <div className="flex rounded-xl border border-[#2E3344]/15 overflow-hidden h-11">
              {(["revenue", "units"] as const).map((b) => (
                <button key={b} onClick={() => setBy(b)}
                  className={`px-3 text-xs font-bold capitalize ${by === b ? "bg-[#27324A] text-white" : "bg-white text-[#27324A]"}`}>
                  {b}
                </button>
              ))}
            </div>
            <button onClick={exportCsv} disabled={isPending || rows.length === 0}
              className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40">
              <Download className="h-4 w-4" /> CSV
            </button>
          </>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm font-bold text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm p-4">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E334411" />
                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: "#746E73" }} height={60} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#746E73" }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "#746E73" }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="value" fill="#A7653A" radius={[4, 4, 0, 0]} name={by === "units" ? "Units" : "Revenue"} />
                <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#27324A" strokeWidth={2} dot={false} name="Cumulative %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
        {isPending ? (
          <div className="py-12 text-center text-sm font-bold text-[#746E73]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-[#746E73]">No sales in this range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73] font-black">
                <tr><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">Product</th><th className="px-4 py-3 text-right">Units</th><th className="px-4 py-3 text-right">Revenue</th></tr>
              </thead>
              <tbody className="divide-y divide-[#2E3344]/5">
                {rows.map((r, i) => (
                  <tr key={r.product_id} className="hover:bg-[#f8f8f7]/50">
                    <td className="px-4 py-3 text-[#746E73]">{i + 1}</td>
                    <td className="px-4 py-3 font-bold text-[#27324A]">{r.name}</td>
                    <td className="px-4 py-3 text-right">{r.units}</td>
                    <td className="px-4 py-3 text-right font-bold">{money(r.revenue)}</td>
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
