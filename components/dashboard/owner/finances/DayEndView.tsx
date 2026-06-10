"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  PlayCircle,
  StopCircle,
  Printer,
  AlertCircle,
  Banknote,
  Loader2,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  openDay,
  closeDay,
  listClosedDays,
  getZReport,
  type DayEndRow,
  type ZReport,
} from "@/app/actions/day-end";

interface Props {
  shopId: string;
  shopName: string;
  initialCurrent: DayEndRow | null;
  initialHistory: DayEndRow[];
}

function money(n: number | null | undefined) {
  return `Rs. ${(Number(n) || 0).toFixed(2)}`;
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

function printZReport(report: ZReport) {
  const t = report.totals;
  const opened = fmt(report.day.opened_at);
  const closed = fmt(report.day.closed_at);
  const pan = report.shop.pan_number
    ? `<div class="pan">PAN: ${escapeHtml(report.shop.pan_number)}</div>`
    : "";
  const staff = report.by_staff
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.staff_name)}</td><td style="text-align:right">${s.sales_count}</td><td style="text-align:right">${money(s.gross)}</td></tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Z-Report — ${escapeHtml(report.shop.name)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;width:78mm;margin:auto;padding:10px;color:#000}
h1{font-size:16px;text-align:center;margin-bottom:2px}
.meta{font-size:10px;text-align:center;color:#555;margin:6px 0 8px}
.pan{font-size:10px;text-align:center;color:#555}
.divider{border-top:1px dashed #999;margin:6px 0}
.row{display:flex;justify-content:space-between;font-size:11px;padding:1px 0}
.row strong{font-weight:bold}
.section{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;margin-top:6px}
table{width:100%;border-collapse:collapse;font-size:10px}
td{padding:2px 0}
.total{font-size:13px;font-weight:bold;border-top:1px solid #000;padding-top:4px;margin-top:4px}
@media print{ @page{margin:0;size:78mm auto} }
</style></head>
<body>
<h1>${escapeHtml(report.shop.name)}</h1>
${pan}
<div class="meta">Z-REPORT (Day End)<br/>Opened: ${opened}<br/>Closed: ${closed}</div>
<div class="divider"></div>
<div class="section">Sales</div>
<div class="row"><span>Receipts</span><strong>${report.receipts}</strong></div>
<div class="row"><span>Gross sales</span><strong>${money(t.gross_sales)}</strong></div>
<div class="row"><span>Tax collected</span><strong>${money(t.tax_collected)}</strong></div>
<div class="row"><span>Discounts</span><strong>− ${money(t.discounts)}</strong></div>
<div class="row"><span>Refunds</span><strong>− ${money(t.refund_amount)}</strong></div>
<div class="row total"><span>Net sales</span><strong>${money(t.net_sales - t.refund_amount)}</strong></div>
<div class="divider"></div>
<div class="section">Payments</div>
<div class="row"><span>Cash</span><strong>${money(t.cash)}</strong></div>
<div class="row"><span>Card</span><strong>${money(t.card)}</strong></div>
<div class="row"><span>QR</span><strong>${money(t.qr)}</strong></div>
<div class="row"><span>Online</span><strong>${money(t.online)}</strong></div>
<div class="row"><span>Wallet</span><strong>${money(t.wallet)}</strong></div>
<div class="row"><span>Udhar</span><strong>${money(t.udhar)}</strong></div>
<div class="divider"></div>
<div class="section">Cash drawer</div>
<div class="row"><span>Opening cash</span><strong>${money(report.day.opening_cash)}</strong></div>
<div class="row"><span>Expected</span><strong>${money(report.day.expected_cash)}</strong></div>
<div class="row"><span>Counted</span><strong>${money(report.day.counted_cash)}</strong></div>
<div class="row total"><span>Variance</span><strong>${money(report.day.variance)}</strong></div>
<div class="divider"></div>
<div class="section">By staff</div>
<table><tr><td><strong>Staff</strong></td><td style="text-align:right"><strong>Sales</strong></td><td style="text-align:right"><strong>Gross</strong></td></tr>${staff}</table>
<div class="divider"></div>
<div style="font-size:9px;text-align:center;color:#777">Powered by Quivo</div>
</body></html>`;

  const w = window.open("", "_blank", "width=420,height=620");
  if (!w) {
    toast.error("Allow pop-ups to print the Z-report.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 400);
}

export function DayEndView({
  shopId,
  shopName,
  initialCurrent,
  initialHistory,
}: Props) {
  const [current, setCurrent] = useState<DayEndRow | null>(initialCurrent);
  const [history, setHistory] = useState<DayEndRow[]>(initialHistory);
  const [openingCash, setOpeningCash] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [zReport, setZReport] = useState<ZReport | null>(null);

  const refreshHistory = async () => {
    const res = await listClosedDays(shopId);
    if (res.rows) setHistory(res.rows);
  };

  const handleOpen = () => {
    const cash = Number(openingCash) || 0;
    startTransition(async () => {
      const res = await openDay(shopId, cash, notes || undefined);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setCurrent(res.row ?? null);
      setOpeningCash("0");
      setNotes("");
      toast.success(`Day opened with ${money(cash)} float.`);
    });
  };

  const handleClose = () => {
    if (!current) return;
    if (countedCash === "" || !Number.isFinite(Number(countedCash))) {
      toast.error("Enter the counted cash amount.");
      return;
    }
    const cash = Number(countedCash);
    startTransition(async () => {
      const res = await closeDay(current.id, cash, closeNotes || undefined);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const closed = res.row ?? null;
      setCurrent(null);
      setCountedCash("");
      setCloseNotes("");
      if (closed) {
        setHistory((prev) => [
          closed,
          ...prev.filter((r) => r.id !== closed.id),
        ]);
        const zr = await getZReport(closed.id);
        if (zr.report) setZReport(zr.report);
      }
      toast.success("Day closed.");
      void refreshHistory();
    });
  };

  const handleViewZ = async (id: string) => {
    const zr = await getZReport(id);
    if (zr.error) {
      toast.error(zr.error);
      return;
    }
    if (zr.report) setZReport(zr.report);
  };

  const expected = useMemo(() => {
    // For the close form we don't know expected until close_day_end runs.
    // Display the opening cash + naive note instead.
    return current
      ? `Opening ${money(current.opening_cash)} + cash sales since ${fmt(current.opened_at)}`
      : "";
  }, [current]);

  // Clear modal on Escape.
  useEffect(() => {
    if (!zReport) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZReport(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zReport]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/owner/finances"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2"
          >
            <ChevronLeft className="h-3 w-3" /> Back to Finances
          </Link>
          <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
            <Banknote className="h-6 w-6 text-[#A7653A]" /> Day End — {shopName}
          </h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">
            Open a day with a cash float, then close it with the counted drawer
            total to reveal the variance.
          </p>
        </div>
      </div>

      {/* Current day card */}
      {current ? (
        <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-black text-[#27324A]">Day open</h2>
            <span className="ml-auto text-xs font-bold text-[#746E73]">
              since {fmt(current.opened_at)}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#f8f8f7] p-4 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
                Opening float
              </p>
              <p className="text-2xl font-black text-[#27324A] mt-1">
                {money(current.opening_cash)}
              </p>
            </div>
            <div className="bg-[#f8f8f7] p-4 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
                Expected at close
              </p>
              <p className="text-xs text-[#746E73] mt-2">{expected}</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#746E73]">
              Counted cash
            </label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              placeholder="e.g. 18500"
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#746E73]">
              Notes (optional)
            </label>
            <Textarea
              rows={2}
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="Reason for variance, drawer adjustments, etc."
              className="rounded-xl resize-none"
            />
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="w-full h-12 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <StopCircle className="h-4 w-4" />
            )}
            Close day &amp; show Z-report
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#746E73]/40" />
            <h2 className="font-black text-[#27324A]">No open day</h2>
          </div>
          <p className="text-sm text-[#746E73]">
            Start a fresh day by recording the cash drawer float.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#746E73]">
              Opening cash float
            </label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="e.g. 5000"
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#746E73]">
              Notes (optional)
            </label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Who opened, drawer notes, etc."
              className="rounded-xl resize-none"
            />
          </div>
          <button
            type="button"
            onClick={handleOpen}
            disabled={isPending}
            className="w-full h-12 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Open day
          </button>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#2E3344]/8 flex items-center gap-2">
          <History className="h-4 w-4 text-[#A7653A]" />
          <h3 className="font-black text-[#27324A]">Closed days</h3>
          <span className="ml-auto text-xs font-bold text-[#746E73]">
            {history.length}
          </span>
        </div>
        {history.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-[#746E73]">
            No closed days yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73] font-black">
                <tr>
                  <th className="px-4 py-3 text-left">Opened</th>
                  <th className="px-4 py-3 text-left">Closed</th>
                  <th className="px-4 py-3 text-right">Opening</th>
                  <th className="px-4 py-3 text-right">Expected</th>
                  <th className="px-4 py-3 text-right">Counted</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E3344]/5">
                {history.map((d) => {
                  const v = Number(d.variance ?? 0);
                  return (
                    <tr key={d.id} className="hover:bg-[#f8f8f7]/50">
                      <td className="px-4 py-3 text-xs">{fmt(d.opened_at)}</td>
                      <td className="px-4 py-3 text-xs">{fmt(d.closed_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {money(d.opening_cash)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {money(d.expected_cash)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {money(d.counted_cash)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${v === 0 ? "text-[#27324A]" : v > 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {v >= 0 ? money(v) : `−${money(-v)}`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleViewZ(d.id)}
                          className="text-xs font-bold text-[#A7653A] hover:underline inline-flex items-center gap-1"
                        >
                          <Printer className="h-3 w-3" /> Z-report
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Z-report modal */}
      {zReport && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setZReport(null)}
        >
          <div
            className="bg-white rounded-[2rem] max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#2E3344]/8 flex items-center justify-between">
              <div>
                <h3 className="font-black text-xl text-[#27324A]">Z-Report</h3>
                <p className="text-xs text-[#746E73]">
                  {fmt(zReport.day.opened_at)} → {fmt(zReport.day.closed_at)}
                </p>
              </div>
              <button
                onClick={() => setZReport(null)}
                className="text-[#746E73] hover:text-[#27324A] text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <ZRow label="Receipts" value={String(zReport.receipts)} />
              <ZRow
                label="Gross sales"
                value={money(zReport.totals.gross_sales)}
              />
              <ZRow
                label="Tax collected"
                value={money(zReport.totals.tax_collected)}
              />
              <ZRow
                label="Discounts"
                value={`− ${money(zReport.totals.discounts)}`}
              />
              <ZRow
                label="Refunds"
                value={`− ${money(zReport.totals.refund_amount)}`}
              />
              <ZRow
                label="Net sales"
                value={money(
                  zReport.totals.net_sales - zReport.totals.refund_amount,
                )}
                bold
              />
              <div className="border-t border-[#2E3344]/10 pt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73] mb-2">
                  By payment method
                </p>
                <ZRow label="Cash" value={money(zReport.totals.cash)} />
                <ZRow label="Card" value={money(zReport.totals.card)} />
                <ZRow label="QR" value={money(zReport.totals.qr)} />
                <ZRow label="Online" value={money(zReport.totals.online)} />
                <ZRow label="Wallet" value={money(zReport.totals.wallet)} />
                <ZRow label="Udhar" value={money(zReport.totals.udhar)} />
              </div>
              <div className="border-t border-[#2E3344]/10 pt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73] mb-2">
                  Cash drawer
                </p>
                <ZRow label="Opening" value={money(zReport.day.opening_cash)} />
                <ZRow
                  label="Expected"
                  value={money(zReport.day.expected_cash)}
                />
                <ZRow label="Counted" value={money(zReport.day.counted_cash)} />
                <ZRow
                  label="Variance"
                  value={money(zReport.day.variance)}
                  bold
                />
              </div>
              {zReport.by_staff.length > 0 && (
                <div className="border-t border-[#2E3344]/10 pt-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73] mb-2">
                    By staff
                  </p>
                  {zReport.by_staff.map((s) => (
                    <ZRow
                      key={s.staff_name}
                      label={`${s.staff_name} (${s.sales_count})`}
                      value={money(s.gross)}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-[#2E3344]/8 flex gap-3">
              <button
                onClick={() => setZReport(null)}
                className="flex-1 h-11 rounded-xl border border-[#2E3344]/10 font-bold text-[#27324A]"
              >
                Close
              </button>
              <button
                onClick={() => printZReport(zReport)}
                className="flex-1 h-11 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline hint when there's no shop yet (defensive) */}
      {!current && history.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-[#746E73] bg-[#F7F0E6]/40 p-3 rounded-xl">
          <AlertCircle className="h-3.5 w-3.5 text-[#A7653A]" />
          The first day you open will set the baseline for future variance
          reports.
        </div>
      )}
    </div>
  );
}

function ZRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${bold ? "font-black text-[#27324A] text-base" : "text-[#746E73]"}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
