"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  Loader2,
  Move,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAndExecuteTransfer } from "@/app/actions/stock-transfers";

interface Shop {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  unit: string | null;
  stock: number;
}

interface Line {
  id: string;
  qty: string;
}

interface TransferRow {
  id: string;
  from_shop_id: string;
  to_shop_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  lines: Array<{
    id: string;
    qty: number;
    product?: { name?: string } | { name?: string }[] | null;
  }>;
}

interface Props {
  shops: Shop[];
  activeShopId: string;
  /** Map of shop_id -> products in that shop (only fetched for the active shop). */
  sourceProducts: Product[];
  history: TransferRow[];
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function StockTransferView({
  shops,
  activeShopId,
  sourceProducts,
  history,
}: Props) {
  const [fromShop, setFromShop] = useState(activeShopId);
  const [toShop, setToShop] = useState(
    shops.find((s) => s.id !== activeShopId)?.id ?? "",
  );
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of sourceProducts) m.set(p.id, p);
    return m;
  }, [sourceProducts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sourceProducts.slice(0, 25);
    const q = search.trim().toLowerCase();
    return sourceProducts
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 25);
  }, [sourceProducts, search]);

  const addLine = (productId: string) => {
    if (picked.some((l) => l.id === productId)) return;
    setPicked((prev) => [...prev, { id: productId, qty: "1" }]);
    setSearch("");
  };
  const updateQty = (id: string, qty: string) => {
    setPicked((prev) => prev.map((l) => (l.id === id ? { ...l, qty } : l)));
  };
  const removeLine = (id: string) => {
    setPicked((prev) => prev.filter((l) => l.id !== id));
  };

  const submit = () => {
    if (!fromShop || !toShop) {
      toast.error("Pick source and destination shops.");
      return;
    }
    if (fromShop === toShop) {
      toast.error("Source and destination must differ.");
      return;
    }
    if (picked.length === 0) {
      toast.error("Add at least one line.");
      return;
    }
    const lines: { product_id: string; qty: number }[] = [];
    for (const l of picked) {
      const q = Number(l.qty);
      if (!Number.isFinite(q) || q <= 0) {
        toast.error("Each line needs qty > 0.");
        return;
      }
      lines.push({ product_id: l.id, qty: q });
    }
    startTransition(async () => {
      const res = await createAndExecuteTransfer({
        fromShopId: fromShop,
        toShopId: toShop,
        notes: notes || null,
        lines,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Transfer completed");
      setPicked([]);
      setNotes("");
    });
  };

  const shopNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shops) m.set(s.id, s.name);
    return m;
  }, [shops]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <Link
          href="/dashboard/owner/products"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2"
        >
          <ChevronLeft className="h-3 w-3" /> Back to Products
        </Link>
        <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
          <Move className="h-6 w-6 text-[#A7653A]" /> Inter-shop transfer
        </h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">
          Move stock between your shops. The transfer is atomic — source
          decremented and destination batch created in a single transaction.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm p-6 space-y-4">
        {/* Shop pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
              From shop
            </label>
            <select
              value={fromShop}
              onChange={(e) => setFromShop(e.target.value)}
              className="h-11 px-3 rounded-xl border border-[#2E3344]/15 bg-white text-sm font-bold w-full mt-1"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#746E73] mt-1">
              Product list below is fetched from the source. Switch shops to
              change it.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-[#A7653A] mx-auto hidden sm:block" />
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
              To shop
            </label>
            <select
              value={toShop}
              onChange={(e) => setToShop(e.target.value)}
              className="h-11 px-3 rounded-xl border border-[#2E3344]/15 bg-white text-sm font-bold w-full mt-1"
            >
              <option value="">— pick destination —</option>
              {shops
                .filter((s) => s.id !== fromShop)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Note that source-product list is fixed to activeShopId */}
        {fromShop !== activeShopId && (
          <div className="p-3 rounded-xl bg-[#F7F0E6]/60 text-[11px] font-bold text-[#A7653A]">
            The product list below is from the currently-active shop. Switch the
            active shop to transfer from a different source.
          </div>
        )}

        {/* Product picker */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
            Lines (from {shopNameById.get(activeShopId) ?? "active shop"})
          </label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products to add…"
            className="h-11 rounded-xl mt-1"
            disabled={fromShop !== activeShopId}
          />
          {search.trim() && fromShop === activeShopId && (
            <div className="max-h-40 overflow-y-auto bg-[#f8f8f7] rounded-xl p-2 space-y-1 mt-2">
              {filtered.length === 0 ? (
                <p className="text-xs text-[#746E73] text-center py-2">
                  No match.
                </p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addLine(p.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white text-sm font-bold text-[#27324A] flex justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-[11px] text-[#746E73] font-normal">
                      stock {p.stock}
                      {p.unit ? ` ${p.unit}` : ""}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Picked lines */}
        {picked.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#746E73] font-bold">
            No lines yet.
          </div>
        ) : (
          <ul className="divide-y divide-[#2E3344]/5 border border-[#2E3344]/10 rounded-xl overflow-hidden">
            {picked.map((l) => {
              const p = productById.get(l.id);
              return (
                <li
                  key={l.id}
                  className="grid grid-cols-[1fr_120px_36px] gap-2 items-center px-3 py-2 bg-white"
                >
                  <div>
                    <p className="text-sm font-bold text-[#27324A]">
                      {p?.name ?? "?"}
                    </p>
                    <p className="text-[10px] text-[#746E73]">
                      stock {p?.stock ?? 0}
                      {p?.unit ? ` ${p.unit}` : ""}
                    </p>
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min="0"
                    max={p?.stock}
                    value={l.qty}
                    onChange={(e) => updateQty(l.id, e.target.value)}
                    className="h-9 text-right text-sm rounded-lg"
                    placeholder="qty"
                  />
                  <button
                    onClick={() => removeLine(l.id)}
                    className="h-9 w-9 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional) — driver, vehicle, reason"
          className="rounded-xl resize-none"
        />

        <div className="flex justify-end gap-2 border-t border-[#2E3344]/8 pt-4">
          <button
            type="button"
            onClick={submit}
            disabled={isPending || picked.length === 0}
            className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Transfer &amp; execute
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#2E3344]/8 flex items-center gap-2">
          <h3 className="font-black text-[#27324A]">Recent transfers</h3>
          <span className="ml-auto text-xs font-bold text-[#746E73]">
            {history.length}
          </span>
        </div>
        {history.length === 0 ? (
          <div className="py-8 text-center text-sm font-bold text-[#746E73]">
            No transfers yet.
          </div>
        ) : (
          <ul className="divide-y divide-[#2E3344]/5">
            {history.map((t) => (
              <li key={t.id} className="p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#27324A]">
                  <span>{shopNameById.get(t.from_shop_id) ?? "—"}</span>
                  <ArrowRight className="h-3 w-3 text-[#A7653A]" />
                  <span>{shopNameById.get(t.to_shop_id) ?? "—"}</span>
                  <span
                    className={`ml-auto text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      t.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : t.status === "cancelled"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <p className="text-[11px] text-[#746E73] mt-1">
                  {fmt(t.created_at)}
                </p>
                {t.lines.length > 0 && (
                  <ul className="text-[11px] text-[#27324A] mt-2 space-y-0.5">
                    {t.lines.map((l) => {
                      const product = Array.isArray(l.product)
                        ? l.product[0]
                        : l.product;
                      return (
                        <li key={l.id}>
                          · {product?.name ?? "?"} × {l.qty}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {t.notes && (
                  <p className="text-[11px] text-[#746E73] italic mt-2">
                    &quot;{t.notes}&quot;
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
