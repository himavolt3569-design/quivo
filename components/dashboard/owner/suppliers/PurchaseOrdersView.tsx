"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  PackagePlus,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from "@/app/actions/purchase-orders";

interface Product {
  id: string;
  name: string;
  unit: string | null;
  cost_price: number | null;
  stock: number;
  low_stock_threshold: number | null;
}

interface POLine {
  id: string;
  product_id: string;
  product_name: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
}

interface PurchaseOrder {
  id: string;
  status:
    | "draft"
    | "submitted"
    | "partial"
    | "received"
    | "closed"
    | "cancelled";
  ordered_at: string | null;
  expected_at: string | null;
  received_at: string | null;
  total_amount: number;
  notes: string | null;
  billed_after_receive: boolean;
  created_at: string;
  lines: POLine[];
}

interface Props {
  shopId: string;
  supplierId: string;
  supplierName: string;
  products: Product[];
  initialOrders: PurchaseOrder[];
}

function money(n: number) {
  return `Rs. ${(Number(n) || 0).toFixed(2)}`;
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-amber-100 text-amber-700",
  partial: "bg-blue-100 text-blue-700",
  received: "bg-emerald-100 text-emerald-700",
  closed: "bg-stone-200 text-stone-700",
  cancelled: "bg-red-100 text-red-700",
};

export function PurchaseOrdersView({
  shopId,
  supplierId,
  supplierName,
  products,
  initialOrders,
}: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Create-PO state
  const [draftLines, setDraftLines] = useState<
    Array<{
      product_id: string;
      qty: string;
      unit_cost: string;
      expected_expiry: string;
    }>
  >([]);
  const [productPicker, setProductPicker] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [billedAfter, setBilledAfter] = useState(true);

  // Receive state per PO
  const [receiveQty, setReceiveQty] = useState<
    Record<string, Record<string, string>>
  >({});

  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!productPicker.trim()) return products.slice(0, 30);
    const q = productPicker.trim().toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [products, productPicker]);

  const draftTotal = useMemo(
    () =>
      draftLines.reduce(
        (a, l) => a + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0),
        0,
      ),
    [draftLines],
  );

  const addLine = (productId: string) => {
    if (draftLines.some((l) => l.product_id === productId)) return;
    const p = productById.get(productId);
    if (!p) return;
    setDraftLines((prev) => [
      ...prev,
      {
        product_id: productId,
        qty: "1",
        unit_cost: String(p.cost_price ?? 0),
        expected_expiry: "",
      },
    ]);
    setProductPicker("");
  };

  const updateLine = (
    productId: string,
    key: "qty" | "unit_cost" | "expected_expiry",
    value: string,
  ) => {
    setDraftLines((prev) =>
      prev.map((l) =>
        l.product_id === productId ? { ...l, [key]: value } : l,
      ),
    );
  };

  const removeLine = (productId: string) => {
    setDraftLines((prev) => prev.filter((l) => l.product_id !== productId));
  };

  const resetCreate = () => {
    setDraftLines([]);
    setPoNotes("");
    setExpectedAt("");
    setBilledAfter(true);
    setCreateOpen(false);
  };

  const submitCreate = () => {
    if (draftLines.length === 0) {
      toast.error("Add at least one product line.");
      return;
    }
    const lines = draftLines.map((l) => ({
      product_id: l.product_id,
      qty_ordered: Number(l.qty) || 0,
      unit_cost: Number(l.unit_cost) || 0,
      expected_expiry: l.expected_expiry || null,
    }));
    if (lines.some((l) => l.qty_ordered <= 0)) {
      toast.error("Every line needs a qty > 0.");
      return;
    }
    startTransition(async () => {
      const res = await createPurchaseOrder({
        shopId,
        supplierId,
        expectedAt: expectedAt || null,
        notes: poNotes || null,
        billedAfterReceive: billedAfter,
        lines,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Purchase order created");
      resetCreate();
      // Add an optimistic row; server revalidate will refresh.
      const newPo: PurchaseOrder = {
        id: res.id!,
        status: "submitted",
        ordered_at: new Date().toISOString(),
        expected_at: expectedAt || null,
        received_at: null,
        total_amount: draftTotal,
        notes: poNotes || null,
        billed_after_receive: billedAfter,
        created_at: new Date().toISOString(),
        lines: draftLines.map((l, i) => ({
          id: `pending-${i}`,
          product_id: l.product_id,
          product_name: productById.get(l.product_id)?.name ?? "?",
          qty_ordered: Number(l.qty) || 0,
          qty_received: 0,
          unit_cost: Number(l.unit_cost) || 0,
        })),
      };
      setOrders((prev) => [newPo, ...prev]);
    });
  };

  const submitReceive = (poId: string) => {
    const lineMap = receiveQty[poId] ?? {};
    const lines: {
      line_id: string;
      qty: number;
      batch_no?: string | null;
      expiry_date?: string | null;
    }[] = [];
    for (const [line_id, raw] of Object.entries(lineMap)) {
      const qty = Number(raw);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      lines.push({ line_id, qty });
    }
    if (lines.length === 0) {
      toast.error("Enter at least one received qty.");
      return;
    }
    startTransition(async () => {
      const res = await receivePurchaseOrder({ poId, lines });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Lines received — batches created.");
      setReceiveQty((prev) => ({ ...prev, [poId]: {} }));
      // Reflect optimistically.
      setOrders((prev) =>
        prev.map((po) => {
          if (po.id !== poId) return po;
          const next = { ...po };
          next.lines = po.lines.map((l) => {
            const received = lineMap[l.id];
            if (received === undefined) return l;
            const add = Number(received) || 0;
            return { ...l, qty_received: l.qty_received + add };
          });
          const allDone = next.lines.every(
            (l) => l.qty_received >= l.qty_ordered,
          );
          const any = next.lines.some((l) => l.qty_received > 0);
          next.status = allDone ? "received" : any ? "partial" : po.status;
          if (allDone) next.received_at = new Date().toISOString();
          return next;
        }),
      );
    });
  };

  const handleCancel = (poId: string) => {
    if (!confirm("Cancel this PO?")) return;
    startTransition(async () => {
      const res = await cancelPurchaseOrder(poId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setOrders((prev) =>
        prev.map((po) =>
          po.id === poId ? { ...po, status: "cancelled" } : po,
        ),
      );
      toast.success("PO cancelled");
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-[#27324A] flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#A7653A]" /> Purchase Orders
          </h2>
          <p className="text-xs text-[#746E73]">Restock from {supplierName}.</p>
        </div>
        <button
          onClick={() => setCreateOpen((v) => !v)}
          className="h-10 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white text-sm font-bold flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> {createOpen ? "Close" : "New PO"}
        </button>
      </div>

      {createOpen && (
        <div className="bg-white rounded-2xl border border-[#27324A]/15 shadow-sm p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
                Expected delivery
              </label>
              <Input
                type="date"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
                className="h-11 rounded-xl mt-1"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs font-bold text-[#27324A]">
                <input
                  type="checkbox"
                  checked={billedAfter}
                  onChange={(e) => setBilledAfter(e.target.checked)}
                  className="h-4 w-4 accent-[#27324A]"
                />
                Bill supplier on receive (adds to balance due)
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
              Lines
            </label>
            <Input
              value={productPicker}
              onChange={(e) => setProductPicker(e.target.value)}
              placeholder="Search products to add…"
              className="h-11 rounded-xl"
            />
            {productPicker.trim() && (
              <div className="max-h-40 overflow-y-auto bg-[#f8f8f7] rounded-xl p-2 space-y-1">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-[#746E73] text-center py-2">
                    No match.
                  </p>
                ) : (
                  filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addLine(p.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white text-sm font-bold text-[#27324A] flex justify-between"
                    >
                      <span>{p.name}</span>
                      <span className="text-[11px] text-[#746E73] font-normal">
                        stock {p.stock}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            {draftLines.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#746E73] font-bold">
                No lines yet.
              </div>
            ) : (
              <ul className="divide-y divide-[#2E3344]/5 border border-[#2E3344]/10 rounded-xl overflow-hidden">
                {draftLines.map((l) => {
                  const p = productById.get(l.product_id);
                  return (
                    <li
                      key={l.product_id}
                      className="grid grid-cols-[1fr_80px_110px_120px_36px] gap-2 items-center px-3 py-2 bg-white"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#27324A]">
                          {p?.name ?? "?"}
                        </p>
                        <p className="text-[10px] text-[#746E73]">
                          {p?.unit ?? ""}
                        </p>
                      </div>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        min="0"
                        value={l.qty}
                        onChange={(e) =>
                          updateLine(l.product_id, "qty", e.target.value)
                        }
                        className="h-9 text-right text-sm rounded-lg"
                        placeholder="qty"
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={l.unit_cost}
                        onChange={(e) =>
                          updateLine(l.product_id, "unit_cost", e.target.value)
                        }
                        className="h-9 text-right text-sm rounded-lg"
                        placeholder="cost"
                      />
                      <Input
                        type="date"
                        value={l.expected_expiry}
                        onChange={(e) =>
                          updateLine(
                            l.product_id,
                            "expected_expiry",
                            e.target.value,
                          )
                        }
                        className="h-9 text-sm rounded-lg"
                      />
                      <button
                        onClick={() => removeLine(l.product_id)}
                        className="h-9 w-9 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Textarea
            rows={2}
            placeholder="Notes (optional) — terms, payment, contact name"
            value={poNotes}
            onChange={(e) => setPoNotes(e.target.value)}
            className="rounded-xl resize-none"
          />

          <div className="flex items-center justify-between border-t border-[#2E3344]/8 pt-4">
            <p className="text-sm font-bold text-[#27324A]">
              Total:{" "}
              <span className="text-lg font-black text-[#A7653A]">
                {money(draftTotal)}
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={resetCreate}
                className="h-10 px-3 rounded-xl border border-[#2E3344]/10 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={submitCreate}
                disabled={isPending || draftLines.length === 0}
                className="h-10 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-xs flex items-center gap-2 disabled:opacity-40"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 hidden" />
                ) : (
                  <PackagePlus className="h-4 w-4" />
                )}
                Submit PO
              </button>
            </div>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm p-12 text-center text-sm font-bold text-[#746E73]">
          No purchase orders yet for {supplierName}.
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.map((po) => {
            const isOpen = !!open[po.id];
            const receivable =
              po.status === "submitted" || po.status === "partial";
            return (
              <li
                key={po.id}
                className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpen((prev) => ({ ...prev, [po.id]: !prev[po.id] }))
                  }
                  className="w-full text-left p-4 flex items-center gap-3 hover:bg-[#f8f8f7]/50 transition"
                >
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_BADGE[po.status]}`}
                  >
                    {po.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#27324A]">
                      {money(po.total_amount)} · {po.lines.length} line
                      {po.lines.length === 1 ? "" : "s"}
                    </p>
                    <p className="text-[11px] text-[#746E73]">
                      ordered {fmt(po.ordered_at)}
                      {po.expected_at ? ` · expected ${po.expected_at}` : ""}
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-[#746E73]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#746E73]" />
                  )}
                </button>
                {isOpen && (
                  <div className="border-t border-[#2E3344]/8 p-4 space-y-3">
                    <table className="w-full text-xs">
                      <thead className="text-[10px] uppercase tracking-widest text-[#746E73] font-black">
                        <tr>
                          <th className="text-left py-2">Product</th>
                          <th className="text-right">Ordered</th>
                          <th className="text-right">Received</th>
                          <th className="text-right">Unit cost</th>
                          {receivable && (
                            <th className="text-right w-28">Receive now</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2E3344]/5">
                        {po.lines.map((l) => {
                          const remaining = l.qty_ordered - l.qty_received;
                          return (
                            <tr key={l.id}>
                              <td className="py-2 font-bold text-[#27324A]">
                                {l.product_name}
                              </td>
                              <td className="text-right">{l.qty_ordered}</td>
                              <td className="text-right">{l.qty_received}</td>
                              <td className="text-right">
                                {money(l.unit_cost)}
                              </td>
                              {receivable && (
                                <td className="text-right">
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.001"
                                    min="0"
                                    max={remaining}
                                    value={receiveQty[po.id]?.[l.id] ?? ""}
                                    onChange={(e) =>
                                      setReceiveQty((prev) => ({
                                        ...prev,
                                        [po.id]: {
                                          ...(prev[po.id] ?? {}),
                                          [l.id]: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="0"
                                    className="h-8 text-right text-xs rounded-lg"
                                    disabled={remaining <= 0}
                                  />
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {po.notes && (
                      <p className="text-[11px] text-[#746E73] italic">
                        &quot;{po.notes}&quot;
                      </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2 border-t border-[#2E3344]/5">
                      {receivable && (
                        <button
                          onClick={() => submitReceive(po.id)}
                          disabled={isPending}
                          className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                        >
                          <PackagePlus className="h-3.5 w-3.5" /> Receive
                        </button>
                      )}
                      {(po.status === "submitted" ||
                        po.status === "draft" ||
                        po.status === "partial") && (
                        <button
                          onClick={() => handleCancel(po.id)}
                          disabled={isPending}
                          className="h-9 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
