"use client";

import Link from "next/link";
import { Search, Share2, MapPin, Clock, ShoppingBag, Plus, Phone, MessageCircle } from "lucide-react";
import type { TemplateProps } from "./types";
import { productHref, stopCardClick as stop } from "./cardHelpers";

const DEFAULT_BODY_ORDER = ["featured", "products", "about", "contact"];
const BODY_SECTIONS = new Set(["featured", "products", "about", "contact"]);

export function ModernTemplate({ shop, products, cart, onAddToCart, onUpdateQty, onOpenCart, onOpenChat, searchQuery, setSearchQuery, activeCategory, setActiveCategory }: TemplateProps) {
  const themeColor = shop.theme_color || "#A7653A";
  const itemCount = cart.reduce((a, b) => a + b.qty, 0);
  const total = cart.reduce((a, b) => a + b.price * b.qty, 0);
  const shopInitial = shop.name[0]?.toUpperCase() ?? "S";

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[]))];
  const featured = shop.featured_product_ids?.length
    ? products.filter((p) => shop.featured_product_ids!.includes(p.id))
    : [];

  const filtered = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q);
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  const isOpen = (() => {
    if (!shop.opening_time || !shop.closing_time) return true;
    const now = new Date();
    const [oh, om] = shop.opening_time.split(":").map(Number);
    const [ch, cm] = shop.closing_time.split(":").map(Number);
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= oh * 60 + om && mins < ch * 60 + cm;
  })();

  const handleShare = () => {
    navigator.share?.({ title: shop.name, url: window.location.href }) ?? navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Announcement */}
      {shop.announcement_active && shop.announcement_text && (
        <div className="text-center text-xs font-bold py-2.5 px-4 text-white" style={{ backgroundColor: themeColor }}>
          {shop.announcement_text}
        </div>
      )}

      {/* Hero */}
      <div
        className="relative overflow-hidden text-white pt-10 pb-14 px-4 sm:px-6"
        style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)` }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="max-w-5xl mx-auto relative z-10 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
          {/* Logo */}
          <div className="h-20 w-20 rounded-2xl bg-white flex items-center justify-center font-black text-3xl shadow-xl shrink-0 overflow-hidden" style={{ color: themeColor }}>
            {shop.logo_url ? <img src={shop.logo_url} alt={shop.name} className="h-full w-full object-cover" /> : shopInitial}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-black">{shop.hero_headline || shop.name}</h1>
                {shop.hero_subtext && <p className="mt-1 text-white/80 text-sm font-medium">{shop.hero_subtext}</p>}
              </div>
              <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-full text-xs font-bold transition">
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
            </div>
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-3 text-xs text-white/80 font-medium">
              {shop.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {shop.address}</span>}
              {shop.opening_time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className={isOpen ? "text-green-300 font-bold" : "text-red-300 font-bold"}>
                    {isOpen ? "Open" : "Closed"}
                  </span>{" "}
                  · {shop.opening_time?.slice(0, 5)} – {shop.closing_time?.slice(0, 5)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search + Categories */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-7 relative z-20 space-y-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center px-4">
          <Search className="h-5 w-5 text-gray-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="flex-1 h-12 px-3 text-sm outline-none bg-transparent"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeCategory === cat ? "text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
              style={activeCategory === cat ? { backgroundColor: themeColor } : {}}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 space-y-8">
        {(() => {
          const featuredBlock = (featured.length > 0 && searchQuery === "" && activeCategory === "All") ? (
            <section key="featured">
              <h2 className="text-sm font-black uppercase tracking-wider text-gray-500 mb-3">⭐ Featured</h2>
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {featured.map((p) => {
                  const cartItem = cart.find((c) => c.id === p.id);
                  const href = productHref(shop.slug, p);
                  const inner = (
                    <>
                      <div className="h-20 w-full rounded-xl bg-gray-50 mb-2 flex items-center justify-center text-2xl font-black text-gray-300 overflow-hidden">
                        {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : p.name[0]}
                      </div>
                      <p className="text-xs font-bold text-gray-800 line-clamp-2">{p.name}</p>
                      <p className="text-xs font-black mt-1" style={{ color: themeColor }}>Rs. {p.price}</p>
                      {cartItem && <p className="text-[10px] text-white font-bold px-2 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: themeColor }}>{cartItem.qty} in cart</p>}
                    </>
                  );
                  const cls = "shrink-0 w-40 bg-white rounded-2xl p-3 border-2 border-transparent hover:border-gray-200 shadow-sm transition text-left block";
                  return href ? (
                    <Link key={p.id} href={href} className={cls} style={{ borderColor: cartItem ? themeColor : undefined }}>{inner}</Link>
                  ) : (
                    <button key={p.id} onClick={() => onAddToCart(p)} className={cls} style={{ borderColor: cartItem ? themeColor : undefined }}>{inner}</button>
                  );
                })}
              </div>
            </section>
          ) : null;

          const productsBlock = (
            <section key="products">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-500">
                  {activeCategory === "All" ? "All Products" : activeCategory}
                  {filtered.length > 0 && <span className="ml-2 font-bold text-gray-400">({filtered.length})</span>}
                </h2>
              </div>
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <ShoppingBag className="h-12 w-12 mx-auto opacity-20 mb-3" />
                  <p className="font-medium">No products found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {filtered.map((p) => {
                    const cartItem = cart.find((c) => c.id === p.id);
                    const href = productHref(shop.slug, p);
                    const cardClass = `relative bg-white rounded-2xl p-4 border-2 transition group flex flex-col hover:shadow-md ${
                      cartItem ? "shadow-sm" : "border-transparent hover:border-gray-100"
                    }`;
                    const body = (
                      <>
                        <div className="aspect-square rounded-xl bg-gray-50 mb-3 flex items-center justify-center text-3xl font-black text-gray-200 overflow-hidden group-hover:bg-gray-100 transition">
                          {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : p.name[0]}
                        </div>
                        {p.category && <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{p.category}</span>}
                        <h3 className="text-sm font-bold text-gray-800 line-clamp-2 flex-1">{p.name}</h3>
                        {p.unit && <p className="text-[10px] text-gray-400 mt-0.5">{p.unit}</p>}
                        <div className="mt-3 flex items-center justify-between">
                          <span className="font-black text-gray-900">Rs. {p.price}</span>
                          {cartItem ? (
                            <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 p-0.5" onClick={stop}>
                              <button type="button" onClick={(e) => { stop(e); onUpdateQty(p.id, -1); }} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-600 text-lg font-bold transition">−</button>
                              <span className="text-xs font-black w-5 text-center">{cartItem.qty}</span>
                              <button type="button" onClick={(e) => { stop(e); onUpdateQty(p.id, 1); }} className="h-7 w-7 rounded-lg flex items-center justify-center text-white transition" style={{ backgroundColor: themeColor }}><Plus className="h-3 w-3" /></button>
                            </div>
                          ) : (
                            <button type="button" onClick={(e) => { stop(e); onAddToCart(p); }} className="h-8 w-8 rounded-xl flex items-center justify-center text-white transition active:scale-90" style={{ backgroundColor: themeColor }}>
                              <Plus className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </>
                    );
                    return href ? (
                      <Link key={p.id} href={href} className={cardClass} style={{ borderColor: cartItem ? themeColor + "80" : undefined }}>{body}</Link>
                    ) : (
                      <div key={p.id} className={cardClass} style={{ borderColor: cartItem ? themeColor + "80" : undefined }}>{body}</div>
                    );
                  })}
                </div>
              )}
            </section>
          );

          const aboutBlock = shop.description ? (
            <section key="about" className="bg-white rounded-2xl p-6 border border-gray-100">
              <h2 className="text-sm font-black text-gray-900 mb-2">About {shop.name}</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line">{shop.description}</p>
            </section>
          ) : null;

          const contactBlock = (shop.phone || shop.whatsapp_number || shop.address) ? (
            <section key="contact" className="bg-white rounded-2xl p-6 border border-gray-100">
              <h2 className="text-sm font-black text-gray-900 mb-3">Get in touch</h2>
              <div className="space-y-2 text-sm text-gray-700">
                {shop.phone && (
                  <a href={`tel:${shop.phone}`} className="flex items-center gap-2 hover:text-gray-900">
                    <Phone className="h-4 w-4" style={{ color: themeColor }} /> {shop.phone}
                  </a>
                )}
                {shop.whatsapp_number && (
                  <a href={`https://wa.me/${shop.whatsapp_number.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-gray-900">
                    <MessageCircle className="h-4 w-4" style={{ color: themeColor }} /> WhatsApp · {shop.whatsapp_number}
                  </a>
                )}
                {shop.address && (
                  <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: themeColor }} /> {shop.address}</p>
                )}
                {shop.opening_time && (
                  <p className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3.5 w-3.5" /> {shop.opening_time.slice(0, 5)} – {shop.closing_time?.slice(0, 5)}
                  </p>
                )}
              </div>
            </section>
          ) : null;

          const blocks: Record<string, React.ReactNode> = {
            featured: featuredBlock,
            products: productsBlock,
            about: aboutBlock,
            contact: contactBlock,
          };

          const requested = (shop.sections_order ?? []).filter((s) => BODY_SECTIONS.has(s));
          const order = requested.length ? requested.slice() : DEFAULT_BODY_ORDER.slice();
          // Always keep products in the output if the owner removed it (otherwise the storefront has no products)
          if (!order.includes("products")) order.push("products");

          return order.map((id) => blocks[id]).filter(Boolean);
        })()}
      </div>

      {/* Floating cart */}
      {itemCount > 0 && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-24 sm:w-auto z-20">
          <button
            onClick={onOpenCart}
            className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4 px-6 py-4 rounded-2xl text-white shadow-2xl font-bold transition active:scale-95"
            style={{ backgroundColor: themeColor }}
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
            </div>
            <span className="font-black">Rs. {total.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  );
}
