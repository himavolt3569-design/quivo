"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ClipboardCheck,
  PlayCircle,
  Trash2,
  Save,
  CheckCircle2,
  Loader2,
  History,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  startStockTake,
  upsertStockTakeCount,
  completeStockTake,
  cancelStockTake,
} from "@/app/actions/stock-take";

interface Product {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
  stock: number;
}

interface StockTakeRow {
  id: string;
  status: "open" | "completed" | "cancelled";
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  variance_count?: number;
  variance_value?: number;
}

interface ExistingCount {
  product_id: string;
  system_qty: number;
  counted_qty: number;
  variance: number;
}

interface Props {
  shopId: string;
  shopName: string;
  products: Product[];
  openTake: { row: StockTakeRow; counts: ExistingCount[] } | null;
  history: StockTakeRow[];
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function StockTakeView({
  shopId,
  shopName,
  products,
  openTake,
  history,
}: Props) {
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const c of openTake?.counts ?? [])
      initial[c.product_id] = String(c.counted_qty);
    return initial;
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const totalVariance = useMemo(() => {
    let n = 0;
    for (const p of products) {
      const raw = counts[p.id];
      if (raw === undefined || raw === "") continue;
      const v = Number(raw) - Number(p.stock);
      if (Number.isFinite(v) && v !== 0) n += 1;
    }
    return n;
  }, [counts, products]);

  const handleStart = (note?: string) => {
    startTransition(async () => {
      const res = await startStockTake(shopId, note);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Stock take started");
      // Server revalidate will refetch the page.
    });
  };

  const handleCancel = () => {
    if (!openTake) return;
    if (!confirm("Cancel this stock take? Counts will be lost.")) return;
    startTransition(async () => {
      const res = await cancelStockTake(openTake.row.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Stock take cancelled");
    });
  };

  const handleFinalise = () => {
    if (!openTake) return;
    if (
      !confirm(
        "Finalise the stock take? Variances will become permanent stock adjustments.",
      )
    )
      return;
    startTransition(async () => {
      const res = await completeStockTake(openTake.row.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Stock take completed");
    });
  };

  const saveCount = async (
    productId: string,
    systemQty: number,
    raw: string,
  ) => {
    if (!openTake) return;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) {
      toast.error("Enter a non-negative number");
      return;
    }
    setSavingId(productId);
    const res = await upsertStockTakeCount({
      takeId: openTake.row.id,
      productId,
      systemQty,
      countedQty: num,
    });
    setSavingId(null);
    if (res.error) toast.error(res.error);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/dashboard/owner/products"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2"
          >
            <ChevronLeft className="h-3 w-3" /> Back to Products
          </Link>
          <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-[#A7653A]" /> Stock take —{" "}
            {shopName}
          </h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">
            Reconcile system stock against what&apos;s actually on the shelf.
          </p>
        </div>
        {!openTake && (
          <button
            type="button"
            onClick={() => handleStart()}
            disabled={isPending}
            className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 hidden" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Start stock take
          </button>
        )}
      </div>

      {openTake ? (
        <>
          <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#746E73]">
                Open stock take
              </p>
              <p className="text-sm font-bold text-[#27324A]">
                Started {fmt(openTake.row.started_at)}
              </p>
              <p className="text-[11px] text-[#A7653A] mt-1">
                {totalVariance} item{totalVariance === 1 ? "" : "s"} with
                non-zero variance
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={isPending}
                className="h-10 px-3 rounded-xl border border-red-200 text-red-600 font-bold text-xs flex items-center gap-1 hover:bg-red-50 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Cancel
              </button>
              <button
                onClick={handleFinalise}
                disabled={isPending}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Finalise
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#746E73]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-9 h-11 rounded-xl bg-[#f8f8f7] border-transparent"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73] font-black">
                  <tr>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-right">System</th>
                    <th className="px-4 py-3 text-right w-40">Counted</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E3344]/5">
                  {filtered.map((p) => {
                    const raw = counts[p.id] ?? "";
                    const counted = raw === "" ? null : Number(raw);
                    const variance =
                      counted === null ? null : counted - p.stock;
                    const varianceClass =
                      variance === null
                        ? "text-[#746E73]"
                        : variance === 0
                          ? "text-[#27324A]"
                          : variance > 0
                            ? "text-emerald-600"
                            : "text-red-600";
                    return (
                      <tr key={p.id} className="hover:bg-[#f8f8f7]/50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#27324A]">{p.name}</p>
                          <p className="text-[11px] text-[#746E73]">
                            {[p.brand, p.unit].filter(Boolean).join(" · ")}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-[#746E73]">
                          {p.stock}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.001"
                              min="0"
                              value={raw}
                              onChange={(e) =>
                                setCounts((prev) => ({
                                  ...prev,
                                  [p.id]: e.target.value,
                                }))
                              }
                              onBlur={(e) =>
                                void saveCount(p.id, p.stock, e.target.value)
                              }
                              placeholder="—"
                              className="h-9 w-24 text-right px-2 border border-[#2E3344]/10 rounded-lg text-sm"
                            />
                            {savingId === p.id && (
                              <Loader2 className="h-3 w-3 hidden text-[#746E73]" />
                            )}
                          </div>
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold ${varianceClass}`}
                        >
                          {variance === null
                            ? "—"
                            : variance > 0
                              ? `+${variance}`
                              : variance}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-[#2E3344]/8 flex items-center justify-end gap-2">
              <Save className="h-3.5 w-3.5 text-[#746E73]" />
              <span className="text-[11px] text-[#746E73]">
                Counts auto-save when you leave each field.
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm p-12 text-center">
          <ClipboardCheck className="h-10 w-10 text-[#746E73] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-bold text-[#27324A]">
            No open stock take.
          </p>
          <p className="text-xs text-[#746E73] mt-1">
            Click <strong>Start stock take</strong> above to begin.
          </p>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#2E3344]/8 flex items-center gap-2">
          <History className="h-4 w-4 text-[#A7653A]" />
          <h3 className="font-black text-[#27324A]">History</h3>
          <span className="ml-auto text-xs font-bold text-[#746E73]">
            {history.length}
          </span>
        </div>
        {history.length === 0 ? (
          <div className="py-8 text-center text-sm font-bold text-[#746E73]">
            No prior stock takes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73] font-black">
                <tr>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-left">Completed</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E3344]/5">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-3 text-xs">{fmt(h.started_at)}</td>
                    <td className="px-4 py-3 text-xs">{fmt(h.completed_at)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          h.status === "completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : h.status === "cancelled"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {h.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#746E73]">
                      {h.notes ?? "—"}
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
