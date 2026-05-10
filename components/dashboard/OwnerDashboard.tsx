"use client";

import { PackageCheck, ReceiptText, WalletCards, ArrowRight, Store } from "lucide-react";
import { quickSignals, incomingOrders } from "@/lib/data";

export function OwnerDashboard() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      
      {/* ── Top Bento Header ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Shop Greeting Card */}
        <div className="lg:col-span-8 rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 relative overflow-hidden shadow-sm group flex flex-col justify-between">
           <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
             <Store className="h-32 w-32 rotate-12" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] text-[#27324A]">
              Maitidevi <span className="text-[#A7653A]">Fresh Mart</span>
            </h1>
            <p className="mt-2 text-base font-bold text-[#746E73]">
              Your shop is currently <span className="text-green-600">Live & Accepting Orders</span>.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
             <button className="h-12 px-6 rounded-full bg-[#27324A] text-white text-xs font-black uppercase tracking-widest hover:bg-[#1b2333] transition shadow-lg shadow-[#27324A]/10 active:scale-95 flex items-center gap-2">
                <PackageCheck className="h-4 w-4" />
                Update Inventory
             </button>
             <button className="h-12 px-6 rounded-full border border-[#2E3344]/12 bg-white text-[#27324A] text-xs font-black uppercase tracking-widest hover:border-[#A7653A]/40 transition active:scale-95 flex items-center gap-2">
                <ReceiptText className="h-4 w-4" />
                Generate Bill
             </button>
          </div>
        </div>

        {/* Quick Insights Bento */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-3">
           {quickSignals.slice(0, 4).map(([value, label]) => (
              <div key={label} className="rounded-[1.75rem] border border-[#2E3344]/8 bg-white p-5 shadow-sm hover:border-[#A7653A]/20 transition flex flex-col justify-center">
                 <p className="text-2xl font-black text-[#27324A]">{value}</p>
                 <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-[#746E73]">{label}</p>
              </div>
           ))}
        </div>
      </div>

      {/* ── Secondary Bento Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Live Orders Column */}
        <div className="lg:col-span-8 space-y-6">
          <section className="rounded-[2.5rem] bg-[#F7F0E6]/40 border border-[#A7653A]/10 p-7">
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#8D5132]">
                Active Queue
              </h2>
              <button className="text-xs font-bold text-[#A7653A] hover:underline">
                View All
              </button>
            </div>
            <div className="space-y-3">
              {incomingOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="group rounded-[1.75rem] bg-white border border-[#2E3344]/5 p-5 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-[#27324A] text-white flex items-center justify-center font-black text-xs">
                        {order.id.slice(-2)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-[#27324A] truncate">{order.customer}</h4>
                        <p className="text-xs font-bold text-[#746E73] mt-0.5 truncate">{order.items}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className={`hidden sm:inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${order.priority === "Urgent" ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"}`}>
                          {order.priority}
                       </span>
                       <button className="h-10 px-5 rounded-full bg-[#F7F0E6] text-[#27324A] text-xs font-black hover:bg-[#A7653A] hover:text-white transition active:scale-95">
                          Review
                       </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Financials & Tools Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Ledger Bento */}
          <div className="rounded-[2.5rem] bg-[#27324A] p-7 text-white shadow-xl shadow-[#27324A]/10 flex flex-col justify-between group">
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#D8C99A]">Outstanding Balance</p>
                <p className="text-3xl font-black mt-3">Rs. 12,450</p>
                <p className="mt-2 text-xs text-white/50 font-medium leading-relaxed">
                   Pending settlements from 14 delivery completions this week.
                </p>
             </div>
             <button className="mt-8 w-full py-4 rounded-full bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/20 transition flex items-center justify-center gap-2">
                Settlement History
                <ArrowRight className="h-4 w-4" />
             </button>
          </div>

          {/* Shop Performance Small Bento */}
          <div className="rounded-[2.5rem] bg-[#E8E3D1]/50 border border-[#2E3344]/8 p-7 flex flex-col items-center text-center">
             <div className="h-14 w-14 rounded-[1.25rem] bg-white flex items-center justify-center shadow-sm mb-4">
                <WalletCards className="h-7 w-7 text-[#A7653A]" />
             </div>
             <h3 className="text-sm font-black text-[#27324A] uppercase tracking-wider">Market Pulse</h3>
             <p className="text-xs text-[#746E73] mt-2 font-medium">Your shop is in the <span className="text-[#A7653A] font-bold">top 5%</span> of local neighborhood sellers this month.</p>
          </div>
        </aside>

      </div>
    </div>
  );
}
