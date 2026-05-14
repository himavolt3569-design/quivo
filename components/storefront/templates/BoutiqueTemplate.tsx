"use client";

import { Search, ShoppingBag, Plus, ArrowRight, MapPin, Phone } from "lucide-react";
import type { TemplateProps } from "./types";

export function BoutiqueTemplate({ shop, products, cart, onAddToCart, onUpdateQty, onOpenCart, searchQuery, setSearchQuery, activeCategory, setActiveCategory }: TemplateProps) {
  const themeColor = shop.theme_color || "#27324A";
  const itemCount = cart.reduce((a, b) => a + b.qty, 0);
  const total = cart.reduce((a, b) => a + b.price * b.qty, 0);
  const shopInitial = shop.name[0]?.toUpperCase() ?? "S";

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[]))];
  const filtered = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q);
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-[#fafaf8] pb-28" style={{ fontFamily: "'Playfair Display', serif" }}>
      {/* Announcement */}
      {shop.announcement_active && shop.announcement_text && (
        <div className="text-center text-xs font-medium py-3 px-4 bg-[#f0ebe0] text-gray-700 tracking-wider uppercase">
          {shop.announcement_text}
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ minHeight: "360px" }}>
        {shop.cover_image_url ? (
          <img src={shop.cover_image_url} alt={shop.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${themeColor} 0%, ${themeColor}99 60%, #f0ebe0 100%)` }} />
        )}
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 flex flex-col items-center justify-center text-center text-white px-6 py-20">
          <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center font-black text-3xl mb-5 overflow-hidden">
            {shop.logo_url ? <img src={shop.logo_url} alt={shop.name} className="h-full w-full object-cover" /> : shopInitial}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{shop.hero_headline || shop.name}</h1>
          {shop.hero_subtext && <p className="mt-3 text-white/80 text-lg max-w-md">{shop.hero_subtext}</p>}
          {shop.description && <p className="mt-2 text-white/60 text-sm max-w-sm">{shop.description}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-white/70 font-medium" style={{ fontFamily: "DM Sans, sans-serif" }}>
            {shop.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {shop.address}</span>}
            {shop.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {shop.phone}</span>}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-6 relative z-20 mb-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center px-5">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search our collection..."
            className="flex-1 h-12 px-3 text-sm outline-none bg-transparent"
            style={{ fontFamily: "DM Sans, sans-serif" }}
          />
        </div>
      </div>

      {/* Category strip */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-8">
        <div className="flex gap-3 overflow-x-auto hide-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-5 py-2.5 rounded-full text-xs tracking-wider uppercase transition shrink-0"
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontWeight: activeCategory === cat ? 700 : 500,
                backgroundColor: activeCategory === cat ? themeColor : "white",
                color: activeCategory === cat ? "white" : "#555",
                border: `2px solid ${activeCategory === cat ? themeColor : "#e5e5e5"}`,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products — 2-column boutique cards */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400" style={{ fontFamily: "DM Sans, sans-serif" }}>
            <ShoppingBag className="h-12 w-12 mx-auto opacity-20 mb-3" />
            <p className="font-medium">Nothing found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            {filtered.map((p) => {
              const cartItem = cart.find((c) => c.id === p.id);
              return (
                <div key={p.id} className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col overflow-hidden rounded-2xl group">
                  {/* Image */}
                  <div className="aspect-[3/4] bg-[#f8f5ef] flex items-center justify-center font-black text-5xl text-gray-200 overflow-hidden relative">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <span className="opacity-30">{p.name[0]}</span>
                    )}
                    {cartItem && (
                      <span className="absolute top-3 right-3 h-6 w-6 rounded-full text-white text-[10px] font-black flex items-center justify-center shadow" style={{ backgroundColor: themeColor }}>
                        {cartItem.qty}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1" style={{ fontFamily: "DM Sans, sans-serif" }}>
                    {p.brand && <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">{p.brand}</span>}
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-2 flex-1">{p.name}</h3>
                    {p.unit && <p className="text-[10px] text-gray-400 mt-1">{p.unit}</p>}
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-black text-gray-900">Rs. {p.price}</span>
                      {cartItem ? (
                        <div className="flex items-center gap-1 bg-gray-50 rounded-xl border border-gray-200 p-0.5">
                          <button onClick={() => onUpdateQty(p.id, -1)} className="h-6 w-6 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 transition font-bold">−</button>
                          <span className="text-xs font-black w-4 text-center">{cartItem.qty}</span>
                          <button onClick={() => onUpdateQty(p.id, 1)} className="h-6 w-6 rounded-lg flex items-center justify-center text-white transition" style={{ backgroundColor: themeColor }}><Plus className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(p)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1 transition active:scale-95"
                          style={{ backgroundColor: themeColor }}
                        >
                          Add <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart button */}
      {itemCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20 px-4">
          <button
            onClick={onOpenCart}
            className="flex items-center gap-4 px-6 py-3.5 rounded-full text-white shadow-2xl font-bold transition active:scale-95"
            style={{ backgroundColor: themeColor, fontFamily: "DM Sans, sans-serif" }}
          >
            <ShoppingBag className="h-5 w-5" />
            <span>{itemCount} item{itemCount !== 1 ? "s" : ""} · Rs. {total.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  );
}
