"use client";

import { useState, useTransition } from "react";
import {
  Search,
  UserPlus,
  MessageCircle,
  WalletCards,
  MoreVertical,
  AlertTriangle,
  Users,
  X,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { PhoneInput, EmailInput } from "@/components/ui/validated-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  addShopCustomer,
  settleUdhar,
  deleteShopCustomer,
} from "@/app/actions/owner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  total_spent: number;
  order_count: number;
  udhar_balance: number;
  created_at: string;
  updated_at: string;
}

interface CustomerListProps {
  shopId: string;
  initialCustomers: Customer[];
}

export function CustomerList({ shopId, initialCustomers }: CustomerListProps) {
  const [search, setSearch] = useState("");
  const [udharOnly, setUdharOnly] = useState(false);
  const [customers, setCustomers] = useState(initialCustomers);
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");

  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null,
  );
  const [customerToSettle, setCustomerToSettle] = useState<Customer | null>(
    null,
  );
  const [settleAmount, setSettleAmount] = useState("");

  const totalUdhar = customers.reduce(
    (acc, c) => acc + (c.udhar_balance ?? 0),
    0,
  );

  const filtered = customers.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search);
    const matchesFilter = !udharOnly || c.udhar_balance > 0;
    return matchesSearch && matchesFilter;
  });

  const handleAddCustomer = () => {
    const formData = new FormData();
    formData.set("name", addName);
    formData.set("phone", addPhone);
    formData.set("email", addEmail);
    startTransition(async () => {
      const result = await addShopCustomer(shopId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Customer added.");
        setShowAddModal(false);
        setAddName("");
        setAddPhone("");
        setAddEmail("");
        window.location.reload();
      }
    });
  };

  const handleSettle = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setCustomerToSettle(customer);
      setSettleAmount(customer.udhar_balance.toString());
    }
  };

  const confirmSettle = () => {
    if (!customerToSettle) return;
    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }

    startTransition(async () => {
      const result = await settleUdhar(customerToSettle.id, shopId, amount);
      if (result.error) {
        toast.error(result.error);
      } else {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customerToSettle.id
              ? { ...c, udhar_balance: Math.max(0, c.udhar_balance - amount) }
              : c,
          ),
        );
        toast.success("Udhar settled successfully.");
        setCustomerToSettle(null);
      }
    });
  };

  const handleDelete = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setCustomerToDelete(customer);
    }
  };

  const confirmDelete = () => {
    if (!customerToDelete) return;

    startTransition(async () => {
      const result = await deleteShopCustomer(customerToDelete.id, shopId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Customer deleted successfully.");
        setCustomers((prev) =>
          prev.filter((c) => c.id !== customerToDelete.id),
        );
        setCustomerToDelete(null);
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header & Quick Stats */}
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-[#27324A]">
            Customers & Udhar
          </h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">
            Manage store credit and customer relationships.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {totalUdhar > 0 && (
            <div className="bg-[#27324A] text-white px-6 py-3 rounded-2xl flex items-center gap-4 shadow-md">
              <WalletCards className="h-6 w-6 text-[#D8C99A]" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#D8C99A]">
                  Total Udhar in Market
                </p>
                <p className="text-xl font-black">
                  Rs. {totalUdhar.toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <Button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl h-12 bg-[#A7653A] hover:bg-[#8D5132] text-white font-bold px-6 shadow-sm hidden sm:flex"
          >
            <UserPlus className="h-4 w-4 mr-2" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#746E73]" />
          <Input
            placeholder="Search by name or phone..."
            className="pl-9 h-11 rounded-xl bg-[#f8f8f7] border-transparent focus-visible:ring-[#A7653A]/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setUdharOnly(false)}
            className={`rounded-xl h-11 border-[#2E3344]/10 font-bold flex-1 sm:flex-none ${!udharOnly ? "bg-[#27324A] text-white border-[#27324A]" : "text-[#27324A]"}`}
          >
            All
          </Button>
          <Button
            variant="outline"
            onClick={() => setUdharOnly(true)}
            className={`rounded-xl h-11 font-bold flex-1 sm:flex-none ${udharOnly ? "bg-[#A7653A] text-white border-[#A7653A]" : "border-[#A7653A]/30 bg-[#F7F0E6]/50 text-[#A7653A]"}`}
          >
            Udhar Only
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {customers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center bg-white rounded-[2rem] border border-[#2E3344]/8">
          <div className="h-16 w-16 rounded-2xl bg-[#F7F0E6] flex items-center justify-center">
            <Users className="h-8 w-8 text-[#A7653A]" />
          </div>
          <h3 className="text-lg font-black text-[#27324A]">
            No customers yet
          </h3>
          <p className="text-sm text-[#746E73] font-medium max-w-xs">
            Add customers to track Udhar balances and purchase history.
          </p>
          <Button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl h-11 bg-[#A7653A] hover:bg-[#8D5132] text-white font-bold"
          >
            <UserPlus className="h-4 w-4 mr-2" /> Add First Customer
          </Button>
        </div>
      )}

      {/* Desktop Table */}
      {filtered.length > 0 && (
        <div className="hidden md:block bg-white rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#F7F0E6]/50 border-b border-[#2E3344]/8 text-[#746E73] font-bold uppercase tracking-widest text-[10px]">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Lifetime Value</th>
                <th className="px-6 py-4">Udhar Balance</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2E3344]/5">
              {filtered.map((customer) => (
                <tr
                  key={customer.id}
                  className="hover:bg-[#f8f8f7]/50 transition"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#E8E3D1]/50 flex items-center justify-center font-black text-[#A7653A]">
                        {customer.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-[#27324A]">
                          {customer.name}
                        </p>
                        <p className="text-[10px] font-bold text-[#746E73]">
                          {customer.order_count} order
                          {customer.order_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-[#746E73]">
                    {customer.phone ?? "—"}
                  </td>
                  <td className="px-6 py-4 font-bold text-[#27324A]">
                    Rs. {(customer.total_spent ?? 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {customer.udhar_balance > 0 ? (
                      <span className="font-black text-orange-600 flex items-center gap-1">
                        Rs. {customer.udhar_balance.toLocaleString()}
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                      </span>
                    ) : (
                      <span className="font-bold text-green-600">Cleared</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {customer.udhar_balance > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleSettle(customer.id)}
                          className="h-8 rounded-lg border-green-200 text-green-700 bg-green-50 hover:bg-green-100 font-bold text-xs"
                        >
                          Settle
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#746E73] hover:text-[#27324A] rounded-full"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              navigator.clipboard.writeText(
                                customer.phone ?? "",
                              );
                              toast.success("Phone copied to clipboard");
                            }}
                          >
                            <MessageCircle className="mr-2 h-4 w-4" />{" "}
                            Message/Contact
                          </DropdownMenuItem>
                          {customer.udhar_balance === 0 && (
                            <>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleDelete(customer.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                Customer
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filtered.map((customer) => (
            <div
              key={customer.id}
              className="bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#E8E3D1]/50 flex items-center justify-center font-black text-[#A7653A]">
                    {customer.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-[#27324A]">{customer.name}</p>
                    <p className="text-xs text-[#746E73]">
                      {customer.phone ?? "No phone"}
                    </p>
                  </div>
                </div>
                {customer.udhar_balance > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-orange-600 font-bold">Udhar</p>
                    <p className="font-black text-orange-600">
                      Rs. {customer.udhar_balance}
                    </p>
                  </div>
                )}
              </div>
              {customer.udhar_balance > 0 && (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleSettle(customer.id)}
                  className="mt-3 w-full h-9 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs"
                >
                  Settle Udhar
                </Button>
              )}
              {customer.udhar_balance === 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleDelete(customer.id)}
                  className="mt-3 w-full h-9 rounded-xl border-red-200 text-red-600 bg-red-50 hover:bg-red-100 font-bold text-xs"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Customer
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {customers.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-[#746E73] font-medium">
          No customers match your search.
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-[#27324A]">
                Add Customer
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#746E73] hover:text-[#27324A] p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="font-bold text-[#27324A]">Name *</Label>
                <Input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Customer name"
                  className="h-12 rounded-xl mt-1.5"
                />
              </div>
              <div>
                <Label className="font-bold text-[#27324A]">Phone</Label>
                <PhoneInput
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="98XXXXXXXX"
                  className="h-12 rounded-xl mt-1.5"
                />
              </div>
              <div>
                <Label className="font-bold text-[#27324A]">
                  Email (optional)
                </Label>
                <EmailInput
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="h-12 rounded-xl mt-1.5"
                />
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
                disabled={isPending || !addName.trim()}
                onClick={handleAddCustomer}
                className="flex-1 h-12 rounded-xl bg-[#A7653A] hover:bg-[#8D5132] text-white font-bold"
              >
                {isPending ? "Saving..." : "Add Customer"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <AlertDialog
        open={!!customerToDelete}
        onOpenChange={(o) => !o && setCustomerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-bold text-[#27324A] dark:text-white">
                {customerToDelete?.name}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settle Udhar Modal */}
      <Dialog
        open={!!customerToSettle}
        onOpenChange={(o) => !o && setCustomerToSettle(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Udhar</DialogTitle>
            <DialogDescription>
              Enter the amount to settle for{" "}
              <span className="font-bold text-[#27324A] dark:text-white">
                {customerToSettle?.name}
              </span>
              . (Current balance: Rs. {customerToSettle?.udhar_balance})
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="font-bold text-[#27324A] dark:text-white">
              Amount (Rs.)
            </Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              className="mt-2"
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCustomerToSettle(null)}
              className="h-12 rounded-xl border-[#2E3344]/10 dark:border-white/10 font-bold hover:bg-[#F7F0E6] dark:hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSettle}
              disabled={
                isPending || !settleAmount || parseFloat(settleAmount) <= 0
              }
              className="h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              {isPending ? "Settling..." : "Settle Amount"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
