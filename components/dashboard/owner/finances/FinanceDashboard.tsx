"use client";

import { useState, useTransition } from "react";
import { Banknote, ArrowUpRight, ArrowDownRight, ArrowRight, ReceiptText, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { addExpense } from "@/app/actions/owner";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  payment_method: string | null;
  created_at: string;
}

interface FinanceDashboardProps {
  shopId: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  recentTransactions: Transaction[];
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString("en-NP", { month: "short", day: "numeric" });
}

const TYPE_LABEL: Record<string, string> = {
  sale: "Sale",
  expense: "Expense",
  udhar_payment: "Udhar Collected",
  supplier_payment: "Supplier Payment",
};

export function FinanceDashboard({ shopId, monthlyIncome, monthlyExpenses, recentTransactions }: FinanceDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseMethod, setExpenseMethod] = useState("cash");
  const [localTransactions, setLocalTransactions] = useState(recentTransactions);

  const netProfit = monthlyIncome - monthlyExpenses;

  const handleAddExpense = () => {
    const formData = new FormData();
    formData.set("amount", expenseAmount);
    formData.set("description", expenseDesc);
    formData.set("payment_method", expenseMethod);
    startTransition(async () => {
      const result = await addExpense(shopId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Expense recorded.");
        setShowExpenseModal(false);
        setExpenseAmount("");
        setExpenseDesc("");
        window.location.reload();
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h1 className="text-2xl font-black text-[#27324A]">Finances</h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">Track income, expenses, and generate invoices.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#746E73]">
              Income (This Month)
            </span>
          </div>
          {monthlyIncome > 0 ? (
            <p className="text-3xl font-black text-[#27324A] mt-4">
              Rs. {monthlyIncome.toLocaleString()}
            </p>
          ) : (
            <p className="text-lg font-bold text-[#746E73] mt-4">No sales yet</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
              <ArrowDownRight className="h-5 w-5 text-red-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#746E73]">
              Expenses (This Month)
            </span>
          </div>
          <p className="text-3xl font-black text-[#27324A] mt-4">
            Rs. {monthlyExpenses.toLocaleString()}
          </p>
        </div>

        <div className={`p-6 rounded-[2rem] shadow-xl ${netProfit >= 0 ? "bg-[#27324A]" : "bg-red-700"} text-white`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-[#D8C99A]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#D8C99A]">Net Profit</span>
          </div>
          <p className="text-3xl font-black mt-4">
            {netProfit >= 0 ? "+" : ""}Rs. {netProfit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tools + Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-[#27324A]">Financial Tools</h2>
          <button className="w-full flex items-center justify-between p-4 rounded-xl border border-[#2E3344]/5 hover:bg-[#F7F0E6] hover:border-[#A7653A]/30 transition group opacity-60 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#E8E3D1]/50 flex items-center justify-center text-[#A7653A]">
                <FileText className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-[#27324A]">Create Custom Invoice</p>
                <p className="text-[10px] font-bold text-[#746E73] uppercase tracking-wider mt-0.5">Coming Soon</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowExpenseModal(true)}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-[#2E3344]/5 hover:bg-red-50 hover:border-red-200 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100/50 flex items-center justify-center text-red-600">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-[#27324A]">Record Expense</p>
                <p className="text-[10px] font-bold text-[#746E73] uppercase tracking-wider mt-0.5">
                  Rent, Electricity, Salary
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-red-600 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
          </button>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm">
          <h2 className="text-lg font-black text-[#27324A] mb-4">Recent Transactions</h2>
          {localTransactions.length === 0 ? (
            <div className="text-center py-8 text-[#746E73] font-medium text-sm">
              No transactions yet. Transactions from the POS will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {localTransactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between p-3 rounded-xl border border-[#2E3344]/5">
                  <div>
                    <p className="text-xs font-bold text-[#27324A]">{txn.description ?? TYPE_LABEL[txn.type] ?? txn.type}</p>
                    <p className="text-[10px] text-[#746E73] font-bold uppercase tracking-widest mt-0.5">
                      {timeAgo(txn.created_at)} • {txn.payment_method ?? "cash"}
                    </p>
                  </div>
                  <span className={`text-sm font-black ${["sale", "udhar_payment"].includes(txn.type) ? "text-green-600" : "text-red-600"}`}>
                    {["sale", "udhar_payment"].includes(txn.type) ? "+" : "−"}Rs. {txn.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-[#27324A]">Record Expense</h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-[#746E73] hover:text-[#27324A] p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="font-bold text-[#27324A]">Amount (Rs.) *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-12 rounded-xl mt-1.5"
                />
              </div>
              <div>
                <Label className="font-bold text-[#27324A]">Description *</Label>
                <Input
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="e.g. Electricity bill"
                  className="h-12 rounded-xl mt-1.5"
                />
              </div>
              <div>
                <Label className="font-bold text-[#27324A]">Payment Method</Label>
                <Select
                  value={expenseMethod}
                  onValueChange={(v) => setExpenseMethod(v)}
                >
                  <SelectTrigger className="w-full mt-1.5 h-12">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="online">Online (eSewa / Bank)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowExpenseModal(false)}
                className="flex-1 h-12 rounded-xl border-[#2E3344]/10 font-bold"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending || !expenseAmount || !expenseDesc}
                onClick={handleAddExpense}
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {isPending ? "Saving..." : "Record Expense"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
