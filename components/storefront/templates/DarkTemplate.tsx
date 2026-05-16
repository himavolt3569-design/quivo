"use client";

import Link from "next/link";
import { Search, ShoppingBag, Plus, Zap, MapPin, Phone, MessageCircle } from "lucide-react";
import type { TemplateProps } from "./types";
import { productHref, stopCardClick as stop } from "./cardHelpers";

const BODY_SECTIONS = new Set(["featured", "products", "about", "contact"]);
const DEFAULT_BODY_ORDER = ["products", "about", "contact"];

export function DarkTemplate({ shop, products, cart, onAddToCart, onUpdateQty, onOpenCart, searchQuery, setSearchQuery, activeCategory, setActiveCategory }: TemplateProps) {
  const themeColor = shop.theme_color || "#D4A853";
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
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#0c0c12", fontFamily: "Space Grotesk, sans-serif", color: "white" }}>
      {/* Announcement */}
      {shop.announcement_active && shop.announcement_text && (
        <div className="text-center text-xs font-bold py-3 px-4 tracking-wider" style={{ backgroundColor: themeColor, color: "#0c0c12" }}>
          {shop.announcement_text}
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden px-4 sm:px-6 pt-12 pb-16">
        {shop.cover_image_url && (
          <img src={shop.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
        )}
        {/* Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ backgroundColor: themeColor }} />

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <div className="h-16 w-16 rounded-2xl mx-auto mb-5 flex items-center justify-center font-black text-2xl border overflow-hidden" style={{ borderColor: themeColor + "40", backgroundColor: themeColor + "15", color: themeColor }}>
            {shop.logo_url ? <img src={shop.logo_url} alt={shop.name} className="h-full w-full object-cover" /> : shopInitial}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight" style={{ color: themeColor }}>
            {shop.hero_headline || shop.name}
          </h1>
          {shop.hero_subtext && <p className="mt-3 text-gray-400 text-sm max-w-md mx-auto">{shop.hero_subtext}</p>}
          {shop.address && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-500">
              <MapPin className="h-3.5 w-3.5" style={{ color: themeColor }} /> {shop.address}
            </p>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mb-6">
        <div className="flex items-center gap-3 px-4 rounded-2xl border" style={{ backgroundColor: "#1a1a26", borderColor: "#2a2a38" }}>
          <Search className="h-4 w-4 shrink-0" style={{ color: themeColor }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="flex-1 h-12 text-sm outline-none bg-transparent text-white placeholder-gray-600"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mb-8">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border"
              style={{
                backgroundColor: activeCategory === cat ? themeColor : "#1a1a26",
                color: activeCategory === cat ? "#0c0c12" : "#888",
                borderColor: activeCategory === cat ? themeColor : "#2a2a38",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Body sections rendered in owner's chosen order */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-12">
        {(() => {
          const productsBlock = (
            <section key="products">
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <ShoppingBag className="h-12 w-12 mx-auto opacity-20 mb-3" style={{ color: themeColor }} />
                  <p className="font-medium text-sm">No products found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {filtered.map((p) => {
              const cartItem = cart.find((c) => c.id === p.id);
              const href = productHref(shop.slug, p);
              const cardCls = "rounded-2xl overflow-hidden flex flex-col border transition";
              const cardStyle = {
                backgroundColor: "#1a1a26",
                borderColor: cartItem ? themeColor + "60" : "#2a2a38",
              };
              const body = (
                <>
                  <div className="aspect-square flex items-center justify-center font-black text-4xl overflow-hidden relative" style={{ backgroundColor: "#13131e" }}>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="opacity-20" style={{ color: themeColor }}>{p.name[0]}</span>
                    )}
                    {cartItem && (
                      <span className="absolute top-2 right-2 h-5 w-5 rounded-full text-[10px] font-black flex items-center justify-center" style={{ backgroundColor: themeColor, color: "#0c0c12" }}>
                        {cartItem.qty}
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    {p.category && <span className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: themeColor }}>{p.category}</span>}
                    <h3 className="text-xs font-bold text-white line-clamp-2 flex-1">{p.name}</h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-black" style={{ color: themeColor }}>Rs. {p.price}</span>
                      {cartItem ? (
                        <div className="flex items-center gap-1 rounded-xl p-0.5 border" style={{ borderColor: themeColor + "40" }} onClick={stop}>
                          <button type="button" onClick={(e) => { stop(e); onUpdateQty(p.id, -1); }} className="h-6 w-6 flex items-center justify-center rounded-lg transition font-bold text-gray-400 hover:text-white">−</button>
                          <span className="text-xs font-black w-4 text-center text-white">{cartItem.qty}</span>
                          <button type="button" onClick={(e) => { stop(e); onUpdateQty(p.id, 1); }} className="h-6 w-6 flex items-center justify-center rounded-lg transition" style={{ backgroundColor: themeColor }}>
                            <Plus className="h-3 w-3" style={{ color: "#0c0c12" }} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { stop(e); onAddToCart(p); }}
                          className="h-7 px-2.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition active:scale-90"
                          style={{ backgroundColor: themeColor, color: "#0c0c12" }}
                        >
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
              return href ? (
                <Link key={p.id} href={href} className={cardCls} style={cardStyle}>{body}</Link>
              ) : (
                <div key={p.id} className={cardCls} style={cardStyle}>{body}</div>
              );
            })}
                </div>
              )}
            </section>
          );

          const aboutBlock = shop.description ? (
            <section key="about" className="p-6 rounded-2xl border" style={{ backgroundColor: "#1a1a26", borderColor: "#2a2a38" }}>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4" style={{ color: themeColor }} />
                <span className="text-xs font-black uppercase tracking-wider" style={{ color: themeColor }}>About</span>
              </div>
              <p className="text-sm text-gray-400 whitespace-pre-line">{shop.description}</p>
            </section>
          ) : null;

          const contactBlock = (shop.phone || shop.whatsapp_number || shop.address) ? (
            <section key="contact" className="p-6 rounded-2xl border" style={{ backgroundColor: "#1a1a26", borderColor: "#2a2a38" }}>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4" style={{ color: themeColor }} />
                <span className="text-xs font-black uppercase tracking-wider" style={{ color: themeColor }}>Contact</span>
              </div>
              <div className="space-y-2 text-sm text-gray-300">
                {shop.phone && (
                  <a href={`tel:${shop.phone}`} className="flex items-center gap-2 hover:text-white">
                    <Phone className="h-3.5 w-3.5" style={{ color: themeColor }} /> {shop.phone}
                  </a>
                )}
                {shop.whatsapp_number && (
                  <a href={`https://wa.me/${shop.whatsapp_number.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white">
                    <MessageCircle className="h-3.5 w-3.5" style={{ color: themeColor }} /> WhatsApp · {shop.whatsapp_number}
                  </a>
                )}
                {shop.address && (
                  <p className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: themeColor }} /> {shop.address}</p>
                )}
              </div>
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

      {/* Cart */}
      {itemCount > 0 && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-20">
          <button
            onClick={onOpenCart}
            className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4 px-6 py-3.5 rounded-2xl font-bold shadow-2xl transition active:scale-95"
            style={{ backgroundColor: themeColor, color: "#0c0c12" }}
          >
            <ShoppingBag className="h-5 w-5" />
            <span>{itemCount} item{itemCount !== 1 ? "s" : ""} · Rs. {total.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  );
}
