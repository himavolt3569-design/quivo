"use client";

import { useState } from "react";
import { Search, UserPlus, Phone, MessageCircle, WalletCards, MoreVertical, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const customers = [
  { id: "1", name: "Ramesh Sharma", phone: "9841000000", totalPurchases: 45000, udhar: 1250, lastVisit: "Today", overdue: true },
  { id: "2", name: "Sita Khadka", phone: "9851000000", totalPurchases: 12000, udhar: 0, lastVisit: "2 days ago", overdue: false },
  { id: "3", name: "Bikash Gurung", phone: "9861000000", totalPurchases: 85000, udhar: 4500, lastVisit: "Last week", overdue: true },
  { id: "4", name: "Anu Shrestha", phone: "9801000000", totalPurchases: 3200, udhar: 150, lastVisit: "Yesterday", overdue: false },
];

export function CustomerList() {
  const [search, setSearch] = useState("");

  const totalUdhar = customers.reduce((acc, c) => acc + c.udhar, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header & Quick Stats */}
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-[#27324A]">Customers & Udhar</h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">Manage store credit and customer relationships.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-[#27324A] text-white px-6 py-3 rounded-2xl flex items-center gap-4 shadow-md">
             <WalletCards className="h-6 w-6 text-[#D8C99A]" />
             <div>
               <p className="text-[10px] font-bold uppercase tracking-widest text-[#D8C99A]">Total Udhar in Market</p>
               <p className="text-xl font-black">Rs. {totalUdhar}</p>
             </div>
          </div>
          <Button className="rounded-xl h-12 bg-[#A7653A] hover:bg-[#8D5132] text-white font-bold px-6 shadow-sm hidden sm:flex">
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
          <Button variant="outline" className="rounded-xl h-11 border-[#2E3344]/10 text-[#27324A] font-bold flex-1 sm:flex-none">
            All Customers
          </Button>
          <Button variant="outline" className="rounded-xl h-11 border-[#A7653A]/30 bg-[#F7F0E6]/50 text-[#A7653A] font-bold flex-1 sm:flex-none">
            Udhar Only
          </Button>
        </div>
      </div>

      {/* Desktop Table */}
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
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-[#f8f8f7]/50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#E8E3D1]/50 flex items-center justify-center font-black text-[#A7653A]">
                      {customer.name[0]}
                    </div>
                    <div>
                      <p className="font-black text-[#27324A]">{customer.name}</p>
                      <p className="text-[10px] font-bold text-[#746E73]">Last seen: {customer.lastVisit}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-[#746E73]">{customer.phone}</td>
                <td className="px-6 py-4 font-bold text-[#27324A]">Rs. {customer.totalPurchases}</td>
                <td className="px-6 py-4">
                  {customer.udhar > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="font-black text-orange-600">Rs. {customer.udhar}</span>
                      {customer.overdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    </div>
                  ) : (
                    <span className="font-bold text-green-600">Cleared</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {customer.udhar > 0 && (
                      <>
                        <Button size="sm" variant="outline" className="h-8 rounded-lg border-green-200 text-green-700 bg-green-50 hover:bg-green-100 font-bold text-xs">
                          Settle
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-green-200 text-green-600 hover:bg-green-50">
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-[#746E73]">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
