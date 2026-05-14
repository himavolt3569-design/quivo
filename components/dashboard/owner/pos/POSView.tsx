"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Barcode,
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Banknote,
  User,
  QrCode,
  Package,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { completePOSSale } from "@/app/actions/owner";

interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
  variant: string | null;
  category: string | null;
  price: number;
  stock: number;
  image_url: string | null;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  maxStock: number;
}

interface POSViewProps {
  shopId: string;
  catalogProducts: CatalogProduct[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Grocery: "bg-green-50",
  Dairy: "bg-blue-50",
  Beverages: "bg-cyan-50",
  Snacks: "bg-yellow-50",
  "Personal Care": "bg-pink-50",
  Electronics: "bg-purple-50",
  Household: "bg-orange-50",
  Other: "bg-gray-50",
};

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: Banknote, color: "bg-[#27324A] text-white" },
  { id: "online", label: "eSewa", icon: QrCode, color: "bg-[#41A560]/10 text-[#41A560] border border-[#41A560]/20 hover:bg-[#41A560]/20" },
  { id: "udhar", label: "Udhar", icon: User, color: "bg-[#F7F0E6] text-[#A7653A] border border-[#A7653A]/20 hover:bg-[#A7653A] hover:text-white" },
];

export function POSView({ shopId, catalogProducts }: POSViewProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(() => {
    const cats = new Set(catalogProducts.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(cats)] as string[];
  }, [catalogProducts]);

  const filteredProducts = useMemo(() => {
    return catalogProducts.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.brand ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "All" || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [catalogProducts, search, activeCategory]);

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  const addToCart = (product: CatalogProduct) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (existing.qty >= existing.maxStock) {
          toast.error("Not enough stock.");
          return prev;
        }
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1, maxStock: product.stock }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.id !== id) return i;
          const newQty = i.qty + delta;
          if (newQty <= 0) return null as unknown as CartItem;
          if (newQty > i.maxStock) { toast.error("Not enough stock."); return i; }
          return { ...i, qty: newQty };
        })
        .filter(Boolean);
    });
  };

  const handleCheckout = (paymentMethod: string) => {
    if (!cart.length) { toast.error("Cart is empty."); return; }
    const items = cart.map((i) => ({ product_id: i.id, qty: i.qty, name: i.name, price: i.price }));
    startTransition(async () => {
      const result = await completePOSSale(shopId, items, subtotal, paymentMethod);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Sale of Rs. ${subtotal.toLocaleString()} recorded via ${paymentMethod}!`);
        setCart([]);
        setIsMobileCartOpen(false);
      }
    });
  };

  const CartContent = () => (
    <div className="w-full h-full flex flex-col bg-white lg:rounded-[2rem] lg:border border-[#2E3344]/8 lg:shadow-sm overflow-hidden shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-[#2E3344]/8 flex items-center justify-between bg-[#F7F0E6]/30">
        <h2 className="font-black text-[#27324A] flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-[#A7653A]" /> Current Sale
        </h2>
        {cart.length > 0 && (
          <button onClick={() => setCart([])} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition">
            Clear All
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-2">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#746E73]">
            <ShoppingCart className="h-12 w-12 opacity-20 mb-3" />
            <p className="font-medium text-sm">Cart is empty</p>
            <p className="text-xs mt-1">Tap products to add</p>
          </div>
        ) : (
          <div className="space-y-1">
            {cart.map((item) => (
              <div key={item.id} className="flex flex-col p-3 hover:bg-[#f8f8f7] rounded-xl group transition">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-bold text-[#27324A] line-clamp-1 pr-2">{item.name}</p>
                  <p className="text-sm font-black text-[#27324A] shrink-0">Rs. {(item.price * item.qty).toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-[#746E73] font-bold uppercase tracking-widest">Rs. {item.price} / unit</p>
                  <div className="flex items-center gap-3 bg-white border border-[#2E3344]/10 rounded-lg p-1">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="h-6 w-6 rounded bg-[#f8f8f7] hover:bg-[#E8E3D1] flex items-center justify-center text-[#27324A]"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-xs font-black w-4 text-center">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="h-6 w-6 rounded bg-[#F7F0E6] hover:bg-[#A7653A] hover:text-white flex items-center justify-center text-[#A7653A] transition"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-[#2E3344]/8 bg-[#f8f8f7]">
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm text-[#746E73] font-medium">
            <span>Subtotal ({cart.reduce((a, b) => a + b.qty, 0)} items)</span>
            <span>Rs. {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-2xl font-black text-[#27324A] pt-2 border-t border-[#2E3344]/10">
            <span>Total</span>
            <span>Rs. {subtotal.toLocaleString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.id}
              disabled={isPending || cart.length === 0}
              onClick={() => handleCheckout(pm.id)}
              className={`py-3 rounded-xl flex flex-col items-center gap-1 active:scale-95 transition shadow-sm disabled:opacity-40 ${pm.color}`}
            >
              <pm.icon className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{pm.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500 pb-16 lg:pb-0">
      {/* Left: Product Search & Catalog */}
      <div className="flex-1 flex flex-col bg-white lg:rounded-[2rem] border border-[#2E3344]/8 shadow-sm overflow-hidden -mx-4 sm:-mx-6 lg:mx-0">
        {/* Search Area */}
        <div className="p-4 lg:p-6 border-b border-[#2E3344]/8 bg-[#f8f8f7]">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#746E73]" />
              <Input
                placeholder="Search products..."
                className="pl-12 h-12 lg:h-14 rounded-xl lg:rounded-2xl bg-white border-transparent focus-visible:ring-[#A7653A]/30 text-base lg:text-lg shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <Button className="h-12 w-12 lg:h-14 lg:w-14 rounded-xl lg:rounded-2xl bg-[#27324A] hover:bg-[#1b2333] text-white shrink-0 shadow-lg">
              <Barcode className="h-5 w-5 lg:h-6 lg:w-6" />
            </Button>
          </div>
          <div className="flex gap-2 mt-4 overflow-x-auto hide-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeCategory === cat
                    ? "bg-[#27324A] text-white"
                    : "bg-white border border-[#2E3344]/5 text-[#27324A] hover:bg-[#F7F0E6] hover:border-[#A7653A]/30"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#f8f8f7]/50">
          {catalogProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <Package className="h-16 w-16 text-[#746E73] opacity-20" />
              <p className="font-bold text-[#27324A]">No products in catalog yet.</p>
              <p className="text-sm text-[#746E73]">Add products in the Inventory section first.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-[#746E73] font-medium">
              No products match &quot;{search}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
              {filteredProducts.map((p) => {
                const colorClass = CATEGORY_COLORS[p.category ?? "Other"] ?? "bg-gray-50";
                const cartItem = cart.find((i) => i.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`text-left bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 hover:border-[#A7653A]/50 hover:shadow-md transition group flex flex-col h-28 lg:h-32 relative overflow-hidden ${
                      cartItem ? "border-[#A7653A]/40 bg-[#FDF8F4]" : ""
                    }`}
                  >
                    <div className={`absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 rounded-full ${colorClass} opacity-50 group-hover:scale-150 transition-transform duration-500`} />
                    {cartItem && (
                      <span className="absolute top-2 right-2 h-5 w-5 bg-[#A7653A] text-white rounded-full text-[10px] font-black flex items-center justify-center z-10">
                        {cartItem.qty}
                      </span>
                    )}
                    <span className="text-xs lg:text-sm font-black text-[#27324A] line-clamp-2 mt-auto relative z-10">{p.name}</span>
                    <span className="text-[10px] lg:text-xs font-bold text-[#A7653A] mt-1 relative z-10">Rs. {p.price}</span>
                    <span className="text-[9px] text-[#746E73] font-medium relative z-10">Stock: {p.stock}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart (Desktop) */}
      <div className="hidden lg:flex w-[400px] xl:w-[450px]">
        <CartContent />
      </div>

      {/* Mobile Cart Button */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-[#f8f8f7] to-transparent z-40">
        <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
          <SheetTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-[#A7653A] hover:bg-[#8D5132] text-white shadow-xl flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {cart.length > 0 && (
                    <span className="absolute -top-2 -right-2 h-4 w-4 bg-white text-[#A7653A] rounded-full text-[9px] font-black flex items-center justify-center">
                      {cart.reduce((a, b) => a + b.qty, 0)}
                    </span>
                  )}
                </div>
                <span className="font-bold">{cart.length === 0 ? "Cart Empty" : "View Cart"}</span>
              </div>
              <span className="font-black text-lg">Rs. {subtotal.toLocaleString()}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-[2rem]">
            <SheetTitle className="sr-only">Cart</SheetTitle>
            <CartContent />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
