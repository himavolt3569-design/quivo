"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  Building2,
  FilePlus2,
  Mail,
  MapPin,
  Phone,
  Printer,
  ReceiptText,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { recordSupplierLedgerEntry } from "@/app/actions/owner";

type PaymentMethod = "cash" | "card" | "online" | "udhar";
type LedgerEntryType =
  | "purchase"
  | "payment"
  | "credit_adjustment"
  | "debit_adjustment";

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string | null;
  logo_url: string | null;
  tax_id: string | null;
  notes: string | null;
  opening_balance: number;
  balance_due: number;
  created_at: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: "expense" | "supplier_payment";
  reference_id: string | null;
  description: string | null;
  payment_method: PaymentMethod | null;
  created_at: string;
}

interface SupplierLedgerViewProps {
  shopId: string;
  shopName: string;
  supplier: Supplier;
  transactions: Transaction[];
  generatedAt: string;
}

const entryTypeLabels: Record<LedgerEntryType, string> = {
  purchase: "Purchase / Bill",
  payment: "Payment",
  credit_adjustment: "Credit Adjustment",
  debit_adjustment: "Debit Adjustment",
};

const emptyEntryForm = {
  entry_type: "purchase" as LedgerEntryType,
  amount: "",
  description: "",
  payment_method: "cash" as PaymentMethod,
};

export function SupplierLedgerView({
  shopId,
  shopName,
  supplier,
  transactions,
  generatedAt,
}: SupplierLedgerViewProps) {
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [form, setForm] = useState(emptyEntryForm);
  const [isPending, startTransition] = useTransition();

  const ledger = useMemo(
    () => buildLedger(supplier, transactions),
    [supplier, transactions],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("entry_type", form.entry_type);
    formData.set("amount", form.amount);
    formData.set("description", form.description);
    formData.set("payment_method", form.payment_method);

    startTransition(async () => {
      const result = await recordSupplierLedgerEntry(
        supplier.id,
        shopId,
        formData,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Ledger entry recorded.");
      setShowEntryModal(false);
      setForm(emptyEntryForm);
      window.location.reload();
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Button
            asChild
            variant="ghost"
            className="h-9 rounded-xl px-2 font-bold text-[#746E73] hover:text-[#27324A]"
          >
            <Link href="/dashboard/owner/suppliers">
              <ArrowLeft className="mr-2 h-4 w-4" /> Suppliers
            </Link>
          </Button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#A7653A]">
              Supplier statement
            </p>
            <h1 className="text-2xl font-black text-[#27324A]">
              {supplier.name}
            </h1>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => setShowEntryModal(true)}
            className="h-11 rounded-xl bg-[#27324A] px-5 font-bold text-white hover:bg-[#1b2333]"
          >
            <FilePlus2 className="mr-2 h-4 w-4" /> Add Ledger Entry
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="h-11 rounded-xl border-[#2E3344]/10 bg-white px-5 font-bold text-[#27324A]"
          >
            <Printer className="mr-2 h-4 w-4" /> Print Statement
          </Button>
        </div>
      </div>

      <section className="printable-ledger rounded-[1.5rem] border border-[#2E3344]/8 bg-white shadow-sm">
        <div className="border-b border-[#2E3344]/8 p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 rounded-2xl border border-[#2E3344]/8 bg-[#F7F0E6]">
                {supplier.logo_url && (
                  <AvatarImage
                    src={supplier.logo_url}
                    alt={`${supplier.name} logo`}
                  />
                )}
                <AvatarFallback className="rounded-2xl bg-[#F7F0E6] text-xl font-black text-[#A7653A]">
                  {supplier.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#A7653A]">
                  {shopName}
                </p>
                <h2 className="text-xl font-black text-[#27324A]">
                  {supplier.name}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {supplier.category && (
                    <Badge className="rounded-lg bg-[#F7F0E6] text-[#A7653A] shadow-none">
                      {supplier.category}
                    </Badge>
                  )}
                  {supplier.tax_id && (
                    <Badge className="rounded-lg bg-[#27324A]/5 text-[#27324A] shadow-none">
                      PAN {supplier.tax_id}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#27324A] px-5 py-4 text-white sm:text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#D8C99A]">
                Current Payable
              </p>
              <p className="text-2xl font-black">
                Rs. {ledger.currentBalance.toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-bold text-white/70">
                Generated {formatDateTime(generatedAt)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm md:grid-cols-4">
            <InfoCell
              icon={Phone}
              label="Phone"
              value={supplier.phone || "Not added"}
            />
            <InfoCell
              icon={Mail}
              label="Email"
              value={supplier.email || "Not added"}
            />
            <InfoCell
              icon={MapPin}
              label="Address"
              value={supplier.address || "Not added"}
            />
            <InfoCell
              icon={Building2}
              label="Contact"
              value={supplier.contact_person || "Not added"}
            />
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryBox
            label="Opening / Brought Forward"
            value={ledger.openingBalance}
            tone="neutral"
          />
          <SummaryBox
            label="Bills & Credits"
            value={ledger.totalCredits}
            tone="credit"
          />
          <SummaryBox
            label="Payments & Debits"
            value={ledger.totalDebits}
            tone="debit"
          />
          <SummaryBox
            label="Closing Balance"
            value={ledger.currentBalance}
            tone={ledger.currentBalance > 0 ? "credit" : "debit"}
          />
        </div>

        <div className="overflow-x-auto border-t border-[#2E3344]/8">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#F7F0E6]/60 text-[10px] font-black uppercase tracking-widest text-[#746E73]">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Particulars</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3 text-right">Debit</th>
                <th className="px-5 py-3 text-right">Credit</th>
                <th className="px-5 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2E3344]/5">
              {ledger.rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-5 py-4 font-bold text-[#746E73]">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-black text-[#27324A]">{row.title}</p>
                    {row.description && (
                      <p className="mt-0.5 text-xs font-medium text-[#746E73]">
                        {row.description}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 font-bold capitalize text-[#746E73]">
                    {row.method}
                  </td>
                  <td className="px-5 py-4 text-right font-black text-green-700">
                    {row.debit > 0 ? `Rs. ${row.debit.toLocaleString()}` : "-"}
                  </td>
                  <td className="px-5 py-4 text-right font-black text-red-700">
                    {row.credit > 0
                      ? `Rs. ${row.credit.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-5 py-4 text-right font-black text-[#27324A]">
                    Rs. {row.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ledger.rows.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <ReceiptText className="h-10 w-10 text-[#A7653A]" />
            <p className="font-black text-[#27324A]">No ledger entries yet</p>
            <p className="max-w-md text-sm font-medium text-[#746E73]">
              Add supplier purchases or payments to build a printable running
              statement.
            </p>
          </div>
        )}

        <div className="hidden grid-cols-3 gap-8 border-t border-[#2E3344]/8 p-8 text-xs font-bold text-[#746E73] print:grid">
          <SignatureLine label="Prepared By" />
          <SignatureLine label="Checked By" />
          <SignatureLine label="Supplier Signature" />
        </div>
      </section>

      {showEntryModal && (
        <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A7653A]">
                  Ledger entry
                </p>
                <h2 className="text-lg font-black text-[#27324A]">
                  Record Supplier Activity
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEntryModal(false)}
                className="rounded-lg p-1 text-[#746E73] hover:text-[#27324A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block font-bold text-[#27324A]">
                  Entry Type
                </Label>
                <select
                  value={form.entry_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      entry_type: e.target.value as LedgerEntryType,
                    }))
                  }
                  className="h-12 w-full rounded-xl border border-[#2E3344]/10 bg-white px-3 text-sm font-bold text-[#27324A] outline-none focus:ring-2 focus:ring-[#A7653A]/20"
                >
                  {Object.entries(entryTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block font-bold text-[#27324A]">
                    Amount *
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    placeholder="0"
                    className="h-12 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block font-bold text-[#27324A]">
                    Payment Method
                  </Label>
                  <select
                    value={form.payment_method}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        payment_method: e.target.value as PaymentMethod,
                      }))
                    }
                    className="h-12 w-full rounded-xl border border-[#2E3344]/10 bg-white px-3 text-sm font-bold capitalize text-[#27324A] outline-none focus:ring-2 focus:ring-[#A7653A]/20"
                    disabled={
                      form.entry_type === "purchase" ||
                      form.entry_type === "credit_adjustment"
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                    <option value="udhar">Udhar</option>
                  </select>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block font-bold text-[#27324A]">
                  Particulars / Reference
                </Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Invoice number, payment reference, return note..."
                  className="min-h-24 rounded-xl"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEntryModal(false)}
                className="h-12 flex-1 rounded-xl border-[#2E3344]/10 font-bold"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending || !form.amount}
                className="h-12 flex-1 rounded-xl bg-[#27324A] font-bold text-white hover:bg-[#1b2333]"
              >
                {isPending ? "Saving..." : "Record Entry"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function buildLedger(supplier: Supplier, transactions: Transaction[]) {
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const transactionNet = sorted.reduce((acc, tx) => {
    const amount = Number(tx.amount ?? 0);
    return tx.type === "supplier_payment" ? acc - amount : acc + amount;
  }, 0);
  const storedOpening = Number(supplier.opening_balance ?? 0);
  const currentBalance = Number(supplier.balance_due ?? 0);
  const openingBalance =
    storedOpening + (currentBalance - (storedOpening + transactionNet));

  let runningBalance = openingBalance;
  const rows = [];
  if (openingBalance !== 0) {
    rows.push({
      id: "opening",
      date: supplier.created_at,
      title: "Opening / brought forward",
      description: "Starting payable balance for this supplier.",
      method: "-",
      debit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
      credit: openingBalance > 0 ? openingBalance : 0,
      balance: runningBalance,
    });
  }

  for (const tx of sorted) {
    const amount = Number(tx.amount ?? 0);
    const isDebit = tx.type === "supplier_payment";
    runningBalance = isDebit
      ? Math.max(0, runningBalance - amount)
      : runningBalance + amount;
    rows.push({
      id: tx.id,
      date: tx.created_at,
      title: isDebit ? "Supplier payment / debit" : "Supplier bill / credit",
      description: tx.description,
      method: tx.payment_method ?? "-",
      debit: isDebit ? amount : 0,
      credit: isDebit ? 0 : amount,
      balance: runningBalance,
    });
  }

  const transactionRows = rows.filter((row) => row.id !== "opening");
  const totalCredits = transactionRows.reduce(
    (acc, row) => acc + row.credit,
    0,
  );
  const totalDebits = transactionRows.reduce((acc, row) => acc + row.debit, 0);

  return {
    rows,
    openingBalance,
    totalCredits,
    totalDebits,
    currentBalance,
  };
}

function InfoCell({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f8f8f7] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#746E73]">
        <Icon className="h-3.5 w-3.5 text-[#A7653A]" />
        {label}
      </div>
      <p className="break-words text-xs font-bold text-[#27324A]">{value}</p>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "credit" | "debit";
}) {
  const color =
    tone === "credit"
      ? "text-red-700"
      : tone === "debit"
        ? "text-green-700"
        : "text-[#27324A]";
  return (
    <div className="rounded-2xl border border-[#2E3344]/8 bg-[#f8f8f7] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">
        {label}
      </p>
      <p className={`mt-1 text-lg font-black ${color}`}>
        Rs. {value.toLocaleString()}
      </p>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="pt-10">
      <div className="border-t border-[#2E3344]/40 pt-2">{label}</div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NP", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NP", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
