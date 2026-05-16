"use client";

import Link from "next/link";
import { Search, ShoppingBag, Plus, Minus, MapPin, Phone, Clock, MessageCircle } from "lucide-react";
import type { TemplateProps } from "./types";
import { productHref, stopCardClick as stop } from "./cardHelpers";

const BODY_SECTIONS = new Set(["featured", "products", "about", "contact"]);
const DEFAULT_BODY_ORDER = ["products", "about", "contact"];

export function MinimalTemplate({ shop, products, cart, onAddToCart, onUpdateQty, onOpenCart, searchQuery, setSearchQuery, activeCategory, setActiveCategory }: TemplateProps) {
  const themeColor = shop.theme_color || "#111";
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
    <div className="min-h-screen bg-white pb-28" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {/* Sticky nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        {shop.announcement_active && shop.announcement_text && (
          <div className="text-center text-xs font-medium py-2 px-4 bg-gray-50 text-gray-600 border-b border-gray-100">
            {shop.announcement_text}
          </div>
        )}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center font-black text-sm shrink-0 overflow-hidden" style={{ color: themeColor }}>
              {shop.logo_url ? <img src={shop.logo_url} alt={shop.name} className="h-full w-full object-cover" /> : shopInitial}
            </div>
            <div className="min-w-0">
              <p className="font-black text-gray-900 text-sm truncate">{shop.name}</p>
              {shop.address && <p className="text-[10px] text-gray-400 truncate">{shop.address}</p>}
            </div>
          </div>
          <button
            onClick={onOpenCart}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:border-gray-400 transition shrink-0"
          >
            <ShoppingBag className="h-4 w-4" />
            {itemCount > 0 && <span className="font-black text-xs" style={{ color: themeColor }}>{itemCount}</span>}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero text (minimal) */}
        {(shop.hero_headline || shop.hero_subtext) && (
          <div className="py-4">
            {shop.hero_headline && <h1 className="text-3xl font-black text-gray-900">{shop.hero_headline}</h1>}
            {shop.hero_subtext && <p className="mt-2 text-gray-500">{shop.hero_subtext}</p>}
          </div>
        )}

        {/* Shop info */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-400 font-medium border-b border-gray-100 pb-6">
          {shop.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {shop.address}</span>}
          {shop.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {shop.phone}</span>}
          {shop.opening_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {shop.opening_time?.slice(0, 5)} – {shop.closing_time?.slice(0, 5)}</span>}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 focus-within:border-gray-400 transition">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="flex-1 h-11 text-sm outline-none bg-transparent"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition border"
              style={{
                backgroundColor: activeCategory === cat ? themeColor : "transparent",
                color: activeCategory === cat ? "white" : "#555",
                borderColor: activeCategory === cat ? themeColor : "#e5e5e5",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {(() => {
          const productsBlock = (
            <section key="products">
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-300">
                  <p className="font-medium text-sm">No products found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 -my-2">
                  {filtered.map((p) => {
              const cartItem = cart.find((c) => c.id === p.id);
              const href = productHref(shop.slug, p);
              const cardCls = "flex items-center gap-4 py-4 group hover:bg-gray-50/60 -mx-2 px-2 rounded-xl transition";
              const body = (
                <>
                  <div className="h-16 w-16 rounded-xl bg-gray-50 flex items-center justify-center font-black text-xl text-gray-200 overflow-hidden shrink-0">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    {p.category && <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{p.category}</span>}
                    <p className="font-bold text-gray-900 text-sm line-clamp-1">{p.name}</p>
                    {p.unit && <p className="text-xs text-gray-400">{p.unit}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-black text-gray-900 text-sm">Rs. {p.price}</span>
                    {cartItem ? (
                      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-0.5" onClick={stop}>
                        <button type="button" onClick={(e) => { stop(e); onUpdateQty(p.id, -1); }} className="h-6 w-6 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 transition">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-black w-4 text-center">{cartItem.qty}</span>
                        <button type="button" onClick={(e) => { stop(e); onUpdateQty(p.id, 1); }} className="h-6 w-6 flex items-center justify-center rounded-lg text-white transition" style={{ backgroundColor: themeColor }}>
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { stop(e); onAddToCart(p); }}
                        className="h-7 px-3 rounded-xl text-xs font-bold text-white flex items-center gap-1 transition active:scale-95"
                        style={{ backgroundColor: themeColor }}
                      >
                        <Plus className="h-3 w-3" /> Add
                      </button>
                    )}
                  </div>
                </>
              );
              return href ? (
                <Link key={p.id} href={href} className={cardCls}>{body}</Link>
              ) : (
                <div key={p.id} className={cardCls}>{body}</div>
              );
            })}
                </div>
              )}
            </section>
          );

          const aboutBlock = shop.description ? (
            <section key="about" className="pt-6 border-t border-gray-100">
              <p className="text-xs font-black uppercase tracking-wider text-gray-300 mb-2">About</p>
              <p className="text-sm text-gray-500 whitespace-pre-line">{shop.description}</p>
            </section>
          ) : null;

          const contactBlock = (shop.phone || shop.whatsapp_number || shop.address) ? (
            <section key="contact" className="pt-6 border-t border-gray-100 space-y-2 text-sm text-gray-600">
              <p className="text-xs font-black uppercase tracking-wider text-gray-300 mb-2">Contact</p>
              {shop.phone && (
                <a href={`tel:${shop.phone}`} className="flex items-center gap-2 hover:text-gray-900">
                  <Phone className="h-3.5 w-3.5 text-gray-400" /> {shop.phone}
                </a>
              )}
              {shop.whatsapp_number && (
                <a href={`https://wa.me/${shop.whatsapp_number.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-gray-900">
                  <MessageCircle className="h-3.5 w-3.5 text-gray-400" /> WhatsApp · {shop.whatsapp_number}
                </a>
              )}
              {shop.address && (
                <p className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" /> {shop.address}</p>
              )}
              {shop.opening_time && (
                <p className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock className="h-3 w-3" /> {shop.opening_time.slice(0, 5)} – {shop.closing_time?.slice(0, 5)}
                </p>
              )}
            </section>
          ) : null;

          const blocks: Record<string, React.ReactNode> = {
            products: productsBlock,
            about: aboutBlock,
            contact: contactBlock,
          };

          const requested = (shop.sections_order ?? []).filter((s) => BODY_SECTIONS.has(s));
          const order = requested.length ? requested.slice() : DEFAULT_BODY_ORDER.slice();
          if (!order.includes("products")) order.push("products");
          return order.map((id) => blocks[id]).filter(Boolean);
        })()}
      </div>

      {/* Cart bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20 sm:hidden">
          <button
            onClick={onOpenCart}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-white font-bold active:scale-95 transition"
            style={{ backgroundColor: themeColor }}
          >
            <span className="text-sm">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
            <span className="font-black">Rs. {total.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  );
}
