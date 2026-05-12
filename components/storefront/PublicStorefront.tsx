"use client";

import { useState } from "react";
import { Search, ShoppingBag, MapPin, Phone, Clock, Star, Share2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PublicStorefront({ shopName }: { shopName: string }) {
  const [search, setSearch] = useState("");

  const products = [
    { id: 1, name: "Jeera Masino Rice 25kg", price: 2450, category: "Grocery", stock: "In Stock" },
    { id: 2, name: "Fresh Dairy Milk 1L", price: 120, category: "Dairy", stock: "Few left" },
    { id: 3, name: "Mustard Oil 1L", price: 380, category: "Grocery", stock: "In Stock" },
    { id: 4, name: "Wai Wai Noodles", price: 20, category: "Snacks", stock: "In Stock" },
    { id: 5, name: "Amul Butter 500g", price: 650, category: "Dairy", stock: "Out of Stock" },
    { id: 6, name: "Lipton Green Tea", price: 180, category: "Beverages", stock: "In Stock" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f8f7] font-[Poppins] pb-24">
      {/* ── Store Hero ────────────────────────────────────────── */}
      <div className="bg-[#A7653A] text-white pt-12 pb-8 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
            <div className="h-24 w-24 rounded-3xl bg-white text-[#27324A] flex items-center justify-center font-black text-4xl shadow-xl">
              {shopName[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-center sm:justify-between gap-4">
                <h1 className="text-3xl sm:text-4xl font-black">{shopName}</h1>
                <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition">
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>
              <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-4 text-xs font-medium text-white/80">
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Maitidevi Chowk, Kathmandu</span>
                <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Open (7 AM - 9 PM)</span>
                <span className="flex items-center gap-1.5 text-yellow-300 font-bold"><Star className="h-3.5 w-3.5 fill-current" /> 4.8 (120 reviews)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter ────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-6 relative z-20">
        <div className="bg-white rounded-2xl p-2 shadow-lg border border-[#2E3344]/5 flex items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#746E73]" />
            <Input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for groceries, dairy, snacks..." 
              className="pl-12 h-12 border-transparent bg-transparent focus-visible:ring-0 text-base"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6 overflow-x-auto hide-scrollbar pb-2">
          {['All Items', 'Grocery', 'Dairy', 'Snacks', 'Beverages'].map(cat => (
            <button key={cat} className="px-5 py-2.5 bg-white border border-[#2E3344]/5 rounded-xl text-xs font-bold text-[#27324A] hover:bg-[#F7F0E6] hover:border-[#A7653A]/30 transition shadow-sm whitespace-nowrap">
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product Grid ────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
        <h2 className="text-lg font-black text-[#27324A] mb-6">Popular Items</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {products.map(product => (
            <div key={product.id} className="bg-white rounded-[1.5rem] p-4 border border-[#2E3344]/8 shadow-sm flex flex-col hover:border-[#A7653A]/40 transition group">
              <div className="aspect-square bg-[#f8f8f7] rounded-xl mb-4 relative overflow-hidden group-hover:bg-[#F7F0E6]/50 transition-colors flex items-center justify-center text-[#746E73]/20 font-black text-4xl">
                {product.name[0]}
              </div>
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#746E73] mb-1">{product.category}</span>
                <h3 className="text-sm font-bold text-[#27324A] line-clamp-2">{product.name}</h3>
                
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <span className="font-black text-[#27324A] text-base">Rs. {product.price}</span>
                  {product.stock === "Out of Stock" ? (
                    <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">Out</span>
                  ) : (
                    <button className="h-8 w-8 rounded-full bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center hover:bg-[#A7653A] hover:text-white transition">
                      <ShoppingBag className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Floating Cart Button */}
      <div className="fixed bottom-6 left-0 right-0 px-4 z-40 sm:hidden">
        <button className="w-full h-14 bg-[#27324A] text-white rounded-2xl shadow-xl shadow-[#27324A]/20 flex items-center justify-between px-6 font-bold active:scale-95 transition">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -top-2 -right-2 h-4 w-4 bg-[#A7653A] rounded-full text-[9px] flex items-center justify-center">0</span>
            </div>
            <span className="text-sm">View Cart</span>
          </div>
          <span className="text-sm">Rs. 0</span>
        </button>
      </div>

    </div>
  );
}
