"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, Ticket, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import {
  createPromoCode,
  deletePromoCode,
  togglePromoActive,
  type PromoRow,
} from "@/app/actions/promo";

interface Props {
  shopId: string;
  initialRows: PromoRow[];
}

export function PromoCodesView({ shopId, initialRows }: Props) {
  const [rows, setRows] = useState<PromoRow[]>(initialRows);
  const [form, setForm] = useState({
    code: "",
    kind: "percent" as "percent" | "flat",
    value: "10",
    minSubtotal: "0",
    maxDiscount: "",
    maxUses: "",
    validFrom: "",
    validTo: "",
  });
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const res = await createPromoCode({
        shopId,
        code: form.code.trim(),
        kind: form.kind,
        value: Number(form.value),
        minSubtotal: Number(form.minSubtotal || 0),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        validFrom: form.validFrom
          ? new Date(form.validFrom).toISOString()
          : null,
        validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
        active: true,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Created");
      setForm((f) => ({
        ...f,
        code: "",
        value: "10",
        minSubtotal: "0",
        maxDiscount: "",
        maxUses: "",
        validFrom: "",
        validTo: "",
      }));
      // Optimistically add a placeholder; on next nav the list refetches.
      setRows((cur) => [
        {
          id: res.id!,
          code: form.code.trim().toUpperCase(),
          kind: form.kind,
          value: Number(form.value),
          min_subtotal: Number(form.minSubtotal || 0),
          max_discount: form.maxDiscount ? Number(form.maxDiscount) : null,
          max_uses: form.maxUses ? Number(form.maxUses) : null,
          used_count: 0,
          valid_from: form.validFrom
            ? new Date(form.validFrom).toISOString()
            : null,
          valid_to: form.validTo ? new Date(form.validTo).toISOString() : null,
          active: true,
          created_at: new Date().toISOString(),
        },
        ...cur,
      ]);
    });
  };

  const toggle = (id: string, next: boolean) =>
    startTransition(async () => {
      const res = await togglePromoActive(id, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setRows((cur) =>
        cur.map((r) => (r.id === id ? { ...r, active: next } : r)),
      );
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const res = await deletePromoCode(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setRows((cur) => cur.filter((r) => r.id !== id));
    });

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <Link
          href="/dashboard/owner/payments"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2"
        >
          <ChevronLeft className="h-3 w-3" /> Back to Payments
        </Link>
        <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
          <Ticket className="h-6 w-6 text-[#A7653A]" /> Promo codes
        </h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">
          Create discount codes customers can enter at checkout.
        </p>
      </div>

      <section className="rounded-2xl bg-white border border-[#2E3344]/10 p-4 space-y-3">
        <h2 className="text-sm font-black text-[#27324A]">Create a code</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Code" hint="e.g. WELCOME10">
            <input
              value={form.code}
              onChange={(e) =>
                setForm({
                  ...form,
                  code: e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9_-]/g, ""),
                })
              }
              className="w-full h-10 rounded-xl border border-black/10 px-3 text-sm font-bold tracking-wide"
              placeholder="WELCOME10"
              maxLength={40}
            />
          </Field>
          <Field label="Type">
            <div className="flex h-10 rounded-xl overflow-hidden border border-black/10">
              {(["percent", "flat"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, kind: k })}
                  className={`flex-1 text-xs font-bold capitalize ${form.kind === k ? "bg-[#27324A] text-white" : "bg-white text-[#27324A]"}`}
                >
                  {k === "percent" ? "% off" : "Flat Rs."}
                </button>
              ))}
            </div>
          </Field>
          <Field
            label={
              form.kind === "percent" ? "Percent off" : "Flat amount (Rs.)"
            }
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-full h-10 rounded-xl border border-black/10 px-3 text-sm"
            />
          </Field>
          <Field label="Min. subtotal (Rs.)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.minSubtotal}
              onChange={(e) =>
                setForm({ ...form, minSubtotal: e.target.value })
              }
              className="w-full h-10 rounded-xl border border-black/10 px-3 text-sm"
            />
          </Field>
          {form.kind === "percent" && (
            <Field label="Max discount cap (optional)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.maxDiscount}
                onChange={(e) =>
                  setForm({ ...form, maxDiscount: e.target.value })
                }
                placeholder="e.g. 500"
                className="w-full h-10 rounded-xl border border-black/10 px-3 text-sm"
              />
            </Field>
          )}
          <Field label="Max uses (optional)">
            <input
              type="number"
              min="1"
              step="1"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              placeholder="∞"
              className="w-full h-10 rounded-xl border border-black/10 px-3 text-sm"
            />
          </Field>
          <Field label="Valid from (optional)">
            <input
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              className="w-full h-10 rounded-xl border border-black/10 px-3 text-sm"
            />
          </Field>
          <Field label="Valid until (optional)">
            <input
              type="datetime-local"
              value={form.validTo}
              onChange={(e) => setForm({ ...form, validTo: e.target.value })}
              className="w-full h-10 rounded-xl border border-black/10 px-3 text-sm"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !form.code || !form.value}
            className="h-10 px-4 rounded-xl bg-[#27324A] text-white text-xs font-bold inline-flex items-center gap-2 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Create code
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-[#2E3344]/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-black/5">
          <h2 className="text-sm font-black text-[#27324A]">All codes</h2>
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm font-bold text-[#746E73] inline-flex items-center gap-2 justify-center w-full">
            <AlertCircle className="h-3.5 w-3.5" /> No promo codes yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F7F0E6] text-[10px] uppercase tracking-wider text-[#746E73]">
              <tr>
                <th className="text-left px-4 py-2">Code</th>
                <th className="text-left px-4 py-2">Discount</th>
                <th className="text-left px-4 py-2">Min</th>
                <th className="text-left px-4 py-2">Uses</th>
                <th className="text-left px-4 py-2">Window</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-mono font-black text-[#27324A]">
                    {r.code}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-[#27324A]">
                    {r.kind === "percent"
                      ? `${r.value}% off${r.max_discount ? ` (max Rs. ${r.max_discount})` : ""}`
                      : `Rs. ${r.value} off`}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.min_subtotal > 0 ? `Rs. ${r.min_subtotal}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.used_count}
                    {r.max_uses ? ` / ${r.max_uses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.valid_from || r.valid_to ? (
                      <>
                        {r.valid_from
                          ? new Date(r.valid_from).toLocaleDateString()
                          : "—"}{" "}
                        →{" "}
                        {r.valid_to
                          ? new Date(r.valid_to).toLocaleDateString()
                          : "—"}
                      </>
                    ) : (
                      "Always"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => toggle(r.id, !r.active)}
                        disabled={isPending}
                        className={`h-8 px-3 rounded-xl text-xs font-bold ${r.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}
                      >
                        {r.active ? "Active" : "Paused"}
                      </button>
                      <button
                        onClick={() => remove(r.id)}
                        disabled={isPending}
                        className="h-8 w-8 rounded-xl bg-white border border-red-200 text-red-700 flex items-center justify-center"
                        aria-label="Delete code"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black uppercase tracking-wider text-[#746E73] mb-1">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[10px] text-[#746E73] mt-0.5">{hint}</span>
      )}
    </label>
  );
}
