"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  ArrowUpRight,
  Building2,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Truck,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput, EmailInput } from "@/components/ui/validated-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { addSupplier, paySupplierDue } from "@/app/actions/owner";

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
  status: string;
  created_at: string;
}

interface SupplierListProps {
  shopId: string;
  initialSuppliers: Supplier[];
}

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  contact_person: "",
  category: "",
  logo_url: "",
  address: "",
  tax_id: "",
  notes: "",
  opening_balance: "",
};

export function SupplierList({ shopId, initialSuppliers }: SupplierListProps) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const totalDues = suppliers.reduce((acc, s) => acc + Number(s.balance_due ?? 0), 0);
  const suppliersWithDues = suppliers.filter((s) => Number(s.balance_due ?? 0) > 0).length;

  const filtered = suppliers.filter((s) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      s.name.toLowerCase().includes(term) ||
      (s.contact_person ?? "").toLowerCase().includes(term) ||
      (s.category ?? "").toLowerCase().includes(term) ||
      (s.phone ?? "").includes(term) ||
      (s.email ?? "").toLowerCase().includes(term)
    );
  });

  const handleAdd = () => {
    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.set(k, v));
    startTransition(async () => {
      const result = await addSupplier(shopId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Supplier added.");
        setShowAddModal(false);
        setForm(emptyForm);
        window.location.reload();
      }
    });
  };

  const handlePay = (supplierId: string, supplierName: string) => {
    const amountStr = window.prompt(`Enter payment amount for ${supplierName} (Rs.):`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }

    startTransition(async () => {
      const result = await paySupplierDue(supplierId, shopId, amount);
      if (result.error) {
        toast.error(result.error);
      } else {
        setSuppliers((prev) =>
          prev.map((s) =>
            s.id === supplierId
              ? { ...s, balance_due: Math.max(0, Number(s.balance_due ?? 0) - amount) }
              : s
          )
        );
        toast.success("Payment recorded.");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#A7653A]">Payables ledger</p>
          <h1 className="text-2xl font-black text-[#27324A]">Suppliers</h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">
            Manage distributors, supplier profiles, purchases, payments, and printable ledgers.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
          <div className="rounded-2xl border border-[#2E3344]/8 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">Open Suppliers</p>
            <p className="text-xl font-black text-[#27324A]">{suppliersWithDues}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Total Payable</p>
            <p className="text-xl font-black text-red-700">Rs. {totalDues.toLocaleString()}</p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="col-span-2 h-12 rounded-xl bg-[#27324A] px-6 font-bold text-white shadow-sm hover:bg-[#1b2333] sm:col-span-1"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Supplier
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[#2E3344]/8 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#746E73]" />
          <Input
            placeholder="Search by supplier, contact, category, phone, or email..."
            className="h-11 rounded-xl border-transparent bg-[#f8f8f7] pl-9 focus-visible:ring-[#A7653A]/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <p className="text-xs font-bold text-[#746E73]">
          {filtered.length} of {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}
        </p>
      </div>

      {suppliers.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[2rem] border border-[#2E3344]/8 bg-white py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F7F0E6]">
            <Truck className="h-8 w-8 text-[#A7653A]" />
          </div>
          <h3 className="text-lg font-black text-[#27324A]">No suppliers yet</h3>
          <p className="max-w-sm text-sm font-medium text-[#746E73]">
            Add supplier details once, then use the ledger page to record bills, payments, and print statements.
          </p>
          <Button
            onClick={() => setShowAddModal(true)}
            className="h-11 rounded-xl bg-[#27324A] font-bold text-white hover:bg-[#1b2333]"
          >
            <Plus className="mr-2 h-4 w-4" /> Add First Supplier
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((supplier) => {
          const balance = Number(supplier.balance_due ?? 0);
          return (
            <div
              key={supplier.id}
              className="rounded-[1.5rem] border border-[#2E3344]/8 bg-white p-5 shadow-sm transition hover:border-[#A7653A]/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-14 w-14 rounded-2xl border border-[#2E3344]/8 bg-[#F7F0E6]">
                    {supplier.logo_url && <AvatarImage src={supplier.logo_url} alt={`${supplier.name} logo`} />}
                    <AvatarFallback className="rounded-2xl bg-[#F7F0E6] text-lg font-black text-[#A7653A]">
                      {supplier.name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-black text-[#27324A]">{supplier.name}</h3>
                    <p className="truncate text-xs font-bold text-[#746E73]">
                      {supplier.contact_person || supplier.category || "Supplier account"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {supplier.category && (
                        <Badge className="rounded-lg bg-[#F7F0E6] text-[#A7653A] shadow-none hover:bg-[#F7F0E6]">
                          {supplier.category}
                        </Badge>
                      )}
                      {supplier.tax_id && (
                        <Badge className="rounded-lg bg-[#27324A]/5 text-[#27324A] shadow-none hover:bg-[#27324A]/5">
                          PAN {supplier.tax_id}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73]">Current Payable</p>
                  <p className={balance > 0 ? "text-lg font-black text-red-600" : "text-lg font-black text-green-600"}>
                    Rs. {balance.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                <ContactLine icon={Phone} text={supplier.phone} fallback="No phone" />
                <ContactLine icon={Mail} text={supplier.email} fallback="No email" />
                <ContactLine icon={MapPin} text={supplier.address} fallback="No address" />
                <ContactLine icon={Building2} text={`Opening Rs. ${Number(supplier.opening_balance ?? 0).toLocaleString()}`} />
              </div>

              {supplier.notes && (
                <p className="mt-4 rounded-xl bg-[#f8f8f7] px-3 py-2 text-xs font-medium text-[#746E73]">
                  {supplier.notes}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  asChild
                  className="h-10 flex-1 rounded-xl border border-[#2E3344]/10 bg-white text-xs font-bold text-[#27324A] shadow-none hover:bg-[#F7F0E6]"
                >
                  <Link href={`/dashboard/owner/suppliers/${supplier.id}`}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" /> Ledger
                    <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
                {balance > 0 && (
                  <Button
                    disabled={isPending}
                    onClick={() => handlePay(supplier.id, supplier.name)}
                    className="h-10 flex-1 rounded-xl bg-[#27324A] text-xs font-bold text-white hover:bg-[#1b2333]"
                  >
                    Pay Now
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {suppliers.length > 0 && filtered.length === 0 && (
        <div className="py-12 text-center font-medium text-[#746E73]">No suppliers match your search.</div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A7653A]">Supplier profile</p>
                <h2 className="text-lg font-black text-[#27324A]">Add Supplier</h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="rounded-lg p-1 text-[#746E73] hover:text-[#27324A]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Supplier / Distributor Name *">
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. CG Foods Distributor"
                  className="h-12 rounded-xl"
                />
              </Field>
              <Field label="Logo URL">
                <Input
                  value={form.logo_url}
                  onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://..."
                  className="h-12 rounded-xl"
                />
              </Field>
              <Field label="Contact Person">
                <Input
                  value={form.contact_person}
                  onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                  placeholder="Name of sales rep"
                  className="h-12 rounded-xl"
                />
              </Field>
              <Field label="Category">
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Grocery, dairy, packaging..."
                  className="h-12 rounded-xl"
                />
              </Field>
              <Field label="Phone Number">
                <PhoneInput
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="98XXXXXXXX"
                  className="h-12 rounded-xl"
                />
              </Field>
              <Field label="Email">
                <EmailInput
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="supplier@example.com"
                  className="h-12 rounded-xl"
                />
              </Field>
              <Field label="PAN / Tax ID">
                <Input
                  value={form.tax_id}
                  onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))}
                  placeholder="Optional"
                  className="h-12 rounded-xl"
                />
              </Field>
              <Field label="Opening Payable">
                <Input
                  type="number"
                  min="0"
                  value={form.opening_balance}
                  onChange={(e) => setForm((f) => ({ ...f, opening_balance: e.target.value }))}
                  placeholder="0"
                  className="h-12 rounded-xl"
                />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Billing or warehouse address"
                  className="min-h-20 rounded-xl"
                />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Credit terms, delivery schedule, account manager details..."
                  className="min-h-20 rounded-xl"
                />
              </Field>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="h-12 flex-1 rounded-xl border-[#2E3344]/10 font-bold"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending || !form.name.trim()}
                onClick={handleAdd}
                className="h-12 flex-1 rounded-xl bg-[#27324A] font-bold text-white hover:bg-[#1b2333]"
              >
                {isPending ? "Saving..." : "Add Supplier"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block font-bold text-[#27324A]">{label}</Label>
      {children}
    </div>
  );
}

function ContactLine({
  icon: Icon,
  text,
  fallback,
}: {
  icon: ComponentType<{ className?: string }>;
  text?: string | null;
  fallback?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-[#f8f8f7] px-3 py-2 text-xs font-bold text-[#746E73]">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#A7653A]" />
      <span className="truncate">{text || fallback}</span>
    </div>
  );
}
