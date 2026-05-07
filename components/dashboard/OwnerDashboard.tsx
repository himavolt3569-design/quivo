"use client";

import { PackageCheck, ReceiptText, WalletCards, ArrowRight } from "lucide-react";
import { quickSignals, incomingOrders } from "@/lib/data";

export function OwnerDashboard() {
  return (
    <div className="space-y-8">
      {/* Header Section */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-[#27324A]">
            Shop Overview
          </h1>
          <p className="mt-1 text-sm font-medium text-[#746E73]">
            Maitidevi Fresh Mart
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#2E3344]/12 bg-white px-5 text-sm font-semibold text-[#27324A] transition hover:-translate-y-0.5 hover:shadow-md">
            <PackageCheck className="h-4 w-4" />
            Update Stock
          </button>
          <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#27324A] px-5 text-sm font-semibold text-white shadow-xl shadow-[#27324A]/25 transition hover:-translate-y-0.5 hover:bg-[#1B2030]">
            <ReceiptText className="h-4 w-4" />
            New Bill
          </button>
        </div>
      </section>

      {/* Quick Signals */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickSignals.map(([value, label]) => (
          <div key={label} className="rounded-[1.25rem] border border-[#2E3344]/8 bg-white p-5 shadow-sm">
            <p className="text-2xl font-bold text-[#27324A]">{value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#746E73]">
              {label}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Live Orders */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#8D5132]">
              Live Orders
            </h2>
            <button className="text-sm font-semibold text-[#A7653A] hover:underline">
              View queue
            </button>
          </div>
          <div className="overflow-hidden rounded-[1.5rem] border border-[#2E3344]/8 bg-white shadow-sm">
            <div className="divide-y divide-[#2E3344]/8">
              {incomingOrders.slice(0, 2).map((order) => (
                <div key={order.id} className="p-5 transition hover:bg-[#FFFBF4]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#27324A] px-2.5 py-0.5 text-[0.65rem] font-bold text-white">
                          {order.id}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold ${order.priority === "Urgent" ? "bg-[#F3E1CB] text-[#8D5132]" : "bg-[#E8E3D1] text-[#626A54]"}`}>
                          {order.priority}
                        </span>
                      </div>
                      <h4 className="mt-2 font-bold text-[#27324A]">{order.customer}</h4>
                      <p className="mt-1 text-sm text-[#746E73]">{order.items}</p>
                    </div>
                    <button className="rounded-full bg-[#F7F0E6] px-4 py-2 text-xs font-semibold text-[#27324A] transition hover:bg-[#E8E3D1]">
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ledger & Tools */}
        <aside className="space-y-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#8D5132] mb-4">
              Pending Ledger
            </h2>
            <div className="rounded-[1.5rem] border border-[#2E3344]/8 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4 border-b border-[#2E3344]/8 pb-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#E8E3D1] text-[#626A54]">
                  <WalletCards className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-[#27324A]">Rs. 12,450</p>
                  <p className="text-xs font-medium text-[#746E73]">Total outstanding</p>
                </div>
              </div>
              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#F7F0E6] px-4 py-2 text-sm font-semibold text-[#27324A] transition hover:bg-[#E8E3D1]">
                View Ledger <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
