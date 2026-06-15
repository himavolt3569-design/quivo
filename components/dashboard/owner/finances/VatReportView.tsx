"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Download,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getVatReport, type VatReportSummary } from "@/app/actions/vat";

interface Props {
  shopId: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  return /[,"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function VatReportView({ shopId }: Props) {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [report, setReport] = useState<VatReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = (y: number, m: number) => {
    startTransition(async () => {
      setError(null);
      const res = await getVatReport(shopId, y, m);
      if (res.error) {
        setError(res.error);
        setReport(null);
        return;
      }
      setReport(res.report ?? null);
    });
  };

  useEffect(() => {
    load(year, month);
    // load is stable; explicit dep on year+month covers the user's intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const yearOptions = useMemo(() => {
    const current = now.getUTCFullYear();
    return Array.from({ length: 5 }, (_, i) => current - i);
  }, [now]);

  const exportCsv = () => {
    if (!report) return;
    if (report.rows.length === 0) {
      toast.error("Nothing to export for this period.");
      return;
    }
    const headerLines: string[][] = [
      [`Quivo VAT-3 Sales Register`],
      [`Shop`, report.shop.name],
      [`PAN`, report.shop.pan_number ?? ""],
      [`Period`, `${MONTHS[report.period.month - 1]} ${report.period.year}`],
      [`VAT rate`, `${report.shop.vat_rate.toFixed(2)}%`],
      [`Generated at`, new Date().toISOString()],
      [],
      [
        "Invoice No",
        "Date",
        "Customer PAN",
        "Source",
        "Taxable Amount (NPR)",
        "Tax (NPR)",
        "Total (NPR)",
      ],
    ];

    const body: string[][] = report.rows.map((r) => [
      r.invoice_no,
      new Date(r.date_iso).toISOString(),
      r.customer_pan ?? "",
      r.source.toUpperCase(),
      r.taxable_amount.toFixed(2),
      r.tax_amount.toFixed(2),
      r.total.toFixed(2),
    ]);

    const footer: string[][] = [
      [],
      [
        "TOTAL",
        "",
        "",
        "",
        report.totals.taxable.toFixed(2),
        report.totals.tax.toFixed(2),
        report.totals.total.toFixed(2),
      ],
    ];

    const safe = report.shop.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    downloadCsv(
      `${safe}-vat3-${report.period.year}-${String(report.period.month).padStart(2, "0")}.csv`,
      [...headerLines, ...body, ...footer],
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/dashboard/owner/finances"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2"
          >
            <ChevronLeft className="h-3 w-3" /> Back to Finances
          </Link>
          <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-[#A7653A]" />
            VAT-3 Sales Register
          </h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">
            Monthly itemised report in Nepal IRD VAT-3 format. CSV opens in
            LibreOffice / Excel.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={isPending || !report || report.rows.length === 0}
          className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm flex items-center gap-2 shadow-sm disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Period picker */}
      <div className="bg-white p-4 rounded-2xl border border-[#2E3344]/8 shadow-sm flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-[#746E73] mb-1 block">
            Year
          </label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-11 px-3 rounded-xl border border-[#2E3344]/15 bg-white text-sm font-bold focus:outline-none focus:border-[#27324A]"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-[#746E73] mb-1 block">
            Month
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="h-11 px-3 rounded-xl border border-[#2E3344]/15 bg-white text-sm font-bold focus:outline-none focus:border-[#27324A]"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {report && !report.shop.vat_registered && (
          <div className="flex items-center gap-2 text-xs text-[#A7653A] font-bold ml-auto bg-[#F7F0E6] px-3 py-2 rounded-xl">
            <AlertCircle className="h-3.5 w-3.5" />
            This shop is not marked VAT-registered. Tax amounts will be zero.
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm font-bold text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Summary cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard
            label="Taxable amount"
            value={`Rs. ${report.totals.taxable.toLocaleString()}`}
            accent="#27324A"
          />
          <KpiCard
            label={`VAT collected (${report.shop.vat_rate.toFixed(2)}%)`}
            value={`Rs. ${report.totals.tax.toLocaleString()}`}
            accent="#A7653A"
          />
          <KpiCard
            label="Gross total"
            value={`Rs. ${report.totals.total.toLocaleString()}`}
            accent="#27324A"
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
        {!report ? (
          <div className="py-12 text-center text-sm font-bold text-[#746E73]">
            {isPending ? "Loading…" : "Pick a period to load the report."}
          </div>
        ) : report.rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-[#746E73]">
            No sales recorded for {MONTHS[report.period.month - 1]}{" "}
            {report.period.year}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73] font-black">
                <tr>
                  <Th>Invoice No</Th>
                  <Th>Date</Th>
                  <Th>Source</Th>
                  <Th align="right">Taxable</Th>
                  <Th align="right">VAT</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E3344]/5">
                {report.rows.map((r) => (
                  <tr
                    key={`${r.source}-${r.invoice_no}-${r.date_iso}`}
                    className="hover:bg-[#f8f8f7]/50"
                  >
                    <Td>
                      <span className="font-mono text-xs">{r.invoice_no}</span>
                    </Td>
                    <Td>
                      <span className="text-xs text-[#746E73]">
                        {new Date(r.date_iso).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          r.source === "pos"
                            ? "bg-[#27324A]/10 text-[#27324A]"
                            : "bg-[#A7653A]/10 text-[#A7653A]"
                        }`}
                      >
                        {r.source}
                      </span>
                    </Td>
                    <Td align="right">Rs. {r.taxable_amount.toFixed(2)}</Td>
                    <Td align="right">Rs. {r.tax_amount.toFixed(2)}</Td>
                    <Td align="right" bold>
                      Rs. {r.total.toFixed(2)}
                    </Td>
                  </tr>
                ))}
                <tr className="bg-[#27324A] text-white font-black text-sm">
                  <Td colSpan={3}>Total</Td>
                  <Td align="right">Rs. {report.totals.taxable.toFixed(2)}</Td>
                  <Td align="right">Rs. {report.totals.tax.toFixed(2)}</Td>
                  <Td align="right">Rs. {report.totals.total.toFixed(2)}</Td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-4 py-3 whitespace-nowrap text-${align ?? "left"}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  bold,
  colSpan,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  bold?: boolean;
  colSpan?: number;
}) {
  return (
    <td
      className={`px-4 py-3 align-top text-${align ?? "left"} ${bold ? "font-bold" : ""}`}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}

function KpiCard({
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
