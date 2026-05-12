"use client";

import { useState } from "react";
import { Users, Shield, Plus, Lock, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StaffList() {
  const staff = [
    { id: "1", name: "Ramesh Sharma", role: "Owner", phone: "9800000001", status: "Active" },
    { id: "2", name: "Sita Khadka", role: "Manager", phone: "9800000002", status: "Active" },
    { id: "3", name: "Bikash Gurung", role: "Cashier", phone: "9800000003", status: "Active" },
    { id: "4", name: "Anu Shrestha", role: "Inventory Staff", phone: "9800000004", status: "Inactive" },
  ];

  const permissions = [
    { module: "Dashboard & Analytics", owner: true, manager: true, cashier: false, inventory: false },
    { module: "Point of Sale (POS)", owner: true, manager: true, cashier: true, inventory: false },
    { module: "Product Management", owner: true, manager: true, cashier: false, inventory: true },
    { module: "Stock Adjustments", owner: true, manager: true, cashier: false, inventory: true },
    { module: "Customer Udhar", owner: true, manager: true, cashier: true, inventory: false },
    { module: "Supplier Payments", owner: true, manager: false, cashier: false, inventory: false },
    { module: "Shop Settings", owner: true, manager: false, cashier: false, inventory: false },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#27324A]">Staff & Roles</h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">Manage employee access and shop permissions.</p>
        </div>
        <Button className="rounded-xl h-12 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold px-6 shadow-sm w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Add Staff Member
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Staff List */}
        <div className="lg:col-span-4 space-y-4">
          {staff.map(member => (
            <div key={member.id} className="bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-full bg-[#E8E3D1]/50 flex items-center justify-center font-black text-[#A7653A]">
                   {member.name[0]}
                 </div>
                 <div>
                   <p className="font-bold text-[#27324A] text-sm">{member.name}</p>
                   <div className="flex items-center gap-2 mt-0.5">
                     <span className="text-[10px] font-bold text-[#A7653A] bg-[#F7F0E6] px-2 py-0.5 rounded-md uppercase tracking-widest">{member.role}</span>
                     {member.status === "Inactive" && <span className="text-[10px] text-[#746E73] font-bold">Inactive</span>}
                   </div>
                 </div>
               </div>
               <button className="text-[#746E73] hover:text-[#27324A] p-2"><MoreVertical className="h-4 w-4" /></button>
            </div>
          ))}
        </div>

        {/* Permissions Matrix */}
        <div className="lg:col-span-8 bg-white rounded-[2rem] border border-[#2E3344]/8 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#2E3344]/8 bg-[#f8f8f7] flex items-center gap-3">
            <Shield className="h-5 w-5 text-[#27324A]" />
            <h2 className="text-lg font-black text-[#27324A]">Permission Matrix</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white border-b border-[#2E3344]/8 text-[#746E73] font-bold uppercase tracking-widest text-[10px]">
                <tr>
                  <th className="px-6 py-4">Module</th>
                  <th className="px-6 py-4 text-center">Owner</th>
                  <th className="px-6 py-4 text-center">Manager</th>
                  <th className="px-6 py-4 text-center">Cashier</th>
                  <th className="px-6 py-4 text-center">Inventory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E3344]/5">
                {permissions.map((perm, i) => (
                  <tr key={i} className="hover:bg-[#f8f8f7]/50 transition">
                    <td className="px-6 py-4 font-bold text-[#27324A]">{perm.module}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="mx-auto h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {perm.manager ? (
                        <div className="mx-auto h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                        </div>
                      ) : (
                        <Lock className="h-4 w-4 text-[#746E73] mx-auto opacity-30" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {perm.cashier ? (
                        <div className="mx-auto h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                        </div>
                      ) : (
                        <Lock className="h-4 w-4 text-[#746E73] mx-auto opacity-30" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {perm.inventory ? (
                        <div className="mx-auto h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                        </div>
                      ) : (
                        <Lock className="h-4 w-4 text-[#746E73] mx-auto opacity-30" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-[#f8f8f7] text-center border-t border-[#2E3344]/5">
             <p className="text-[10px] text-[#746E73] font-bold">Permissions are role-based. To create custom roles, upgrade to the Enterprise plan.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
