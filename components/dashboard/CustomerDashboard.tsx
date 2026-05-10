"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Barcode,
  Heart,
  Home,
  Package,
  Store,
  User,
  MapPin,
  Clock,
  ReceiptText,
  Wallet,
  TrendingUp,
  X,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { User as SupabaseUser } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { nearbyShops, popularProducts } from "@/lib/data";
import { toggleSavedShop, toggleSavedProduct, placeOrder, updateProfile } from "@/app/actions/customer";
import type { Order, Profile, Address, SavedShop, SavedProduct, OrderItem } from "@/lib/types";

import { BarcodeScanner } from "./customer/BarcodeScanner";
import { OrderCard } from "./customer/OrderCard";
import { AddressBook } from "./customer/AddressBook";
import { SavedItems } from "./customer/SavedItems";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Tab = "home" | "orders" | "saved" | "profile";

const TABS: Array<{ id: Tab; label: string; Icon: React.ElementType }> = [
  { id: "home", label: "Home", Icon: Home },
  { id: "orders", label: "Orders", Icon: Package },
  { id: "saved", label: "Wishlist", Icon: Bookmark },
  { id: "profile", label: "Profile", Icon: User },
];

type OrderFilter = "active" | "past" | "all";

interface CustomerDashboardProps {
  user: SupabaseUser;
  profile: Profile | null;
  activeOrders: Order[];
  recentOrders: Order[];
  savedShops: SavedShop[];
  savedProducts: SavedProduct[];
  addresses: Address[];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function CustomerDashboard({
  user,
  profile,
  activeOrders: initialActive,
  recentOrders: initialRecent,
  savedShops: initialSavedShops,
  savedProducts: initialSavedProducts,
  addresses: initialAddresses,
}: CustomerDashboardProps) {
  const router = useRouter();

  // ─── State ────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("home");
  const [orders, setOrders] = useState<Order[]>([...initialActive, ...initialRecent]);
  const [savedShopNames, setSavedShopNames] = useState<Set<string>>(
    new Set(initialSavedShops.map((s) => s.shop_name))
  );
  const [savedProductIds, setSavedProductIds] = useState<Set<string>>(
    new Set(initialSavedProducts.map((p) => p.product_id))
  );
  const [savedShopsList, setSavedShopsList] = useState<SavedShop[]>(initialSavedShops);
  const [savedProductsList, setSavedProductsList] = useState<SavedProduct[]>(initialSavedProducts);
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("active");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.full_name ?? "");
  const [savingName, setSavingName] = useState(false);

  // ─── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`orders:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
          );
          if (updated.status === "out_for_delivery") {
            toast.success("Your order is on the way! 🛵", { duration: 4000 });
          } else if (updated.status === "delivered") {
            toast.success("Order delivered! Enjoy 🎉", { duration: 5000 });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${user.id}`,
        },
        (payload) => {
          setOrders((prev) => [payload.new as Order, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  // ─── Derived state ────────────────────────────────────────────────────────
  const activeOrders = orders.filter(
    (o) => !["delivered", "cancelled"].includes(o.status)
  );
  const pastOrders = orders.filter((o) =>
    ["delivered", "cancelled"].includes(o.status)
  );

  const monthlySpend = orders
    .filter((o) => {
      if (o.status === "cancelled") return false;
      const d = new Date(o.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, o) => sum + o.total_amount, 0);

  const firstName =
    profile?.full_name?.split(" ")[0] ||
    user.email?.split("@")[0] ||
    "there";

  const filteredOrders =
    orderFilter === "active"
      ? activeOrders
      : orderFilter === "past"
      ? pastOrders
      : orders;

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleToggleShop = async (shop: (typeof nearbyShops)[0]) => {
    const wasSaved = savedShopNames.has(shop.name);
    setSavedShopNames((prev) => {
      const s = new Set(prev);
      wasSaved ? s.delete(shop.name) : s.add(shop.name);
      return s;
    });
    if (wasSaved) {
      setSavedShopsList((prev) => prev.filter((s) => s.shop_name !== shop.name));
    } else {
      setSavedShopsList((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          customer_id: user.id,
          shop_name: shop.name,
          shop_category: shop.category,
          shop_distance: shop.distance,
          shop_image: shop.image,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    toast(wasSaved ? "Removed from saved" : `${shop.name} saved`);
    await toggleSavedShop({
      shop_name: shop.name,
      shop_category: shop.category,
      shop_distance: shop.distance,
      shop_image: shop.image,
    });
  };

  const handleToggleProduct = async (product: (typeof popularProducts)[0]) => {
    const wasSaved = savedProductIds.has(product.id);
    setSavedProductIds((prev) => {
      const s = new Set(prev);
      wasSaved ? s.delete(product.id) : s.add(product.id);
      return s;
    });
    if (wasSaved) {
      setSavedProductsList((prev) => prev.filter((p) => p.product_id !== product.id));
    } else {
      setSavedProductsList((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          customer_id: user.id,
          product_id: product.id,
          product_name: product.name,
          product_price: product.price,
          product_image: product.image,
          product_shop: product.shop,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    await toggleSavedProduct({
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      product_image: product.image,
      product_shop: product.shop,
    });
  };

  const handleOrderFromScan = async (detected: {
    id: string;
    name: string;
    price: string;
    shop: string;
  }) => {
    const price = parseFloat(detected.price.replace(/[^0-9.]/g, "")) || 0;
    const result = await placeOrder({
      shop_name: detected.shop,
      items: [{ name: detected.name, price, quantity: 1 }],
      eta_minutes: 20,
    });
    if (result.error) {
      toast.error(result.error);
    } else if (result.order) {
      setOrders((prev) => [result.order as Order, ...prev]);
      toast.success(`Order placed at ${detected.shop}`);
      setTab("orders");
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim() || nameInput.trim() === profile?.full_name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const fd = new FormData();
    fd.set("full_name", nameInput.trim());
    const result = await updateProfile(fd);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Name updated");
      setEditingName(false);
      router.refresh();
    }
    setSavingName(false);
  };

  // ─── Render sections ──────────────────────────────────────────────────────

  const HomeTab = (
    <div className="space-y-8">
      {/* Greeting + stats */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-[#27324A]">
            {getGreeting()}, {firstName}.
          </h1>
          <p className="mt-1 text-sm font-medium text-[#746E73]">
            What do you need locally today?
          </p>
        </div>

        {/* Scan button */}
        <button
          onClick={() => setScannerOpen(true)}
          className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-[#A7653A] px-7 text-sm font-bold text-white shadow-xl shadow-[#A7653A]/25 transition hover:-translate-y-0.5 hover:bg-[#8E5432] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4 active:scale-95"
        >
          <Barcode className="h-5 w-5" />
          Scan Barcode
        </button>
      </section>

      {/* Spending summary strip */}
      {(monthlySpend > 0 || orders.length > 0) && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-[#2E3344]/8 bg-white px-4 py-3 shadow-sm">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#F7F0E6] text-[#A7653A]">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#746E73]">
                This month
              </p>
              <p className="text-base font-bold text-[#27324A]">
                Rs.{" "}
                {monthlySpend > 0
                  ? monthlySpend.toLocaleString()
                  : "0"}{" "}
                spent
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-[#2E3344]/8 bg-white px-4 py-3 shadow-sm">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#F7F0E6] text-[#A7653A]">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#746E73]">
                Total orders
              </p>
              <p className="text-base font-bold text-[#27324A]">{orders.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Active orders */}
      {activeOrders.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#8D5132]">
              Active Orders
            </h2>
            <span className="rounded-full bg-[#A7653A]/10 px-2.5 py-0.5 text-xs font-bold text-[#A7653A]">
              {activeOrders.length}
            </span>
          </div>
          <div className="grid gap-3">
            {activeOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isActive
                onViewReceipt={setReceiptOrder}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          {/* Buy Again / Quick Reorder */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#8D5132]">
                {savedProductsList.length > 0 ? "Saved products" : "Popular nearby"}
              </h2>
              <button
                onClick={() => setTab("saved")}
                className="text-xs font-semibold text-[#A7653A] hover:underline"
              >
                View all
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x scrollbar-none">
              {popularProducts.slice(0, 5).map((product) => {
                const isSaved = savedProductIds.has(product.id);
                return (
                  <div
                    key={product.id}
                    className="min-w-[148px] max-w-[148px] snap-start rounded-[1.25rem] border border-[#2E3344]/8 bg-white p-3 shadow-sm flex flex-col"
                  >
                    <div className="relative h-24 w-full overflow-hidden rounded-xl bg-[#F7F0E6] mb-3">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() => handleToggleProduct(product)}
                        className={`absolute top-2 right-2 rounded-full p-1.5 transition ${
                          isSaved
                            ? "bg-[#A7653A] text-white"
                            : "bg-white/80 text-[#746E73] hover:text-[#A7653A]"
                        }`}
                        aria-label={isSaved ? "Remove from saved" : "Save product"}
                      >
                        <Heart
                          className={`h-3.5 w-3.5 ${isSaved ? "fill-current" : ""}`}
                        />
                      </button>
                    </div>
                    <p className="text-[10px] font-semibold text-[#A7653A] truncate">
                      {product.shop}
                    </p>
                    <h4 className="mt-0.5 text-xs font-bold text-[#27324A] line-clamp-2 flex-1 leading-snug">
                      {product.name}
                    </h4>
                    <p className="mt-1.5 text-sm font-bold text-[#27324A]">
                      {product.price}
                    </p>
                    <button className="mt-2.5 w-full rounded-full bg-[#F7F0E6] py-1.5 text-xs font-semibold text-[#27324A] transition hover:bg-[#A7653A] hover:text-white active:scale-95">
                      Reorder
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Nearby shops */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#8D5132]">
                Nearby Shops
              </h2>
              <button className="text-xs font-semibold text-[#A7653A] hover:underline">
                Map view
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {nearbyShops
                .filter((s) => s.eta !== "Outside range")
                .map((shop) => {
                  const isSaved = savedShopNames.has(shop.name);
                  return (
                    <div
                      key={shop.name}
                      className="flex items-center gap-3 rounded-[1.25rem] border border-[#2E3344]/8 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                    >
                      <img
                        src={shop.image}
                        alt={shop.name}
                        className="h-14 w-14 rounded-xl object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-[#27324A] truncate">
                          {shop.name}
                        </h4>
                        <p className="text-xs text-[#746E73] mt-0.5 truncate">
                          {shop.category} · {shop.distance}km · {shop.eta}
                        </p>
                        <p className="text-[10px] text-[#A7653A] font-medium mt-0.5">
                          {shop.status}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleShop(shop);
                        }}
                        className={`flex-shrink-0 rounded-full p-2 transition ${
                          isSaved
                            ? "text-[#A7653A]"
                            : "text-[#746E73] hover:text-[#A7653A]"
                        }`}
                        aria-label={isSaved ? "Unsave shop" : "Save shop"}
                      >
                        <Heart
                          className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`}
                        />
                      </button>
                    </div>
                  );
                })}
            </div>
          </section>
        </div>

        {/* Manage sidebar */}
        <aside className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#8D5132]">
            Manage
          </h2>
          <div className="rounded-[1.5rem] border border-[#2E3344]/8 bg-white shadow-sm overflow-hidden">
            {[
              {
                Icon: ReceiptText,
                label: "Order History",
                sub: `${pastOrders.length} past orders`,
                action: () => { setTab("orders"); setOrderFilter("past"); },
              },
              {
                Icon: Bookmark,
                label: "Wishlist",
                sub: savedProductsList.length > 0 ? `${savedProductsList.length} saved items` : "Save products",
                action: () => setTab("saved"),
              },
              {
                Icon: MapPin,
                label: "My Addresses",
                sub: addresses.length > 0 ? `${addresses.length} saved` : "Add a location",
                action: () => setTab("profile"),
              },
            ].map(({ Icon, label, sub, action }, i, arr) => (
              <button
                key={label}
                onClick={action}
                className={`flex w-full items-center gap-3 p-4 text-left transition hover:bg-[#F7F0E6] ${
                  i < arr.length - 1 ? "border-b border-[#2E3344]/8" : ""
                }`}
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8E3D1] text-[#626A54]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#27324A]">{label}</p>
                  <p className="text-xs text-[#746E73] mt-0.5">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );

  const OrdersTab = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-[-0.02em] text-[#27324A]">
          Your Orders
        </h2>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {(["active", "past", "all"] as OrderFilter[]).map((f) => {
          const count =
            f === "active"
              ? activeOrders.length
              : f === "past"
              ? pastOrders.length
              : orders.length;
          return (
            <button
              key={f}
              onClick={() => setOrderFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-bold capitalize transition ${
                orderFilter === f
                  ? "bg-[#27324A] text-white"
                  : "bg-white border border-[#2E3344]/12 text-[#746E73] hover:border-[#27324A]/30 hover:text-[#27324A]"
              }`}
            >
              {f} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2E3344]/15 bg-white p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-[#2E3344]/20 mb-3" />
          <p className="text-sm font-semibold text-[#27324A]">No orders yet</p>
          <p className="text-xs text-[#746E73] mt-1 mb-4">
            Scan a product barcode to place your first order.
          </p>
          <button
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#A7653A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#8E5432] transition"
          >
            <Barcode className="h-4 w-4" />
            Scan & order
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isActive={!["delivered", "cancelled"].includes(order.status)}
              onViewReceipt={setReceiptOrder}
            />
          ))}
        </div>
      )}
    </div>
  );

  const SavedTab = (
    <div className="space-y-5">
      <h2 className="text-xl font-bold tracking-[-0.02em] text-[#27324A]">
        Wishlist & Saved Shops
      </h2>
      <SavedItems
        savedShops={savedShopsList}
        savedProducts={savedProductsList}
        onShopsChange={(shops) => {
          setSavedShopsList(shops);
          setSavedShopNames(new Set(shops.map((s) => s.shop_name)));
        }}
        onProductsChange={(products) => {
          setSavedProductsList(products);
          setSavedProductIds(new Set(products.map((p) => p.product_id)));
        }}
        onOrderPlaced={(order) => setOrders((prev) => [order, ...prev])}
      />
    </div>
  );

  const ProfileTab = (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Profile Header Banner */}
      <div className="relative rounded-[2rem] overflow-hidden bg-white border border-[#2E3344]/8 shadow-sm">
        <div className="h-32 sm:h-40 w-full bg-gradient-to-r from-[#A7653A] via-[#D8C99A] to-[#B76E42] relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
        </div>
        <div className="px-6 pb-6 sm:px-10 sm:pb-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 sm:-mt-16 mb-4 sm:mb-0">
            <div className="flex items-end gap-5">
              <div className="relative h-24 w-24 sm:h-32 sm:w-32 rounded-[1.5rem] sm:rounded-[2rem] bg-white p-1.5 shadow-xl z-10">
                <div className="h-full w-full rounded-[1.2rem] sm:rounded-[1.7rem] bg-[#27324A] text-white flex items-center justify-center text-3xl sm:text-5xl font-bold">
                  {(profile?.full_name ?? user.email ?? "U")[0].toUpperCase()}
                </div>
              </div>
              <div className="pb-2 sm:pb-4 z-10">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                      className="w-48 sm:w-64 rounded-xl border border-[#A7653A]/40 bg-white/90 px-4 py-2 text-sm sm:text-base font-bold text-[#27324A] outline-none focus:ring-2 focus:ring-[#A7653A]/40 shadow-sm"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="rounded-full bg-[#27324A] px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white disabled:opacity-50 transition shadow-md hover:bg-[#1a2233]"
                    >
                      {savingName ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditingName(false); setNameInput(profile?.full_name ?? ""); }}
                      className="rounded-full bg-white border border-[#2E3344]/10 p-2 sm:p-2.5 text-[#746E73] hover:bg-[#F7F0E6] shadow-sm transition"
                    >
                      <X className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[#27324A]">
                      {profile?.full_name ?? "Not set"}
                    </h2>
                    <p className="text-sm sm:text-base font-medium text-[#746E73] mt-0.5">
                      {user.email}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {!editingName && (
              <div className="sm:pb-4 z-10 hidden sm:block">
                <button
                  onClick={() => setEditingName(true)}
                  className="rounded-full border border-[#2E3344]/12 bg-white/90 backdrop-blur px-5 py-2.5 text-sm font-semibold text-[#27324A] shadow-sm hover:border-[#A7653A]/40 hover:text-[#A7653A] transition"
                >
                  Edit Profile
                </button>
              </div>
            )}
          </div>
          
          {/* Mobile Edit Button */}
          {!editingName && (
            <button
              onClick={() => setEditingName(true)}
              className="w-full mt-2 sm:hidden rounded-xl border border-[#2E3344]/12 bg-[#F7F0E6]/50 px-4 py-2.5 text-sm font-semibold text-[#27324A] shadow-sm hover:bg-[#F7F0E6]"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column: Stats & Info */}
        <div className="space-y-6 md:col-span-1">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
            {[
              { label: "Total orders", value: orders.length, icon: Package },
              { label: "Saved items", value: savedProductsList.length, icon: Bookmark },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-[1.5rem] border border-[#2E3344]/8 bg-white p-5 shadow-sm hover:shadow-md transition group"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746E73] group-hover:text-[#A7653A] transition">
                    {label}
                  </p>
                  <p className="text-3xl font-bold text-[#27324A] mt-1">{value}</p>
                </div>
                <div className="h-12 w-12 rounded-[1rem] bg-[#F7F0E6] text-[#A7653A] flex items-center justify-center">
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            ))}
          </div>

          {/* Account Details */}
          <div className="rounded-[1.5rem] border border-[#2E3344]/8 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#8D5132]">
              Account Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 grid h-9 w-9 place-items-center rounded-full bg-[#E8E3D1] text-[#626A54]">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#746E73]">Member Since</p>
                  <p className="text-sm font-medium text-[#27324A]">
                    {new Date(profile?.created_at ?? user.created_at).toLocaleDateString(
                      "en-US",
                      { month: "short", year: "numeric", day: "numeric" }
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 grid h-9 w-9 place-items-center rounded-full bg-[#E8E3D1] text-[#626A54]">
                  <Store className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#746E73]">Favorite Shops</p>
                  <p className="text-sm font-medium text-[#27324A]">{savedShopsList.length} shops</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Delivery Addresses */}
        <div className="md:col-span-2">
          <div className="h-full rounded-[1.5rem] border border-[#2E3344]/8 bg-white p-5 sm:p-7 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#8D5132]">
                Delivery Addresses
              </h3>
            </div>
            <AddressBook addresses={addresses} onChange={setAddresses} />
          </div>
        </div>
      </div>
    </div>
  );

  const TAB_CONTENT: Record<Tab, React.ReactNode> = {
    home: HomeTab,
    orders: OrdersTab,
    saved: SavedTab,
    profile: ProfileTab,
  };

  return (
    <div className="pb-24 sm:pb-0">
      {/* Desktop top tabs */}
      <div className="hidden sm:flex items-center gap-1 mb-8 p-1.5 bg-[#E8E3D1]/40 rounded-[16px] w-fit">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-semibold transition ${
              tab === id
                ? "bg-white text-[#27324A] shadow-sm"
                : "text-[#746E73] hover:text-[#27324A]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === "orders" && activeOrders.length > 0 && (
              <span className="rounded-full bg-[#A7653A] h-5 w-5 text-[10px] font-bold text-white grid place-items-center">
                {activeOrders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {TAB_CONTENT[tab]}
        </motion.div>
      </AnimatePresence>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white/96 backdrop-blur-2xl border-t border-[#2E3344]/8 flex safe-area-bottom">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex flex-1 flex-col items-center gap-1 py-3 transition ${
              tab === id ? "text-[#A7653A]" : "text-[#746E73]"
            }`}
          >
            <Icon className={`h-5 w-5 ${tab === id ? "stroke-[2.5]" : "stroke-2"}`} />
            <span className="text-[10px] font-bold">{label}</span>
            {id === "orders" && activeOrders.length > 0 && (
              <span className="absolute top-2 right-[calc(50%-14px)] rounded-full bg-[#A7653A] h-4 w-4 text-[9px] font-bold text-white grid place-items-center">
                {activeOrders.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Barcode scanner overlay */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onOrderNow={handleOrderFromScan}
      />

      {/* Receipt sheet */}
      <Sheet
        open={!!receiptOrder}
        onOpenChange={(open) => !open && setReceiptOrder(null)}
      >
        <SheetContent side="bottom" className="bg-[#f8f8f7] rounded-t-[2rem] max-h-[85vh] overflow-y-auto px-0 pb-8 border-none">
          {receiptOrder && (
            <>
              <SheetHeader className="px-6 pb-4 border-b border-[#2E3344]/8">
                <SheetTitle className="text-lg font-bold text-[#27324A]">
                  Receipt
                </SheetTitle>
                <p className="text-xs text-[#746E73] font-medium">
                  {receiptOrder.order_number} ·{" "}
                  {new Date(receiptOrder.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </SheetHeader>

              <div className="px-6 pt-5 space-y-5">
                {/* Shop */}
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8E3D1] text-[#626A54]">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#27324A]">
                      {receiptOrder.shop_name}
                    </p>
                    <p className="text-xs text-[#746E73] capitalize mt-0.5">
                      {receiptOrder.status.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div className="rounded-2xl border border-[#2E3344]/8 bg-white overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#2E3344]/6">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#746E73]">
                      Items
                    </p>
                  </div>
                  {(receiptOrder.items as OrderItem[]).map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-3 border-b border-[#2E3344]/6 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#27324A]">
                          {item.name}
                        </p>
                        <p className="text-xs text-[#746E73] mt-0.5">
                          {item.quantity > 1 ? `×${item.quantity}` : "×1"} ·{" "}
                          Rs. {item.price.toLocaleString()} each
                        </p>
                      </div>
                      <p className="text-sm font-bold text-[#27324A]">
                        Rs. {(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {receiptOrder.notes && (
                  <div className="rounded-2xl border border-[#2E3344]/8 bg-white px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#746E73] mb-1">
                      Note
                    </p>
                    <p className="text-sm text-[#27324A]">{receiptOrder.notes}</p>
                  </div>
                )}

                {/* Total */}
                <div className="flex items-center justify-between rounded-2xl bg-[#27324A] px-5 py-4 text-white">
                  <p className="font-semibold text-white/80 text-sm">Total paid</p>
                  <p className="text-xl font-bold">
                    Rs. {receiptOrder.total_amount.toLocaleString()}
                  </p>
                </div>

                {/* Delivery address */}
                {receiptOrder.delivery_address && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-[#2E3344]/8 bg-white px-4 py-3">
                    <MapPin className="h-4 w-4 text-[#A7653A] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#746E73] mb-0.5">
                        Delivered to
                      </p>
                      <p className="text-sm text-[#27324A]">
                        {receiptOrder.delivery_address}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
