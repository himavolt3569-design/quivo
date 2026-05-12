"use client";

import { useState } from "react";
import { Search, ShoppingBag, Clock, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { incomingOrders } from "@/lib/data";

export function OrderList() {
  const [filter, setFilter] = useState("All");

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#27324A]">Online Orders</h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">Manage orders from your public storefront.</p>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar w-full md:w-auto">
          {["All", "Pending", "Processing", "Ready", "Completed", "Cancelled"].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${filter === f ? 'bg-[#27324A] text-white' : 'bg-[#f8f8f7] text-[#746E73] hover:bg-[#F7F0E6]'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#746E73]" />
          <Input 
            placeholder="Search Order ID..." 
            className="pl-9 h-11 rounded-xl bg-[#f8f8f7] border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {incomingOrders.map(order => (
          <div key={order.id} className="bg-white p-5 rounded-[2rem] border border-[#2E3344]/8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition group">
             
             <div className="flex items-start gap-4">
               <div className="h-14 w-14 rounded-2xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center shrink-0">
                 <ShoppingBag className="h-6 w-6" />
               </div>
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <span className="font-bold text-[#746E73] text-xs">{order.id}</span>
                   <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${order.priority === "Urgent" ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"}`}>
                      {order.priority}
                   </span>
                   <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold">{order.status}</span>
                 </div>
                 <h3 className="font-black text-[#27324A] text-base">{order.customer}</h3>
                 <p className="text-sm font-medium text-[#746E73] mt-1 line-clamp-1">{order.items}</p>
                 <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-[#746E73] uppercase tracking-widest">
                   <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {order.received}</span>
                   <span className="flex items-center gap-1 text-[#A7653A]">{order.payment}</span>
                 </div>
               </div>
             </div>

             <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-[#2E3344]/5">
               <Button className="flex-1 md:w-40 h-10 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white text-xs font-bold">
                 Accept Order
               </Button>
               <Button variant="outline" className="flex-1 md:w-40 h-10 rounded-xl border-[#2E3344]/10 text-red-500 hover:bg-red-50 hover:border-red-200 text-xs font-bold">
                 Reject
               </Button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
