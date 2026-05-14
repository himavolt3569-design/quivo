"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingCart, Phone, ChevronLeft, ChevronRight, Package } from "lucide-react";

interface ProductData {
  product_id: string;
  shop_id: string;
  shop_slug: string;
  shop_name: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string | null;
  variant: string | null;
  description: string | null;
  price: number;
  stock: number;
  images: string[] | null;
  image_url: string | null;
  barcode: string;
}

interface ShopData {
  id: string;
  name: string;
  slug: string;
  theme_color: string | null;
  logo_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
}

interface ProductViewProps {
  product: ProductData;
  shop: ShopData;
}

export function ProductView({ product, shop }: ProductViewProps) {
  const color = shop.theme_color ?? "#A7653A";
  const allImages = product.images?.length ? product.images : (product.image_url ? [product.image_url] : []);
  const [currentImage, setCurrentImage] = useState(0);
  const [qty, setQty] = useState(1);
  const inStock = product.stock > 0;

  const whatsappNumber = (shop.whatsapp_number ?? shop.phone ?? "").replace(/\D/g, "");
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const whatsappMsg = encodeURIComponent(
    `Hi! I want to order *${product.name}* (x${qty}) — Rs. ${product.price * qty}\nFrom: ${shop.name} — ${currentUrl}`
  );

  return (
    <div className="min-h-screen bg-[#f8f8f7]">
      {/* Header */}
      <div className="bg-white border-b border-black/5 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/s/${shop.slug}`} className="h-9 w-9 rounded-full bg-[#f8f8f7] flex items-center justify-center hover:bg-black/5 transition">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          {shop.logo_url ? (
            <img src={shop.logo_url} alt={shop.name} className="h-8 w-8 rounded-full object-cover" />
          ) : null}
          <span className="font-black text-gray-900 text-sm">{shop.name}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Image Carousel */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
          {allImages.length > 0 ? (
            <div className="relative">
              <img
                src={allImages[currentImage]}
                alt={product.name}
                className="w-full aspect-square object-cover"
              />
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImage((i) => (i - 1 + allImages.length) % allImages.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentImage((i) => (i + 1) % allImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImage(i)}
                        className={`rounded-full transition ${i === currentImage ? "h-2 w-5 bg-white" : "h-2 w-2 bg-white/50"}`}
                      />
                    ))}
                  </div>
              </>
              )}

              {/* Thumbnail row */}
              {allImages.length > 1 && (
                <div className="flex gap-2 p-3 border-t border-black/5 bg-[#f8f8f7]">
                  {allImages.map((img, i) => (
                    <button key={i} onClick={() => setCurrentImage(i)}
                      className={`h-14 w-14 rounded-xl overflow-hidden border-2 transition ${i === currentImage ? "border-[var(--accent)]" : "border-transparent"}`}
                      style={{ "--accent": color } as React.CSSProperties}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full aspect-square bg-[#f0ede8] flex items-center justify-center">
              <Package className="h-20 w-20 text-gray-300" />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
          <div>
            {product.category && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full" style={{ backgroundColor: `${color}15`, color }}>
                {product.category}
              </span>
            )}
            <h1 className="text-2xl font-black text-gray-900 mt-2">{product.name}</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              {product.brand && <span className="text-sm text-gray-500 font-medium">{product.brand}</span>}
              {product.unit && <span className="text-sm text-gray-400">• {product.unit}</span>}
              {product.variant && <span className="text-sm text-gray-400">• {product.variant}</span>}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-3xl font-black text-gray-900">Rs. {product.price.toLocaleString()}</p>
            {inStock ? (
              <span className="text-xs font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-100">In Stock</span>
            ) : (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">Out of Stock</span>
            )}
          </div>

          {product.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
          )}
        </div>

        {/* Order section */}
        {inStock && (
          <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-black text-gray-900">Quantity</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="h-9 w-9 rounded-xl border border-black/10 flex items-center justify-center text-gray-600 hover:bg-black/5 font-bold text-lg"
                >
                  −
                </button>
                <span className="w-8 text-center font-black text-gray-900 text-lg">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                  className="h-9 w-9 rounded-xl border border-black/10 flex items-center justify-center text-gray-600 hover:bg-black/5 font-bold text-lg"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Total</span>
              <span className="font-black text-gray-900 text-lg">Rs. {(product.price * qty).toLocaleString()}</span>
            </div>

            <div className="space-y-3 pt-1">
              {/* Full storefront order */}
              <Link
                href={`/s/${shop.slug}?add=${product.product_id}&qty=${qty}`}
                className="flex items-center justify-center gap-2 w-full h-13 py-3.5 rounded-2xl font-black text-white text-sm transition hover:opacity-90"
                style={{ backgroundColor: color }}
              >
                <ShoppingCart className="h-5 w-5" />
                Order from {shop.name}
              </Link>

              {/* WhatsApp shortcut */}
              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl font-bold text-sm border-2 transition hover:bg-green-50"
                  style={{ borderColor: "#25D366", color: "#25D366" }}
                >
                  <Phone className="h-4 w-4" />
                  Order via WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

        {/* Shop link */}
        <div className="text-center pb-4">
          <Link
            href={`/s/${shop.slug}`}
            className="text-xs font-bold hover:underline"
            style={{ color }}
          >
            Browse all products from {shop.name} →
          </Link>
        </div>
      </div>
    </div>
  );
}
