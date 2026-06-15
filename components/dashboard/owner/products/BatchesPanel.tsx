"use client";

import { useState, useTransition } from "react";
import { Calendar, Loader2, PackagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { receiveBatch, deleteEmptyBatch } from "@/app/actions/batches";

interface Batch {
  id: string;
  batch_no: string | null;
  expiry_date: string | null;
  received_qty: number;
  remaining_qty: number;
  cost_price: number;
  received_at: string;
}

interface Props {
  shopId: string;
  productId: string;
  productName: string;
  initialBatches: Batch[];
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function BatchesPanel({
  shopId,
  productId,
  productName,
  initialBatches,
}: Props) {
  const [batches, setBatches] = useState(initialBatches);
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [expiry, setExpiry] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    const q = Number(qty),
      c = Number(cost);
    if (!Number.isFinite(q) || q <= 0) {
      toast.error("Qty must be > 0");
      return;
    }
    if (!Number.isFinite(c) || c < 0) {
      toast.error("Cost must be ≥ 0");
      return;
    }
    startTransition(async () => {
      const res = await receiveBatch({
        shopId,
        productId,
        receivedQty: q,
        costPrice: c,
        batchNo: batchNo || null,
        expiryDate: expiry || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Batch received");
      setBatches((prev) => [
        {
          id: `pending-${Date.now()}`,
          batch_no: batchNo || null,
          expiry_date: expiry || null,
          received_qty: q,
          remaining_qty: q,
          cost_price: c,
          received_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setQty("");
      setCost("");
      setBatchNo("");
      setExpiry("");
      setShowForm(false);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this empty batch?")) return;
    startTransition(async () => {
      const res = await deleteEmptyBatch(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setBatches((prev) => prev.filter((b) => b.id !== id));
      toast.success("Batch deleted");
    });
  };

  const today = new Date();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] flex items-center gap-2">
            <PackagePlus className="h-4 w-4" /> Batches
          </h2>
          <p className="text-xs text-[#746E73] mt-1">
            Inventory drains soonest-expiry first when batches are present.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="h-10 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white text-sm font-bold"
        >
          {showForm ? "Cancel" : "Receive stock"}
        </button>
      </div>

      {showForm && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-[#f8f8f7] rounded-2xl">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
              Qty *
            </label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-10 rounded-xl mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
              Unit cost (Rs.) *
            </label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="h-10 rounded-xl mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
              Batch no.
            </label>
            <Input
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              placeholder="optional"
              className="h-10 rounded-xl mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
              Expiry
            </label>
            <Input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="h-10 rounded-xl mt-1"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={isPending}
            className="sm:col-span-4 h-11 rounded-xl bg-[#A7653A] hover:bg-[#8D5132] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PackagePlus className="h-4 w-4" />
            )}
            Receive batch for {productName}
          </button>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="py-8 text-center text-sm font-bold text-[#746E73]">
          No batch records yet. Until you receive one, FEFO falls back to the
          product&apos;s plain stock count.
        </div>
      ) : (
        <ul className="divide-y divide-[#2E3344]/5 border border-[#2E3344]/10 rounded-2xl overflow-hidden">
          {batches.map((b) => {
            const expiry = b.expiry_date ? new Date(b.expiry_date) : null;
            const daysLeft = expiry
              ? Math.ceil(
                  (expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
                )
              : null;
            const expiringSoon =
              expiry && expiry.getTime() - today.getTime() < SEVEN_DAYS;
            const expired = expiry && expiry < today;
            const empty = b.remaining_qty <= 0;
            return (
              <li
                key={b.id}
                className="grid grid-cols-[1.2fr_1fr_1fr_1fr_36px] gap-3 items-center p-3 bg-white"
              >
                <div>
                  <p className="text-sm font-bold text-[#27324A]">
                    {b.batch_no || "—"}
                  </p>
                  <p className="text-[11px] text-[#746E73]">
                    received {fmtDate(b.received_at)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
                    Expiry
                  </p>
                  <p
                    className={`text-sm font-bold flex items-center gap-1 ${expired ? "text-red-600" : expiringSoon ? "text-amber-600" : "text-[#27324A]"}`}
                  >
                    <Calendar className="h-3 w-3" />
                    {fmtDate(b.expiry_date)}
                    {daysLeft !== null && !expired && daysLeft <= 30 && (
                      <span className="ml-1 text-[10px] font-bold">
                        ({daysLeft}d)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
                    Stock
                  </p>
                  <p className="text-sm font-bold text-[#27324A]">
                    {b.remaining_qty}{" "}
                    <span className="text-[11px] text-[#746E73]">
                      of {b.received_qty}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
                    Cost
                  </p>
                  <p className="text-sm font-bold text-[#27324A]">
                    Rs. {Number(b.cost_price).toFixed(2)}
                  </p>
                </div>
                <div>
                  {empty ? (
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="h-9 w-9 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center"
                      title="Delete empty batch"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
