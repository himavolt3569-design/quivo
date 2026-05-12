"use client";

import { useState } from "react";
import { Search, Plus, Truck, AlertTriangle, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SupplierList() {
  const [search, setSearch] = useState("");

  const suppliers = [
    { id: "1", name: "CG Foods Distributor", phone: "9800000011", category: "Snacks & Beverages", dues: 15000, nextDelivery: "Tomorrow" },
    { id: "2", name: "DDC Supply", phone: "9800000022", category: "Dairy", dues: 0, nextDelivery: "Today" },
    { id: "3", name: "Aarati Rice Traders", phone: "9800000033", category: "Grocery", dues: 45000, nextDelivery: "Next Week" },
  ];

  const totalDues = suppliers.reduce((acc, s) => acc + s.dues, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header & Quick Stats */}
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-[#27324A]">Suppliers</h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">Manage distributors, pending dues, and purchases.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-red-50 text-red-900 border border-red-200 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-sm">
             <Truck className="h-6 w-6 text-red-600" />
             <div>
               <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">Total Pending Dues</p>
               <p className="text-xl font-black text-red-700">Rs. {totalDues}</p>
             </div>
          </div>
          <Button className="rounded-xl h-12 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold px-6 shadow-sm hidden sm:flex">
            <Plus className="h-4 w-4 mr-2" /> Add Supplier
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map(supplier => (
          <div key={supplier.id} className="bg-white p-5 rounded-[2rem] border border-[#2E3344]/8 shadow-sm group hover:border-[#A7653A]/30 transition">
             <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                   <div className="h-12 w-12 rounded-xl bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center font-black">
                     {supplier.name[0]}
                   </div>
                   <div>
                     <h3 className="font-black text-[#27324A] text-base">{supplier.name}</h3>
                     <p className="text-xs font-bold text-[#746E73]">{supplier.category}</p>
                   </div>
                </div>
             </div>
             
             <div className="bg-[#f8f8f7] rounded-xl p-3 mb-4 border border-[#2E3344]/5 flex justify-between items-center">
                <span className="text-xs font-bold text-[#746E73]">Current Dues</span>
                <span className={`font-black ${supplier.dues > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  Rs. {supplier.dues}
                </span>
             </div>

             <div className="flex gap-2">
                <Button className="flex-1 h-10 rounded-xl bg-white border border-[#2E3344]/10 text-[#27324A] hover:bg-[#F7F0E6] text-xs font-bold shadow-none">
                  <FileText className="h-3.5 w-3.5 mr-1.5" /> Ledger
                </Button>
                {supplier.dues > 0 && (
                  <Button className="flex-1 h-10 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white text-xs font-bold">
                    Pay Now
                  </Button>
                )}
             </div>
          </div>
        ))}
      </div>

    </div>
  );
}
