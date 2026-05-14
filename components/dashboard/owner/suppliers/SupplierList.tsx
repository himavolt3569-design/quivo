"use client";

import { useState, useTransition } from "react";
import { Search, Plus, Truck, FileText, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { addSupplier, paySupplierDue } from "@/app/actions/owner";

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  balance_due: number;
  status: string;
  created_at: string;
}

interface SupplierListProps {
  shopId: string;
  initialSuppliers: Supplier[];
}

export function SupplierList({ shopId, initialSuppliers }: SupplierListProps) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", contact_person: "", category: "" });

  const totalDues = suppliers.reduce((acc, s) => acc + (s.balance_due ?? 0), 0);

  const filtered = suppliers.filter((s) =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone ?? "").includes(search)
  );

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
        setForm({ name: "", phone: "", email: "", contact_person: "", category: "" });
        window.location.reload();
      }
    });
  };

  const handlePay = (supplierId: string, supplierName: string) => {
    const amountStr = window.prompt(`Enter payment amount for ${supplierName} (Rs.):`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) { toast.error("Invalid amount"); return; }

    startTransition(async () => {
      const result = await paySupplierDue(supplierId, shopId, amount);
      if (result.error) {
        toast.error(result.error);
      } else {
        setSuppliers((prev) =>
          prev.map((s) =>
            s.id === supplierId
              ? { ...s, balance_due: Math.max(0, s.balance_due - amount) }
              : s
          )
        );
        toast.success("Payment recorded.");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-[#27324A]">Suppliers</h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">Manage distributors, pending dues, and purchases.</p>
        </div>

        <div className="flex items-center gap-4">
          {totalDues > 0 && (
            <div className="bg-red-50 text-red-900 border border-red-200 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-sm">
              <Truck className="h-6 w-6 text-red-600" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">Total Pending Dues</p>
                <p className="text-xl font-black text-red-700">Rs. {totalDues.toLocaleString()}</p>
              </div>
            </div>
          )}
          <Button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl h-12 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold px-6 shadow-sm hidden sm:flex"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Supplier
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#746E73]" />
        <Input
          placeholder="Search suppliers..."
          className="pl-9 h-11 rounded-xl bg-white border-[#2E3344]/8 shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Empty state */}
      {suppliers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center bg-white rounded-[2rem] border border-[#2E3344]/8">
          <div className="h-16 w-16 rounded-2xl bg-[#F7F0E6] flex items-center justify-center">
            <Truck className="h-8 w-8 text-[#A7653A]" />
          </div>
          <h3 className="text-lg font-black text-[#27324A]">No suppliers yet</h3>
          <p className="text-sm text-[#746E73] font-medium max-w-xs">
            Add your distributors and vendors to track dues and purchases.
          </p>
          <Button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl h-11 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold"
          >
            <Plus className="h-4 w-4 mr-2" /> Add First Supplier
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((supplier) => (
          <div
            key={supplier.id}
            className="bg-white p-5 rounded-[2rem] border border-[#2E3344]/8 shadow-sm group hover:border-[#A7653A]/30 transition"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center font-black text-lg shrink-0">
                {supplier.name[0].toUpperCase()}
              </div>
              <div>
                <h3 className="font-black text-[#27324A] text-base">{supplier.name}</h3>
                <p className="text-xs font-bold text-[#746E73]">{supplier.phone ?? supplier.email ?? "No contact"}</p>
              </div>
            </div>

            <div className="bg-[#f8f8f7] rounded-xl p-3 mb-4 border border-[#2E3344]/5 flex justify-between items-center">
              <span className="text-xs font-bold text-[#746E73]">Current Dues</span>
              <span className={`font-black ${supplier.balance_due > 0 ? "text-red-600" : "text-green-600"}`}>
                Rs. {(supplier.balance_due ?? 0).toLocaleString()}
              </span>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 h-10 rounded-xl bg-white border border-[#2E3344]/10 text-[#27324A] hover:bg-[#F7F0E6] text-xs font-bold shadow-none">
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Ledger
              </Button>
              {supplier.balance_due > 0 && (
                <Button
                  disabled={isPending}
                  onClick={() => handlePay(supplier.id, supplier.name)}
                  className="flex-1 h-10 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white text-xs font-bold"
                >
                  Pay Now
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {suppliers.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-[#746E73] font-medium">
          No suppliers match your search.
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-[#27324A]">Add Supplier</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[#746E73] hover:text-[#27324A] p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="font-bold text-[#27324A]">Supplier / Distributor Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. CG Foods Distributor"
                  className="h-12 rounded-xl mt-1.5"
                />
              </div>
              <div>
                <Label className="font-bold text-[#27324A]">Contact Person</Label>
                <Input
                  value={form.contact_person}
                  onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                  placeholder="Name of sales rep"
                  className="h-12 rounded-xl mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-bold text-[#27324A]">Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="98XXXXXXXX"
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">Category</Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Grocery"
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="flex-1 h-12 rounded-xl border-[#2E3344]/10 font-bold"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending || !form.name.trim()}
                onClick={handleAdd}
                className="flex-1 h-12 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold"
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
