"use client";

import Link from "next/link";
import {
  Search,
  ShoppingBag,
  Plus,
  ArrowRight,
  MapPin,
  Phone,
  MessageCircle,
} from "lucide-react";
import type { TemplateProps } from "./types";
import { productHref, stopCardClick as stop } from "./cardHelpers";

const BODY_SECTIONS = new Set(["featured", "products", "about", "contact"]);
const DEFAULT_BODY_ORDER = ["products", "about", "contact"];

export function BoutiqueTemplate({
  shop,
  products,
  cart,
  onAddToCart,
  onUpdateQty,
  onOpenCart,
  searchQuery,
  setSearchQuery,
  activeCategory,
  setActiveCategory,
}: TemplateProps) {
  const themeColor = shop.theme_color || "#27324A";
  const itemCount = cart.reduce((a, b) => a + b.qty, 0);
  const total = cart.reduce((a, b) => a + b.price * b.qty, 0);
  const shopInitial = shop.name[0]?.toUpperCase() ?? "S";

  const categories = [
    "All",
    ...Array.from(
      new Set(products.map((p) => p.category).filter(Boolean) as string[]),
    ),
  ];
  const filtered = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.brand ?? "").toLowerCase().includes(q);
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <div
      className="min-h-screen bg-[#fafaf8] pb-28"
      style={{ fontFamily: "'Playfair Display', serif" }}
    >
      {/* Announcement */}
      {shop.announcement_active && shop.announcement_text && (
        <div className="text-center text-xs font-medium py-3 px-4 bg-[#f0ebe0] text-gray-700 tracking-wider uppercase">
          {shop.announcement_text}
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ minHeight: "360px" }}>
        {shop.cover_image_url ? (
          <img
            src={shop.cover_image_url}
            alt={shop.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(160deg, ${themeColor} 0%, ${themeColor}99 60%, #f0ebe0 100%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 flex flex-col items-center justify-center text-center text-white px-6 py-20">
          <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center font-black text-3xl mb-5 overflow-hidden">
            {shop.logo_url ? (
              <img
                src={shop.logo_url}
                alt={shop.name}
                className="h-full w-full object-cover"
              />
            ) : (
              shopInitial
            )}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            {shop.hero_headline || shop.name}
          </h1>
          {shop.hero_subtext && (
            <p className="mt-3 text-white/80 text-lg max-w-md">
              {shop.hero_subtext}
            </p>
          )}
          {shop.description && (
            <p className="mt-2 text-white/60 text-sm max-w-sm">
              {shop.description}
            </p>
          )}
          <div
            className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-white/70 font-medium"
            style={{ fontFamily: "DM Sans, sans-serif" }}
          >
            {shop.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {shop.address}
              </span>
            )}
            {shop.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {shop.phone}
              </span>
            )}
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

      {/* Body sections rendered in owner's chosen order */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-12">
        {(() => {
          const productsBlock = (
            <section key="products">
              {filtered.length === 0 ? (
                <div
                  className="text-center py-16 text-gray-400"
                  style={{ fontFamily: "DM Sans, sans-serif" }}
                >
                  <ShoppingBag className="h-12 w-12 mx-auto opacity-20 mb-3" />
                  <p className="font-medium">Nothing found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  {filtered.map((p) => {
                    const cartItem = cart.find((c) => c.id === p.id);
                    const href = productHref(shop.slug, p);
                    const cardCls =
                      "bg-white border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col overflow-hidden rounded-2xl group";
                    const body = (
                      <>
                        <div className="aspect-[3/4] bg-[#f8f5ef] flex items-center justify-center font-black text-5xl text-gray-200 overflow-hidden relative">
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <span className="opacity-30">{p.name[0]}</span>
                          )}
                          {cartItem && (
                            <span
                              className="absolute top-3 right-3 h-6 w-6 rounded-full text-white text-[10px] font-black flex items-center justify-center shadow"
                              style={{ backgroundColor: themeColor }}
                            >
                              {cartItem.qty}
                            </span>
                          )}
                        </div>
                        <div
                          className="p-4 flex flex-col flex-1"
                          style={{ fontFamily: "DM Sans, sans-serif" }}
                        >
                          {p.brand && (
                            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                              {p.brand}
                            </span>
                          )}
                          <h3 className="text-sm font-bold text-gray-900 line-clamp-2 flex-1">
                            {p.name}
                          </h3>
                          {p.unit && (
                            <p className="text-[10px] text-gray-400 mt-1">
                              {p.unit}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">
                                Rs. {p.price}
                              </span>
                              {p.original_price && (
                                <span className="text-xs text-gray-400 line-through font-medium">
                                  Rs. {p.original_price}
                                </span>
                              )}
                            </div>
                            {cartItem ? (
                              <div
                                className="flex items-center gap-1 bg-gray-50 rounded-xl border border-gray-200 p-0.5"
                                onClick={stop}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    stop(e);
                                    onUpdateQty(p.id, -1);
                                  }}
                                  className="h-6 w-6 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 transition font-bold"
                                >
                                  −
                                </button>
                                <span className="text-xs font-black w-4 text-center">
                                  {cartItem.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    stop(e);
                                    onUpdateQty(p.id, 1);
                                  }}
                                  className="h-6 w-6 rounded-lg flex items-center justify-center text-white transition"
                                  style={{ backgroundColor: themeColor }}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  stop(e);
                                  onAddToCart(p);
                                }}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1 transition active:scale-95"
                                style={{ backgroundColor: themeColor }}
                              >
                                Add <ArrowRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    );
                    return href ? (
                      <Link key={p.id} href={href} className={cardCls}>
                        {body}
                      </Link>
                    ) : (
                      <div key={p.id} className={cardCls}>
                        {body}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );

          const aboutBlock = shop.description ? (
            <section
              key="about"
              className="text-center px-2"
              style={{ fontFamily: "DM Sans, sans-serif" }}
            >
              <h2 className="text-[11px] uppercase tracking-[0.3em] text-gray-400 font-bold mb-3">
                About the house
              </h2>
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line max-w-xl mx-auto">
                {shop.description}
              </p>
            </section>
          ) : null;

          const contactBlock =
            shop.phone || shop.whatsapp_number || shop.address ? (
              <section
                key="contact"
                className="border-t border-gray-100 pt-8 text-sm text-gray-700"
                style={{ fontFamily: "DM Sans, sans-serif" }}
              >
                <h2 className="text-[11px] uppercase tracking-[0.3em] text-gray-400 font-bold mb-4 text-center">
                  Visit us
                </h2>
                <div className="grid sm:grid-cols-3 gap-4 text-center">
                  {shop.address && (
                    <div className="flex flex-col items-center gap-1.5">
                      <MapPin
                        className="h-4 w-4"
                        style={{ color: themeColor }}
                      />
                      <span className="text-xs">{shop.address}</span>
                    </div>
                  )}
                  {shop.phone && (
                    <a
                      href={`tel:${shop.phone}`}
                      className="flex flex-col items-center gap-1.5 hover:text-gray-900"
                    >
                      <Phone
                        className="h-4 w-4"
                        style={{ color: themeColor }}
                      />
                      <span className="text-xs">{shop.phone}</span>
                    </a>
                  )}
                  {shop.whatsapp_number && (
                    <a
                      href={`https://wa.me/${shop.whatsapp_number.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 hover:text-gray-900"
                    >
                      <MessageCircle
                        className="h-4 w-4"
                        style={{ color: themeColor }}
                      />
                      <span className="text-xs">
                        WhatsApp · {shop.whatsapp_number}
                      </span>
                    </a>
                  )}
                </div>
              </section>
            ) : null;

          const blocks: Record<string, React.ReactNode> = {
            products: productsBlock,
            about: aboutBlock,
            contact: contactBlock,
          };

          const requested = (shop.sections_order ?? []).filter((s) =>
            BODY_SECTIONS.has(s),
          );
          const order = requested.length
            ? requested.slice()
            : DEFAULT_BODY_ORDER.slice();
          if (!order.includes("products")) order.push("products");
          return order.map((id) => blocks[id]).filter(Boolean);
        })()}
      </div>

      {/* Cart button */}
      {itemCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20 px-4">
          <button
            onClick={onOpenCart}
            className="flex items-center gap-4 px-6 py-3.5 rounded-full text-white shadow-2xl font-bold transition active:scale-95"
            style={{
              backgroundColor: themeColor,
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            <ShoppingBag className="h-5 w-5" />
            <span>
              {itemCount} item{itemCount !== 1 ? "s" : ""} · Rs.{" "}
              {total.toLocaleString()}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
