"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Download,
  TrendingUp,
  ArrowUpDown,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProductProfitability,
  type ProfitabilityRow,
} from "@/app/actions/reports";
import { presetRange } from "@/lib/reports/range";
import { downloadCsv, fileStem } from "@/lib/reports/csv";
import { ReportDateBar } from "./ReportDateBar";

interface Props {
  shopId: string;
  shopName: string;
}

type SortKey = "revenue" | "gross_margin" | "margin_pct" | "units";

function money(n: number) {
  return `Rs. ${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ProfitabilityView({ shopId, shopName }: Props) {
  const initial = useMemo(() => presetRange("30d"), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rows, setRows] = useState<ProfitabilityRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = (f: string, t: string) => {
    startTransition(async () => {
      setError(null);
      const startIso = new Date(`${f}T00:00:00Z`).toISOString();
      const endIso = new Date(
        new Date(`${t}T00:00:00Z`).getTime() + 864e5,
      ).toISOString();
      const res = await getProductProfitability(shopId, startIso, endIso);
      if (res.error) {
        setError(res.error);
        setRows([]);
        return;
      }
      setRows(res.rows ?? []);
    });
  };

  useEffect(() => {
    load(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const sorted = useMemo(() => {
    return [...rows].sort(
      (a, b) => (b[sortKey] as number) - (a[sortKey] as number),
    );
  }, [rows, sortKey]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        cogs: acc.cogs + r.cogs,
        margin: acc.margin + r.gross_margin,
      }),
      { revenue: 0, cogs: 0, margin: 0 },
    );
  }, [rows]);

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    const out: (string | number)[][] = [
      [
        "Product",
        "Units",
        "Revenue",
        "COGS",
        "Gross margin",
        "Margin %",
        "Current price",
      ],
      ...sorted.map((r) => [
        r.name,
        r.units,
        r.revenue.toFixed(2),
        r.cogs.toFixed(2),
        r.gross_margin.toFixed(2),
        r.margin_pct,
        r.current_price.toFixed(2),
      ]),
      [],
      [
        "TOTAL",
        "",
        totals.revenue.toFixed(2),
        totals.cogs.toFixed(2),
        totals.margin.toFixed(2),
        "",
        "",
      ],
    ];
    downloadCsv(
      `${fileStem(shopName)}-profitability-${from}_to_${to}.csv`,
      out,
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <Link
          href="/dashboard/owner/products"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2"
        >
          <ChevronLeft className="h-3 w-3" /> Back to Products
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-[#A7653A]" /> Product
            profitability
          </h1>
          <Link
            href="/dashboard/owner/products/top"
            className="text-xs font-bold text-[#A7653A] hover:underline"
          >
            Top products →
          </Link>
        </div>
        <p className="text-sm font-medium text-[#746E73] mt-1">
          Revenue, cost of goods sold (from batch consumption where available),
          and gross margin per product.
        </p>
      </div>

      <ReportDateBar
        from={from}
        to={to}
        onChange={(f, t) => {
          setFrom(f);
          setTo(t);
        }}
        right={
          <button
            onClick={exportCsv}
            disabled={isPending || rows.length === 0}
            className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Revenue" value={money(totals.revenue)} accent="#27324A" />
        <Kpi label="COGS" value={money(totals.cogs)} accent="#A7653A" />
        <Kpi
          label="Gross margin"
          value={money(totals.margin)}
          accent="#3da55e"
        />
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
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-[#746E73]">
            No sales in this range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73] font-black">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <SortTh
                    label="Units"
                    k="units"
                    sortKey={sortKey}
                    setSortKey={setSortKey}
                  />
                  <SortTh
                    label="Revenue"
                    k="revenue"
                    sortKey={sortKey}
                    setSortKey={setSortKey}
                  />
                  <th className="px-4 py-3 text-right">COGS</th>
                  <SortTh
                    label="Margin"
                    k="gross_margin"
                    sortKey={sortKey}
                    setSortKey={setSortKey}
                  />
                  <SortTh
                    label="Margin %"
                    k="margin_pct"
                    sortKey={sortKey}
                    setSortKey={setSortKey}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E3344]/5">
                {sorted.map((r) => (
                  <tr key={r.product_id} className="hover:bg-[#f8f8f7]/50">
                    <td className="px-4 py-3 font-bold text-[#27324A]">
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-right">{r.units}</td>
                    <td className="px-4 py-3 text-right">{money(r.revenue)}</td>
                    <td className="px-4 py-3 text-right text-[#746E73]">
                      {money(r.cogs)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {money(r.gross_margin)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${r.margin_pct >= 0 ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {r.margin_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-[#746E73]">
        COGS is exact for products sold from batches; for non-batched products
        it&apos;s estimated from the current cost price.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-[#2E3344]/8 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
        {label}
      </p>
      <p className="text-xl font-black mt-1" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function SortTh({
  label,
  k,
  sortKey,
  setSortKey,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th className="px-4 py-3 text-right">
      <button
        onClick={() => setSortKey(k)}
        className={`inline-flex items-center gap-1 ${active ? "text-[#27324A]" : ""}`}
      >
        {label}{" "}
        <ArrowUpDown
          className={`h-3 w-3 ${active ? "opacity-100" : "opacity-30"}`}
        />
      </button>
    </th>
  );
}
