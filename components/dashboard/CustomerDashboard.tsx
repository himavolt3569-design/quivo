"use client";

import { Barcode, Clock, MapPin, Package, Settings, ShoppingBag, Store } from "lucide-react";
import { popularProducts, nearbyShops } from "@/lib/data";

export function CustomerDashboard() {
  const activeOrders = [
    {
      id: "QUIVO-8492",
      shop: "Maitidevi Fresh Mart",
      status: "Packing",
      eta: "15 mins",
      total: "Rs. 1,640",
      items: 3,
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      {/* Header Section */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="animate-in fade-in slide-in-from-left-4 duration-500 delay-100 fill-mode-both">
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-[#27324A]">
            Good afternoon.
          </h1>
          <p className="mt-1 text-sm font-medium text-[#746E73]">
            What do you need locally today?
          </p>
        </div>
        <button className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#A7653A] px-6 text-sm font-semibold text-white shadow-xl shadow-[#A7653A]/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:bg-[#8E5432] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4 animate-in fade-in slide-in-from-right-4 duration-500 delay-100 fill-mode-both">
          <Barcode className="h-5 w-5" />
          Scan Barcode
        </button>
      </section>

      {/* Active Orders Section */}
      {activeOrders.length > 0 && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#8D5132] mb-4">
            Active Orders
          </h2>
          <div className="grid gap-4">
            {activeOrders.map((order) => (
              <div key={order.id} className="group flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#2E3344]/8 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-[#E8E3D1] text-[#626A54] transition-transform duration-300 group-hover:scale-105 group-hover:bg-[#D8C99A]">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#27324A] transition-colors group-hover:text-[#A7653A]">{order.shop}</h3>
                    <p className="text-sm font-medium text-[#746E73]">
                      {order.id} · {order.items} items · {order.total}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#A7653A]">{order.status}</p>
                    <p className="text-xs font-medium text-[#746E73]">ETA: {order.eta}</p>
                  </div>
                  <button className="rounded-full border border-[#2E3344]/12 bg-[#F7F0E6] px-4 py-2 text-sm font-semibold text-[#27324A] transition-all duration-300 hover:bg-[#E8E3D1] active:scale-95">
                    Track
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          {/* Buy Again Section */}
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#8D5132]">
                Buy Again
              </h2>
              <button className="text-sm font-semibold text-[#A7653A] hover:underline transition-all">
                View all
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {popularProducts.map((product) => (
                <div key={product.id} className="group min-w-[140px] max-w-[140px] sm:min-w-[160px] sm:max-w-[160px] snap-start shrink-0 rounded-[1.25rem] border border-[#2E3344]/8 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div className="h-24 w-full overflow-hidden rounded-xl bg-[#F7F0E6]">
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  </div>
                  <h4 className="mt-3 truncate text-sm font-bold text-[#27324A] transition-colors group-hover:text-[#A7653A]">{product.name}</h4>
                  <p className="mt-1 text-sm font-bold text-[#A7653A]">{product.price}</p>
                  <button className="mt-3 w-full rounded-full bg-[#F7F0E6] py-1.5 text-xs font-semibold text-[#27324A] transition-all duration-300 hover:bg-[#A7653A] hover:text-white active:scale-95">
                    Reorder
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Neighborhood Shops */}
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400 fill-mode-both">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#8D5132]">
                My Neighborhood Shops
              </h2>
              <button className="text-sm font-semibold text-[#A7653A] hover:underline transition-all">
                Map view
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {nearbyShops.slice(0, 4).map((shop) => (
                <div key={shop.name} className="group flex items-center gap-3 rounded-[1.25rem] border border-[#2E3344]/8 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer">
                  <div className="overflow-hidden rounded-xl">
                    <img src={shop.image} alt={shop.name} className="h-16 w-16 object-cover transition-transform duration-500 group-hover:scale-110" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-[#27324A] transition-colors group-hover:text-[#A7653A]">{shop.name}</h4>
                    <p className="truncate text-xs font-medium text-[#746E73]">{shop.category} · {shop.distance}km</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Management Sidebar */}
        <aside className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 fill-mode-both">
          {/* Money Spent Insights */}
          <div className="rounded-[1.5rem] border border-[#2E3344]/8 bg-white p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[#E8E3D1]/40 blur-2xl"></div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#8D5132] mb-1">
              Money Spent
            </h2>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-[#27324A]">Rs. 12,450</span>
              <span className="text-sm font-medium text-[#746E73]">this month</span>
            </div>
            <button className="relative z-10 mt-5 w-full rounded-full bg-[#A7653A] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#A7653A]/20 transition-all duration-300 hover:bg-[#8E5432] hover:shadow-xl active:scale-95">
              View Insights
            </button>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#8D5132] mb-4">
              Manage
            </h2>
            <div className="rounded-[1.5rem] border border-[#2E3344]/8 bg-white shadow-sm overflow-hidden">
            <button className="group flex w-full items-center gap-3 border-b border-[#2E3344]/8 p-4 text-left transition-all hover:bg-[#F7F0E6] active:bg-[#E8E3D1]">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8E3D1] text-[#626A54] transition-colors duration-300 group-hover:bg-[#D8C99A] group-hover:text-[#8D5132]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#27324A] transition-colors group-hover:text-[#A7653A]">Order History</p>
                <p className="text-xs text-[#746E73]">View past receipts</p>
              </div>
            </button>
            <button className="group flex w-full items-center gap-3 border-b border-[#2E3344]/8 p-4 text-left transition-all hover:bg-[#F7F0E6] active:bg-[#E8E3D1]">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8E3D1] text-[#626A54] transition-colors duration-300 group-hover:bg-[#D8C99A] group-hover:text-[#8D5132]">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#27324A] transition-colors group-hover:text-[#A7653A]">Addresses</p>
                <p className="text-xs text-[#746E73]">Home, Work, etc.</p>
              </div>
            </button>
            <button className="group flex w-full items-center gap-3 p-4 text-left transition-all hover:bg-[#F7F0E6] active:bg-[#E8E3D1]">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8E3D1] text-[#626A54] transition-colors duration-300 group-hover:bg-[#D8C99A] group-hover:text-[#8D5132]">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#27324A] transition-colors group-hover:text-[#A7653A]">Settings</p>
                <p className="text-xs text-[#746E73]">Profile & Preferences</p>
              </div>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
