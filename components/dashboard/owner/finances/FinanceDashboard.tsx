"use client";

import { Banknote, CreditCard, ReceiptText, FileText, ArrowUpRight, ArrowDownRight, ArrowRight } from "lucide-react";

export function FinanceDashboard() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      <div>
        <h1 className="text-2xl font-black text-[#27324A]">Finances</h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">Track income, expenses, and generate invoices.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm">
           <div className="flex items-center gap-3 mb-2">
             <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
               <ArrowUpRight className="h-5 w-5 text-green-600" />
             </div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-[#746E73]">Total Income (Mo)</span>
           </div>
           <p className="text-3xl font-black text-[#27324A] mt-4">Rs. 2,45,000</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm">
           <div className="flex items-center gap-3 mb-2">
             <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
               <ArrowDownRight className="h-5 w-5 text-red-600" />
             </div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-[#746E73]">Total Expenses (Mo)</span>
           </div>
           <p className="text-3xl font-black text-[#27324A] mt-4">Rs. 85,000</p>
        </div>
        <div className="bg-[#27324A] text-white p-6 rounded-[2rem] shadow-xl">
           <div className="flex items-center gap-3 mb-2">
             <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
               <Banknote className="h-5 w-5 text-[#D8C99A]" />
             </div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-[#D8C99A]">Net Profit</span>
           </div>
           <p className="text-3xl font-black mt-4">Rs. 1,60,000</p>
        </div>
      </div>

      {/* Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-[#27324A]">Financial Tools</h2>
          <button className="w-full flex items-center justify-between p-4 rounded-xl border border-[#2E3344]/5 hover:bg-[#F7F0E6] hover:border-[#A7653A]/30 transition group">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#E8E3D1]/50 flex items-center justify-center text-[#A7653A]">
                <FileText className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-[#27324A]">Create Custom Invoice</p>
                <p className="text-[10px] font-bold text-[#746E73] uppercase tracking-wider mt-0.5">For B2B or Bulk Sales</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[#A7653A] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
          </button>
          
          <button className="w-full flex items-center justify-between p-4 rounded-xl border border-[#2E3344]/5 hover:bg-red-50 hover:border-red-200 transition group">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100/50 flex items-center justify-center text-red-600">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-[#27324A]">Record Expense</p>
                <p className="text-[10px] font-bold text-[#746E73] uppercase tracking-wider mt-0.5">Rent, Electricity, Salary</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-red-600 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
          </button>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 p-6 shadow-sm">
          <h2 className="text-lg font-black text-[#27324A] mb-4">Recent Transactions</h2>
          <div className="space-y-3">
             {[
               { id: "TXN-091", desc: "Cash Sale", amount: "+ Rs. 1,250", type: "income" },
               { id: "TXN-090", desc: "Electricity Bill", amount: "- Rs. 4,500", type: "expense" },
               { id: "TXN-089", desc: "eSewa Payment", amount: "+ Rs. 3,400", type: "income" },
               { id: "TXN-088", desc: "Supplier Payment", amount: "- Rs. 15,000", type: "expense" },
             ].map((txn, i) => (
               <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-[#2E3344]/5">
                 <div>
                   <p className="text-xs font-bold text-[#27324A]">{txn.desc}</p>
                   <p className="text-[10px] text-[#746E73] font-bold uppercase tracking-widest mt-0.5">{txn.id}</p>
                 </div>
                 <span className={`text-sm font-black ${txn.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{txn.amount}</span>
               </div>
             ))}
          </div>
        </div>
      </div>

    </div>
  );
}
