"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Barcode,
  Heart,
  MapPin,
  Package,
  ReceiptText,
  Store,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import type { User as SupabaseUser } from "@supabase/supabase-js";

import { toggleSavedShop, toggleSavedProduct, placeOrder } from "@/app/actions/customer";
import type { Order, Profile, SavedShop, SavedProduct, TrendingProduct, NearbyShop } from "@/lib/types";

import { OrderCard } from "./OrderCard";
import { ReceiptSheet } from "./ReceiptSheet";
import { BarcodeScanner } from "./BarcodeScanner";
import { WalletSection } from "./WalletSection";
import { EmptyState } from "./EmptyState";
import { Search, Store as StoreIcon } from "lucide-react";
import type { OrderItem, Transaction } from "@/lib/types";

interface HomeTabProps {
  user: SupabaseUser;
  profile: Profile | null;
  activeOrders: Order[];
  pastOrders: Order[];
  savedShops: SavedShop[];
  savedProducts: SavedProduct[];
  monthlySpend: number;
  totalOrderCount: number;
  pastOrderCount: number;
  addressCount: number;
  recentTransactions: Transaction[];
  trendingProducts: TrendingProduct[];
  nearbyShops: NearbyShop[];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeTab({
  user,
  profile,
  activeOrders,
  pastOrders,
  savedShops,
  savedProducts,
  monthlySpend,
  totalOrderCount,
  pastOrderCount,
  addressCount,
  recentTransactions,
  trendingProducts,
  nearbyShops,
}: HomeTabProps) {
  const router = useRouter();

  const [savedShopNames, setSavedShopNames] = useState<Set<string>>(
    new Set(savedShops.map((s) => s.shop_name))
  );
  const [savedProductIds, setSavedProductIds] = useState<Set<string>>(
    new Set(savedProducts.map((p) => p.product_id))
  );
  const [scannerOpen, setScannerOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // ── Reorder engine: top items by order frequency ───────────────────────────
  const topReorderItems = (() => {
    const freq: Record<string, { item: OrderItem & { shop: string }; count: number }> = {};
    for (const order of pastOrders) {
      for (const item of (order.items as OrderItem[])) {
        const key = `${item.name}::${order.shop_name}`;
        if (!freq[key]) {
          freq[key] = { item: { ...item, shop: order.shop_name }, count: 0 };
        }
        freq[key].count += item.quantity;
      }
    }
    return Object.values(freq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  })();

  const firstName =
    profile?.full_name?.split(" ")[0] ||
    user.email?.split("@")[0] ||
    "there";

  const handleToggleShop = async (shop: NearbyShop) => {
    const wasSaved = savedShopNames.has(shop.name);
    setSavedShopNames((prev) => {
      const s = new Set(prev);
      wasSaved ? s.delete(shop.name) : s.add(shop.name);
      return s;
    });
    toast(wasSaved ? "Removed from saved" : `${shop.name} saved`);
    await toggleSavedShop({
      shop_name: shop.name,
      shop_category: shop.category ?? null,
      shop_distance: null,
      shop_image: shop.image_url ?? null,
    });
  };

  const handleToggleProduct = async (product: TrendingProduct) => {
    const wasSaved = savedProductIds.has(product.id);
    setSavedProductIds((prev) => {
      const s = new Set(prev);
      wasSaved ? s.delete(product.id) : s.add(product.id);
      return s;
    });
    await toggleSavedProduct({
      product_id: product.id,
      product_name: product.name,
      product_price: String(product.price),
      product_image: product.image_url ?? null,
      product_shop: product.shop_name,
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Top Bento Grid Header ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Welcome Card */}
        <div className="md:col-span-8 flex flex-col justify-between rounded-[2rem] bg-white border border-[#2E3344]/8 p-6 md:p-8 relative overflow-hidden shadow-sm group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
             <Barcode className="h-32 w-32 rotate-12" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#27324A]">
              {getGreeting()}, <span className="text-[#A7653A]">{firstName}</span>.
            </h1>
            <p className="mt-2 text-base font-medium text-[#746E73] max-w-md">
              Your neighborhood is ready. Scan any product barcode to find local stock and order in minutes.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-4 items-center">
            <button
              onClick={() => setScannerOpen(true)}
              className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-[#27324A] px-8 text-sm font-bold text-white shadow-xl shadow-[#27324A]/15 transition hover:-translate-y-0.5 hover:bg-[#1b2333] active:scale-95"
            >
              <Barcode className="h-5 w-5" />
              Open Camera Scanner
            </button>
            <div className="flex gap-2">
              <div className="px-4 py-3 rounded-2xl bg-[#F7F0E6] flex flex-col justify-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8D5132] leading-none">Spent this month</p>
                <p className="text-lg font-bold text-[#27324A] mt-1">Rs. {monthlySpend.toLocaleString()}</p>
              </div>
              <div className="px-4 py-3 rounded-2xl bg-[#F7F0E6] flex flex-col justify-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8D5132] leading-none">Total orders</p>
                <p className="text-lg font-bold text-[#27324A] mt-1">{totalOrderCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Card - Compact Bento */}
        <div className="md:col-span-4 h-full">
           <WalletSection
            walletBalance={profile?.wallet_balance ?? 0}
            quivoCoins={profile?.quivo_coins ?? 0}
            recentTransactions={recentTransactions}
          />
        </div>
      </div>

      {/* ── Secondary Bento Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Active Orders Horizontal */}
          {activeOrders.length > 0 && (
            <section className="rounded-[2rem] bg-[#F7F0E6]/40 border border-[#A7653A]/10 p-6 md:p-8">
              <div className="mb-4 flex items-center justify-between px-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#8D5132]">
                  Live Shipments
                </h2>
                <span className="rounded-full bg-[#A7653A] px-2.5 py-0.5 text-xs font-bold text-white">
                  {activeOrders.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isActive
                    compact
                    onViewReceipt={setReceiptOrder}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Buy Again / Reorder Engine */}
          {topReorderItems.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between px-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#27324A]">
                  Weekly Essentials
                </h2>
                <Link
                  href="/dashboard/orders"
                  className="text-xs font-semibold text-[#A7653A] hover:underline"
                >
                  History
                </Link>
              </div>
              <div className="flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-none">
                {topReorderItems.map(({ item, count }) => (
                  <div
                    key={`${item.name}::${item.shop}`}
                    className="flex min-w-[180px] max-w-[180px] snap-start flex-col rounded-2xl border border-[#2E3344]/8 bg-white p-4 shadow-sm hover:shadow-md transition"
                  >
                    <div className="mb-3">
                       <span className="rounded-full bg-[#F7F0E6] px-2.5 py-1 text-[10px] font-bold text-[#A7653A]">
                        Ordered {count}×
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-[#A7653A] uppercase tracking-wider truncate">
                      {item.shop}
                    </p>
                    <h4 className="mt-1 flex-1 text-sm font-bold leading-tight text-[#27324A] line-clamp-2">
                      {item.name}
                    </h4>
                    <p className="mt-2 text-base font-bold text-[#27324A]">
                      Rs. {item.price.toLocaleString()}
                    </p>
                    <ReorderButton item={item} onSuccess={() => {
                      router.push("/dashboard/orders");
                      router.refresh();
                    }} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Neighborhood Pulse - Products + Shops from DB */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#27324A] px-2">
                Trending Nearby
              </h2>
              {trendingProducts.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No trends yet"
                  description="Products will appear here once local shops add their catalog."
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {trendingProducts.slice(0, 4).map((product) => {
                    const isSaved = savedProductIds.has(product.id);
                    return (
                      <div
                        key={product.id}
                        className="group flex flex-col rounded-2xl border border-[#2E3344]/8 bg-white p-3 shadow-sm hover:shadow-md transition"
                      >
                        <div className="relative mb-2 h-24 w-full overflow-hidden rounded-xl bg-[#F7F0E6]">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <span className="text-2xl font-black text-[#A7653A]/30">{product.name[0]}</span>
                            </div>
                          )}
                          <button
                            onClick={() => handleToggleProduct(product)}
                            className={`absolute right-1.5 top-1.5 rounded-full p-1.5 backdrop-blur-md transition ${
                              isSaved ? "bg-[#A7653A] text-white" : "bg-white/60 text-[#746E73] hover:text-[#A7653A]"
                            }`}
                          >
                            <Heart className={`h-3 w-3 ${isSaved ? "fill-current" : ""}`} />
                          </button>
                        </div>
                        <h4 className="line-clamp-1 text-[11px] font-bold text-[#27324A]">{product.name}</h4>
                        <p className="text-[10px] font-semibold text-[#A7653A]">Rs. {product.price.toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#27324A] px-2">
                Verified Shops
              </h2>
              {nearbyShops.length === 0 ? (
                <EmptyState
                  icon={StoreIcon}
                  title="No shops yet"
                  description="Shops will appear here once they join the neighborhood."
                />
              ) : (
                <div className="space-y-2">
                  {nearbyShops.slice(0, 3).map((shop) => {
                    const isSaved = savedShopNames.has(shop.name);
                    return (
                      <div
                        key={shop.id}
                        className="flex items-center gap-3 rounded-2xl border border-[#2E3344]/8 bg-white p-3 shadow-sm hover:border-[#A7653A]/20 transition"
                      >
                        <div className="h-10 w-10 rounded-xl bg-[#F7F0E6] overflow-hidden shrink-0 flex items-center justify-center">
                          {shop.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={shop.image_url} alt={shop.name} className="h-10 w-10 object-cover" />
                          ) : (
                            <span className="text-sm font-black text-[#A7653A]">{shop.name[0]}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-[#27324A]">{shop.name}</p>
                          <p className="text-[10px] text-[#746E73]">{shop.category ?? "Shop"}</p>
                        </div>
                        <button
                          onClick={() => handleToggleShop(shop)}
                          className={`shrink-0 rounded-full p-1.5 transition ${
                            isSaved ? "bg-[#A7653A] text-white" : "bg-[#F7F0E6] text-[#746E73] hover:text-[#A7653A]"
                          }`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${isSaved ? "fill-current" : ""}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Manage Sidebar - Right Column */}
        <aside className="lg:col-span-4 space-y-6">
           {/* Quick Actions Panel */}
           <div className="rounded-[2rem] bg-[#27324A] p-6 md:p-8 text-white shadow-xl shadow-[#27324A]/10">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#D8C99A] mb-5">
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { Icon: ReceiptText, label: "History", href: "/dashboard/orders" },
                  { Icon: Bookmark, label: "Wishlist", href: "/dashboard/saved" },
                  { Icon: MapPin, label: "Map Pins", href: "/dashboard/profile" },
                  { Icon: Store, label: "All Shops", href: "/dashboard/shops" },
                ].map(({ Icon, label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 p-4 transition hover:bg-white/10 active:scale-95"
                  >
                    <Icon className="h-5 w-5 text-[#D8C99A]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
                  </Link>
                ))}
              </div>
           </div>

           {/* Membership / Stats Badge */}
           <div className="rounded-[2rem] bg-gradient-to-br from-[#F7F0E6] to-[#EFE5D6] p-6 md:p-8 border border-[#2E3344]/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Package className="h-5 w-5 text-[#A7653A]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8D5132]">Member Activity</p>
                  <p className="text-sm font-bold text-[#27324A]">{pastOrderCount} completed orders</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[#2E3344]/5 flex items-center justify-between">
                 <div className="text-center">
                    <p className="text-[10px] font-bold text-[#746E73] uppercase">Addresses</p>
                    <p className="text-lg font-bold text-[#27324A]">{addressCount}</p>
                 </div>
                 <div className="text-center border-l border-r border-[#2E3344]/10 px-6">
                    <p className="text-[10px] font-bold text-[#746E73] uppercase">Saved</p>
                    <p className="text-lg font-bold text-[#27324A]">{savedProductIds.size}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[10px] font-bold text-[#746E73] uppercase">Items</p>
                    <p className="text-lg font-bold text-[#27324A]">{totalOrderCount}</p>
                 </div>
              </div>
           </div>
        </aside>
      </div>

      {/* Barcode scanner overlay */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />

      {/* Receipt sheet for active orders on home */}
      <ReceiptSheet order={receiptOrder} onClose={() => setReceiptOrder(null)} />
    </div>
  );
}

// ── Reorder button (needs its own state, so extracted) ─────────────────────
function ReorderButton({
  item,
  onSuccess,
}: {
  item: OrderItem & { shop: string };
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const handleReorder = async () => {
    setLoading(true);
    try {
      const result = await placeOrder({
        shop_name: item.shop,
        items: [{ name: item.name, price: item.price, quantity: 1 }],
        eta_minutes: 20,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Reordered from ${item.shop}`);
        onSuccess();
      }
    } catch {
      toast.error("Could not place order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReorder}
      disabled={loading}
      className="mt-2.5 w-full rounded-xl bg-[#F7F0E6] py-2 text-xs font-semibold text-[#27324A] transition hover:bg-[#A7653A] hover:text-white disabled:opacity-50 active:scale-95"
    >
      {loading ? "Ordering…" : "Order again"}
    </button>
  );
}
