"use client";

import { useState } from "react";
import {
  Heart,
  Store,
  Trash2,
  ShoppingBag,
  Bookmark,
  TrendingDown,
  Package,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  toggleSavedShop,
  toggleSavedProduct,
  placeOrder,
} from "@/app/actions/customer";
import type { SavedShop, SavedProduct, Order } from "@/lib/types";

interface SavedItemsProps {
  savedShops: SavedShop[];
  savedProducts: SavedProduct[];
  onShopsChange?: (shops: SavedShop[]) => void;
  onProductsChange?: (products: SavedProduct[]) => void;
  onOrderPlaced?: (order: Order) => void;
}

type SubTab = "wishlist" | "shops";

function parsePrice(raw: string | null | undefined): number {
  return parseFloat((raw ?? "0").replace(/[^0-9.]/g, "")) || 0;
}

export function SavedItems({
  savedShops,
  savedProducts,
  onShopsChange,
  onProductsChange,
  onOrderPlaced,
}: SavedItemsProps) {
  const [subTab, setSubTab] = useState<SubTab>("wishlist");
  const [removingShop, setRemovingShop] = useState<string | null>(null);
  const [removingProduct, setRemovingProduct] = useState<string | null>(null);
  const [orderingProduct, setOrderingProduct] = useState<string | null>(null);
  const [orderingShop, setOrderingShop] = useState<string | null>(null);

  // ─── Derived wishlist data ───────────────────────────────────────────────
  const totalWishlistValue = savedProducts.reduce(
    (sum, p) => sum + parsePrice(p.product_price),
    0,
  );

  const productsByShop = savedProducts.reduce<Record<string, SavedProduct[]>>(
    (acc, p) => {
      const key = p.product_shop ?? "Other";
      (acc[key] ??= []).push(p);
      return acc;
    },
    {},
  );

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleRemoveShop = async (shop: SavedShop) => {
    setRemovingShop(shop.shop_name);
    try {
      await toggleSavedShop({ shop_name: shop.shop_name });
      onShopsChange?.(savedShops.filter((s) => s.shop_name !== shop.shop_name));
      toast.success(`${shop.shop_name} removed`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setRemovingShop(null);
    }
  };

  const handleRemoveProduct = async (product: SavedProduct) => {
    setRemovingProduct(product.product_id);
    try {
      await toggleSavedProduct({
        product_id: product.product_id,
        product_name: product.product_name,
      });
      onProductsChange?.(
        savedProducts.filter((p) => p.product_id !== product.product_id),
      );
      toast.success(`${product.product_name} removed from wishlist`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setRemovingProduct(null);
    }
  };

  const handleReorderOne = async (product: SavedProduct) => {
    if (!product.product_shop) {
      toast.error("Shop information not available");
      return;
    }
    setOrderingProduct(product.product_id);
    try {
      const result = await placeOrder({
        shop_name: product.product_shop,
        items: [
          {
            name: product.product_name,
            price: parsePrice(product.product_price),
            quantity: 1,
            image: product.product_image ?? undefined,
          },
        ],
        eta_minutes: 20,
      });
      if (result.error) {
        toast.error(result.error);
      } else if (result.order) {
        onOrderPlaced?.(result.order as Order);
        toast.success(`Order placed at ${product.product_shop}`);
      }
    } catch {
      toast.error("Could not place order");
    } finally {
      setOrderingProduct(null);
    }
  };

  const handleOrderAllFromShop = async (
    shopName: string,
    products: SavedProduct[],
  ) => {
    setOrderingShop(shopName);
    try {
      const items = products.map((p) => ({
        name: p.product_name,
        price: parsePrice(p.product_price),
        quantity: 1,
        image: p.product_image ?? undefined,
      }));
      const result = await placeOrder({
        shop_name: shopName,
        items,
        eta_minutes: 20,
      });
      if (result.error) {
        toast.error(result.error);
      } else if (result.order) {
        onOrderPlaced?.(result.order as Order);
        toast.success(
          `${items.length} item${items.length !== 1 ? "s" : ""} ordered from ${shopName}`,
        );
      }
    } catch {
      toast.error("Could not place order");
    } finally {
      setOrderingShop(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ── Sub-tab Switcher Bento ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex gap-1 p-1 bg-[#E8E3D1]/40 rounded-full w-fit">
          {(["wishlist", "shops"] as SubTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition ${
                subTab === t
                  ? "bg-white text-[#27324A] shadow-sm"
                  : "text-[#746E73] hover:text-[#27324A]"
              }`}
            >
              {t === "wishlist" ? (
                <Bookmark className="h-3.5 w-3.5" />
              ) : (
                <Store className="h-3.5 w-3.5" />
              )}
              {t === "wishlist" ? "My Wishlist" : "Favorite Shops"}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#A7653A] bg-[#F7F0E6] px-3 py-1.5 rounded-full">
          {subTab === "wishlist"
            ? `${savedProducts.length} items`
            : `${savedShops.length} stores`}
        </p>
      </div>

      {/* ── Wishlist Tab ───────────────────────────────────────────────────── */}
      {subTab === "wishlist" && (
        <div className="space-y-6">
          {savedProducts.length === 0 ? (
            <div className="rounded-[2.5rem] border border-dashed border-[#2E3344]/15 bg-white/50 p-16 text-center">
              <div className="mx-auto mb-4 h-16 w-16 grid place-items-center rounded-2xl bg-[#F7F0E6] text-[#A7653A]">
                <Bookmark className="h-8 w-8" />
              </div>
              <p className="text-base font-bold text-[#27324A]">
                Your wishlist is empty
              </p>
              <p className="mt-1 text-sm text-[#746E73] max-w-xs mx-auto">
                Save products while browsing to keep track of your neighborhood
                favorites.
              </p>
            </div>
          ) : (
            <>
              {/* Wishlist Bento Summary */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 rounded-[2.5rem] bg-[#27324A] p-8 text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.05]">
                    <Bookmark className="h-32 w-32 rotate-12" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                      Estimated Total
                    </p>
                    <p className="text-4xl font-black mt-2">
                      Rs. {totalWishlistValue.toLocaleString()}
                    </p>
                    <p className="mt-4 text-sm text-white/70 font-medium">
                      Ready to restock? You have items from{" "}
                      <span className="text-[#D8C99A] font-bold">
                        {Object.keys(productsByShop).length} local shops
                      </span>{" "}
                      in your list.
                    </p>
                  </div>
                </div>
                <div className="md:col-span-4 rounded-[2.5rem] bg-[#F7F0E6] border border-[#A7653A]/10 p-8 flex flex-col justify-center text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#8D5132]">
                    Quick Action
                  </p>
                  <button
                    onClick={() =>
                      handleOrderAllFromShop(
                        Object.keys(productsByShop)[0],
                        Object.values(productsByShop)[0],
                      )
                    }
                    className="mt-4 py-4 rounded-full bg-[#A7653A] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-[#A7653A]/20 hover:bg-[#8E5432] transition active:scale-95"
                  >
                    Order Top Shop
                  </button>
                </div>
              </div>

              {/* Grouped by shop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(productsByShop).map(([shopName, products]) => {
                  const shopTotal = products.reduce(
                    (sum, p) => sum + parsePrice(p.product_price),
                    0,
                  );
                  const isOrderingThisShop = orderingShop === shopName;

                  return (
                    <div
                      key={shopName}
                      className="rounded-[2.25rem] border border-[#2E3344]/8 bg-white overflow-hidden shadow-sm flex flex-col"
                    >
                      {/* Shop header */}
                      <div className="px-6 py-5 border-b border-[#2E3344]/6 bg-[#F7F0E6]/30 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#A7653A]">
                            {shopName}
                          </p>
                          <p className="text-xs font-bold text-[#27324A] mt-0.5">
                            {products.length} Items · Rs.{" "}
                            {shopTotal.toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleOrderAllFromShop(shopName, products)
                          }
                          disabled={isOrderingThisShop}
                          className="h-10 w-10 rounded-xl bg-[#27324A] text-white flex items-center justify-center hover:bg-[#1B2030] disabled:opacity-50 transition active:scale-95"
                        >
                          <ShoppingBag className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Products in this shop */}
                      <div className="p-4 space-y-3 flex-1">
                        {products.map((product) => (
                          <div
                            key={product.product_id}
                            className="flex items-center gap-3 p-2 rounded-2xl border border-transparent hover:border-[#2E3344]/8 hover:bg-[#F7F0E6]/20 transition"
                          >
                            <div className="h-14 w-14 rounded-2xl bg-[#F7F0E6] overflow-hidden flex-shrink-0">
                              {product.product_image ? (
                                <img
                                  src={product.product_image}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-[#A7653A]">
                                  <Package className="h-5 w-5" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-[#27324A] truncate">
                                {product.product_name}
                              </p>
                              <p className="text-sm font-black text-[#A7653A] mt-0.5">
                                {product.product_price ?? "–"}
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleReorderOne(product)}
                                disabled={
                                  orderingProduct === product.product_id ||
                                  isOrderingThisShop
                                }
                                className="h-9 px-4 rounded-full bg-[#F7F0E6] text-[11px] font-bold text-[#27324A] hover:bg-[#A7653A] hover:text-white transition active:scale-95 disabled:opacity-30"
                              >
                                {orderingProduct === product.product_id
                                  ? "…"
                                  : "Order"}
                              </button>
                              <button
                                onClick={() => handleRemoveProduct(product)}
                                className="h-9 w-9 rounded-full flex items-center justify-center text-[#746E73]/40 hover:text-red-500 hover:bg-red-50 transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Saved Shops Tab ──────────────────────────────────────────────── */}
      {subTab === "shops" && (
        <div className="space-y-6">
          {savedShops.length === 0 ? (
            <div className="rounded-[2.5rem] border border-dashed border-[#2E3344]/15 bg-white/50 p-16 text-center">
              <div className="mx-auto mb-4 h-16 w-16 grid place-items-center rounded-2xl bg-[#F7F0E6] text-[#A7653A]">
                <Store className="h-8 w-8" />
              </div>
              <p className="text-base font-bold text-[#27324A]">
                No saved shops
              </p>
              <p className="mt-1 text-sm text-[#746E73]">
                Heart your favorite neighborhood stores to see them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedShops.map((shop) => (
                <div
                  key={shop.shop_name}
                  className="group relative flex flex-col rounded-[2.25rem] border border-[#2E3344]/8 bg-white p-5 shadow-sm hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-[#E8E3D1] overflow-hidden flex-shrink-0">
                      {shop.shop_image ? (
                        <img
                          src={shop.shop_image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[#626A54]">
                          <Store className="h-7 w-7" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-bold text-[#27324A] truncate">
                        {shop.shop_name}
                      </h4>
                      <p className="text-xs font-bold text-[#A7653A] mt-0.5">
                        {shop.shop_category}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#2E3344]/5 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#746E73]">
                      {shop.shop_distance}km away
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveShop(shop);
                        }}
                        className="h-9 w-9 rounded-full bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition"
                      >
                        <Heart className="h-4 w-4 fill-current" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-[#746E73]/40 group-hover:text-[#A7653A] transition group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
