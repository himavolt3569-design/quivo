"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import {
  Banknote,
  Calendar,
  Download,
  RefreshCw,
  Plus,
  Trash2,
  History,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getPayrollSummary,
  getPayrollLines,
  setStaffRate,
  deleteStaffRate,
  type PayrollSummaryRow,
  type PayrollLine,
} from "@/app/actions/shifts";

export interface StaffOption {
  id: string;
  name: string;
  status: string;
}

export interface StaffRateRow {
  id: string;
  staff_id: string;
  hourly_rate: number;
  currency: string;
  effective_from: string;
  note: string | null;
}

interface Props {
  shopId: string;
  shopName: string;
  staff: StaffOption[];
  ratesByStaff: Record<string, StaffRateRow[]>;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // make Monday the first day
  out.setDate(out.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function fmtMoney(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  // BOM so Excel recognises UTF-8
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

// ─── Component ───────────────────────────────────────────────────────────────

export function PayrollView({ shopId, shopName, staff, ratesByStaff }: Props) {
  const today = useMemo(() => new Date(), []);
  const [start, setStart] = useState<string>(() =>
    toDateInput(startOfWeek(today)),
  );
  const [end, setEnd] = useState<string>(() => toDateInput(endOfWeek(today)));

  const [summary, setSummary] = useState<PayrollSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [rates, setRates] =
    useState<Record<string, StaffRateRow[]>>(ratesByStaff);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);

  const [rateForm, setRateForm] = useState({
    staffId: staff[0]?.id ?? "",
    hourlyRate: "",
    currency: "NPR",
    effectiveFrom: "",
    note: "",
  });

  const loadSummary = useMemo(() => {
    return async () => {
      setLoading(true);
      const startIso = new Date(`${start}T00:00:00`).toISOString();
      const endIso = new Date(`${end}T23:59:59.999`).toISOString();
      const res = await getPayrollSummary({
        shopId,
        start: startIso,
        end: endIso,
      });
      setLoading(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setSummary(res.rows ?? []);
    };
  }, [shopId, start, end]);

  // Intentional data-load-on-dep-change: setLoading/setSummary inside an effect
  // is the canonical pattern for date-range-driven fetches.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSummary();
  }, [loadSummary]);

  const setPreset = (
    kind: "this_week" | "last_week" | "this_month" | "last_month",
  ) => {
    const now = new Date();
    if (kind === "this_week") {
      setStart(toDateInput(startOfWeek(now)));
      setEnd(toDateInput(endOfWeek(now)));
    } else if (kind === "last_week") {
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - 7);
      setStart(toDateInput(startOfWeek(lastWeek)));
      setEnd(toDateInput(endOfWeek(lastWeek)));
    } else if (kind === "this_month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStart(toDateInput(s));
      setEnd(toDateInput(e));
    } else if (kind === "last_month") {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      setStart(toDateInput(s));
      setEnd(toDateInput(e));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    const startIso = new Date(`${start}T00:00:00`).toISOString();
    const endIso = new Date(`${end}T23:59:59.999`).toISOString();
    const res = await getPayrollLines({ shopId, start: startIso, end: endIso });
    setExporting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const lines: PayrollLine[] = res.lines ?? [];
    if (lines.length === 0) {
      toast.info("No completed shifts in range — nothing to export.");
      return;
    }
    const header = [
      "Shift ID",
      "Staff",
      "Scheduled start",
      "Scheduled end",
      "Clock in",
      "Clock out",
      "Hours worked",
      "Rate",
      "Pay",
      "Currency",
    ];
    const rows = [
      header,
      ...lines.map((l) => [
        l.shift_id,
        l.staff_name,
        l.scheduled_start,
        l.scheduled_end,
        l.clocked_in_at,
        l.clocked_out_at,
        l.worked_hours.toFixed(2),
        Number(l.rate).toFixed(2),
        Number(l.pay).toFixed(2),
        l.currency,
      ]),
    ];
    const fname = `${shopName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-payroll-${start}-to-${end}.csv`;
    downloadCsv(fname, rows);
    toast.success(
      `Exported ${lines.length} shift line${lines.length === 1 ? "" : "s"}`,
    );
  };

  const handleSetRate = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(rateForm.hourlyRate);
    if (!rateForm.staffId) {
      toast.error("Pick a staff member");
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid rate");
      return;
    }
    const effective = rateForm.effectiveFrom
      ? new Date(`${rateForm.effectiveFrom}T00:00:00`).toISOString()
      : null;

    startTransition(async () => {
      const res = await setStaffRate({
        shopId,
        staffId: rateForm.staffId,
        hourlyRate: value,
        effectiveFrom: effective,
        currency: rateForm.currency,
        note: rateForm.note.trim() || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Rate saved");
      const newRow: StaffRateRow = {
        id: res.id!,
        staff_id: rateForm.staffId,
        hourly_rate: value,
        currency: rateForm.currency,
        effective_from: effective ?? new Date().toISOString(),
        note: rateForm.note.trim() || null,
      };
      setRates((prev) => {
        const list = (prev[rateForm.staffId] ?? []).filter(
          (r) => r.id !== newRow.id,
        );
        return {
          ...prev,
          [rateForm.staffId]: [newRow, ...list].sort((a, b) =>
            b.effective_from.localeCompare(a.effective_from),
          ),
        };
      });
      setRateForm((f) => ({ ...f, hourlyRate: "", note: "" }));
      loadSummary();
    });
  };

  const handleDeleteRate = (rateId: string, staffId: string) => {
    if (!confirm("Delete this rate? Past payroll using it stays unchanged."))
      return;
    startTransition(async () => {
      const res = await deleteStaffRate(rateId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setRates((prev) => ({
        ...prev,
        [staffId]: (prev[staffId] ?? []).filter((r) => r.id !== rateId),
      }));
      toast.success("Rate deleted");
      loadSummary();
    });
  };

  const totals = useMemo(() => {
    const totalHours = summary.reduce((a, b) => a + Number(b.worked_hours), 0);
    const totalPay = summary.reduce((a, b) => a + Number(b.total_pay), 0);
    const totalShifts = summary.reduce((a, b) => a + Number(b.shifts_count), 0);
    const currency = summary[0]?.currency ?? "NPR";
    return { totalHours, totalPay, totalShifts, currency };
  }, [summary]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
            <Banknote className="h-6 w-6 text-[#A7653A]" /> Payroll
          </h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">
            Hours worked × hourly rate. Past pay stays locked to the rate that
            was effective at shift time.
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting || loading}
          className="rounded-xl h-11 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold"
        >
          <Download className="h-4 w-4 mr-2" />{" "}
          {exporting ? "Preparing…" : "Export CSV"}
        </Button>
      </div>

      {/* Range controls */}
      <section className="bg-white rounded-[2rem] border border-[#2E3344]/8 shadow-sm p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              From
            </Label>
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              max={end}
              className="mt-1 h-10 rounded-xl w-44"
            />
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              To
            </Label>
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              min={start}
              className="mt-1 h-10 rounded-xl w-44"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {(
              [
                ["this_week", "This week"],
                ["last_week", "Last week"],
                ["this_month", "This month"],
                ["last_month", "Last month"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className="px-3 h-10 rounded-xl text-xs font-bold bg-[#F7F0E6] text-[#A7653A] hover:bg-[#E8D9C5] transition"
              >
                {label}
              </button>
            ))}
            <button
              onClick={loadSummary}
              disabled={loading}
              className="h-10 w-10 rounded-xl bg-[#27324A] text-white flex items-center justify-center disabled:opacity-60"
              aria-label="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Totals */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-[1.5rem] border border-[#2E3344]/8 p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
            Shifts
          </p>
          <p className="text-2xl font-black text-[#27324A] mt-1">
            {totals.totalShifts}
          </p>
        </div>
        <div className="bg-white rounded-[1.5rem] border border-[#2E3344]/8 p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
            Hours worked
          </p>
          <p className="text-2xl font-black text-[#27324A] mt-1">
            {totals.totalHours.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-[1.5rem] border border-[#A7653A]/30 p-5 bg-[#F7F0E6]/40">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#A7653A]">
            Total payable
          </p>
          <p className="text-2xl font-black text-[#A7653A] mt-1">
            {fmtMoney(totals.totalPay, totals.currency)}
          </p>
        </div>
      </section>

      {/* Summary table */}
      <section className="bg-white rounded-[2rem] border border-[#2E3344]/8 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#2E3344]/8 flex items-center justify-between">
          <h2 className="font-black text-[#27324A] text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#A7653A]" /> Per-staff summary
          </h2>
          {loading && (
            <span className="text-xs text-[#746E73] font-medium animate-pulse">
              Loading…
            </span>
          )}
        </div>
        {summary.length === 0 && !loading ? (
          <p className="text-sm text-[#746E73] py-8 text-center font-medium">
            No completed shifts in this range yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73]">
                <tr>
                  <th className="text-left font-black px-5 py-3">Staff</th>
                  <th className="text-right font-black px-5 py-3">Shifts</th>
                  <th className="text-right font-black px-5 py-3">
                    Scheduled hrs
                  </th>
                  <th className="text-right font-black px-5 py-3">
                    Worked hrs
                  </th>
                  <th className="text-right font-black px-5 py-3">
                    Current rate
                  </th>
                  <th className="text-right font-black px-5 py-3">Total pay</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => {
                  const open = expandedStaff === row.staff_id;
                  const history = rates[row.staff_id] ?? [];
                  return (
                    <Fragment key={row.staff_id}>
                      <tr className="border-t border-[#2E3344]/5">
                        <td className="px-5 py-3 font-bold text-[#27324A]">
                          {row.staff_name}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {row.shifts_count}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#746E73]">
                          {Number(row.scheduled_hours).toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums font-bold">
                          {Number(row.worked_hours).toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {row.current_rate !== null &&
                          row.current_rate !== undefined ? (
                            fmtMoney(Number(row.current_rate), row.currency)
                          ) : (
                            <span className="text-red-500 text-xs font-bold">
                              Not set
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums font-black text-[#A7653A]">
                          {fmtMoney(Number(row.total_pay), row.currency)}
                        </td>
                        <td className="px-2">
                          <button
                            onClick={() =>
                              setExpandedStaff(open ? null : row.staff_id)
                            }
                            className="h-8 w-8 rounded-lg hover:bg-[#f8f8f7] flex items-center justify-center text-[#746E73]"
                            aria-label="Rate history"
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
                            />
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-[#F7F0E6]/30">
                          <td colSpan={7} className="px-5 py-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#8D5132] mb-2 flex items-center gap-1.5">
                              <History className="h-3 w-3" /> Rate history
                            </p>
                            {history.length === 0 ? (
                              <p className="text-xs text-[#746E73]">
                                No rates set. Add one below.
                              </p>
                            ) : (
                              <ul className="space-y-1.5">
                                {history.map((r) => (
                                  <li
                                    key={r.id}
                                    className="flex items-center justify-between text-xs bg-white border border-[#2E3344]/5 rounded-lg px-3 py-2"
                                  >
                                    <div>
                                      <span className="font-black text-[#27324A]">
                                        {fmtMoney(
                                          Number(r.hourly_rate),
                                          r.currency,
                                        )}
                                      </span>
                                      <span className="text-[#746E73] ml-3">
                                        from {fmtDateTime(r.effective_from)}
                                      </span>
                                      {r.note && (
                                        <span className="text-[#746E73] italic ml-2">
                                          — {r.note}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() =>
                                        handleDeleteRate(r.id, row.staff_id)
                                      }
                                      className="h-7 w-7 rounded-md text-[#746E73] hover:bg-red-50 hover:text-red-500 flex items-center justify-center"
                                      aria-label="Delete rate"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Set rate form */}
      <section className="bg-white rounded-[2rem] border border-[#2E3344]/8 shadow-sm p-5 sm:p-6">
        <h2 className="font-black text-[#27324A] text-sm flex items-center gap-2 mb-1">
          <Plus className="h-4 w-4 text-[#A7653A]" /> Set hourly rate
        </h2>
        <p className="text-xs text-[#746E73] mb-4">
          New rates apply from the chosen date forward. Past shifts keep the
          rate that was active at the time.
        </p>
        <form onSubmit={handleSetRate} className="grid sm:grid-cols-5 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              Staff
            </Label>
            <Select
              value={rateForm.staffId}
              onValueChange={(v) => setRateForm((f) => ({ ...f, staffId: v }))}
            >
              <SelectTrigger className="mt-1 h-11 rounded-xl bg-white">
                <SelectValue placeholder="Pick staff" />
              </SelectTrigger>
              <SelectContent>
                {staff
                  .filter((s) => s.status === "active")
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              Rate / hour
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={rateForm.hourlyRate}
              onChange={(e) =>
                setRateForm((f) => ({ ...f, hourlyRate: e.target.value }))
              }
              placeholder="0.00"
              className="mt-1 h-11 rounded-xl"
              required
            />
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              Currency
            </Label>
            <Input
              value={rateForm.currency}
              onChange={(e) =>
                setRateForm((f) => ({
                  ...f,
                  currency: e.target.value.toUpperCase().slice(0, 3),
                }))
              }
              maxLength={3}
              className="mt-1 h-11 rounded-xl uppercase"
            />
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              Effective from
            </Label>
            <Input
              type="date"
              value={rateForm.effectiveFrom}
              onChange={(e) =>
                setRateForm((f) => ({ ...f, effectiveFrom: e.target.value }))
              }
              className="mt-1 h-11 rounded-xl"
              max={toDateInput(
                // eslint-disable-next-line react-hooks/purity
                new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              )}
            />
          </div>
          <div className="sm:col-span-4">
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              Note (optional)
            </Label>
            <Input
              value={rateForm.note}
              onChange={(e) =>
                setRateForm((f) => ({ ...f, note: e.target.value }))
              }
              placeholder="e.g. annual raise, festive bonus"
              className="mt-1 h-11 rounded-xl"
            />
          </div>
          <div className="sm:col-span-1 flex items-end">
            <Button
              type="submit"
              disabled={isPending}
              className="h-11 w-full rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold"
            >
              {isPending ? "Saving…" : "Save rate"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
