"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingCart,
  Phone,
  ChevronLeft,
  ChevronRight,
  Package,
  PackageX,
} from "lucide-react";
import { toast } from "sonner";
import { StarRating } from "@/components/ui/StarRating";
import { SaveProductButton } from "@/components/storefront/SaveProductButton";
import type { PublicReview } from "@/app/actions/reviews";

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
  is_available?: boolean;
  average_rating?: number;
  review_count?: number;
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

export interface SimilarProduct {
  product_id: string;
  shop_slug: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string | null;
  variant: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  images: string[] | null;
  barcode: string;
}

interface ProductViewProps {
  product: ProductData;
  shop: ShopData;
  similar?: SimilarProduct[];
  reviews?: PublicReview[];
  initialSaved?: boolean;
}

export function ProductView({
  product,
  shop,
  similar = [],
  reviews = [],
  initialSaved = false,
}: ProductViewProps) {
  const color = shop.theme_color ?? "#A7653A";
  const allImages = product.images?.length
    ? product.images
    : product.image_url
      ? [product.image_url]
      : [];
  const [currentImage, setCurrentImage] = useState(0);
  const [qty, setQty] = useState(1);
  const isAvailable = product.is_available !== false; // default true if not provided
  const inStock = isAvailable && product.stock > 0;

  const whatsappNumber = (shop.whatsapp_number ?? shop.phone ?? "").replace(
    /\D/g,
    "",
  );
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const whatsappMsg = encodeURIComponent(
    `Hi! I want to order *${product.name}* (x${qty}) — Rs. ${product.price * qty}\nFrom: ${shop.name} — ${currentUrl}`,
  );

  return (
    <div className="min-h-screen bg-[#f8f8f7]">
      {/* Header */}
      <div className="bg-white border-b border-black/5 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href={`/s/${shop.slug}`}
            className="h-9 w-9 rounded-full bg-[#f8f8f7] flex items-center justify-center hover:bg-black/5 transition"
          >
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          {shop.logo_url ? (
            <img
              src={shop.logo_url}
              alt={shop.name}
              className="h-8 w-8 rounded-full object-cover"
            />
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
                    onClick={() =>
                      setCurrentImage(
                        (i) => (i - 1 + allImages.length) % allImages.length,
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImage((i) => (i + 1) % allImages.length)
                    }
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
                    <button
                      key={i}
                      onClick={() => setCurrentImage(i)}
                      className={`h-14 w-14 rounded-xl overflow-hidden border-2 transition ${i === currentImage ? "border-[var(--accent)]" : "border-transparent"}`}
                      style={{ "--accent": color } as React.CSSProperties}
                    >
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover"
                      />
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
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {product.category}
              </span>
            )}
            <h1 className="text-2xl font-black text-gray-900 mt-2">
              {product.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {product.brand && (
                <span className="text-sm text-gray-500 font-medium">
                  {product.brand}
                </span>
              )}
              {product.unit && (
                <span className="text-sm text-gray-400">• {product.unit}</span>
              )}
              {product.variant && (
                <span className="text-sm text-gray-400">
                  • {product.variant}
                </span>
              )}
              {(product.review_count ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1">
                  <StarRating
                    value={product.average_rating ?? 0}
                    count={product.review_count}
                    size="sm"
                  />
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-3xl font-black text-gray-900">
              Rs. {product.price.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <SaveProductButton
                productId={product.product_id}
                initialSaved={initialSaved}
                size="md"
              />
              {!isAvailable ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                  <PackageX className="h-3 w-3" /> Not Available
                </span>
              ) : inStock ? (
                <span className="text-xs font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                  In Stock
                </span>
              ) : (
                <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                  Out of Stock
                </span>
              )}
            </div>
          </div>

          {product.description && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {product.description}
            </p>
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
                <span className="w-8 text-center font-black text-gray-900 text-lg">
                  {qty}
                </span>
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
              <span className="font-black text-gray-900 text-lg">
                Rs. {(product.price * qty).toLocaleString()}
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {/* Full storefront order */}
              <div className="flex gap-3">
                <Link
                  href={`/s/${shop.slug}?add=${product.product_id}&qty=${qty}`}
                  onClick={() => toast.success("Added to cart")}
                  className="flex flex-1 items-center justify-center gap-2 h-13 py-3.5 rounded-2xl font-black text-sm transition border-2 hover:bg-black/5"
                  style={{ borderColor: color, color }}
                >
                  <ShoppingCart className="h-5 w-5" />
                  Add to Cart
                </Link>
                <Link
                  href={`/s/${shop.slug}?add=${product.product_id}&qty=${qty}&checkout=true`}
                  className="flex flex-1 items-center justify-center gap-2 h-13 py-3.5 rounded-2xl font-black text-white text-sm transition hover:opacity-90 shadow-sm"
                  style={{ backgroundColor: color }}
                >
                  Buy Now
                </Link>
              </div>

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

        {/* More like this */}
        {similar.length > 0 && (
          <section className="space-y-3 pt-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-base font-black text-gray-900">
                More like this
              </h2>
              <Link
                href={`/s/${shop.slug}`}
                className="text-[11px] font-bold hover:underline"
                style={{ color }}
              >
                See all →
              </Link>
            </div>
            <p className="text-xs text-gray-500 px-1 -mt-1.5">
              Other products from {shop.name}
              {product.category && (
                <>
                  {" "}
                  in{" "}
                  <span className="font-bold text-gray-700">
                    {product.category}
                  </span>
                </>
              )}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {similar.map((p) => {
                const thumb = p.images?.[0] ?? p.image_url;
                return (
                  <Link
                    key={p.product_id}
                    href={`/s/${p.shop_slug}/product/${p.barcode}`}
                    className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition active:scale-[0.98]"
                  >
                    <div className="aspect-square bg-[#f0ede8] overflow-hidden">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-9 w-9 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-1">
                      {p.brand && (
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 truncate">
                          {p.brand}
                        </p>
                      )}
                      <p className="text-xs font-black text-gray-900 leading-tight line-clamp-2 min-h-[2rem]">
                        {p.name}
                      </p>
                      <div className="flex items-baseline justify-between gap-1 pt-0.5">
                        <span className="text-sm font-black text-gray-900">
                          Rs. {p.price.toLocaleString()}
                        </span>
                        {p.unit && (
                          <span className="text-[10px] text-gray-400 truncate">
                            {p.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-700">
                Reviews
              </h2>
              <StarRating
                value={product.average_rating ?? 0}
                count={product.review_count}
                size="md"
              />
            </div>
            <ul className="space-y-3">
              {reviews.slice(0, 8).map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-black/5 p-3 bg-[#f8f8f7]"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-full bg-[#27324A] text-white text-[11px] font-black flex items-center justify-center">
                      {r.reviewer_initial}
                    </span>
                    <StarRating value={r.rating} size="sm" />
                    <span className="text-[11px] text-gray-400 ml-auto">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {r.body && (
                    <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                      {r.body}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
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
