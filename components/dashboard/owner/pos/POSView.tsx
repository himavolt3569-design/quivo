"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import {
  Barcode,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Banknote,
  User,
  QrCode,
  Package,
  Printer,
  Receipt,
  X,
  CheckCircle2,
  Scale,
  Droplets,
  Hash,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { completePOSSale } from "@/app/actions/owner";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type UnitKind = "count" | "weight" | "volume";

interface UnitConfig {
  kind: UnitKind;
  step: number;
  min: number;
  label: string;
  priceLabel: string;
  digits: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  maxStock: number;
  unit: string | null;
  cfg: UnitConfig;
}

interface CompletedBill {
  items: CartItem[];
  total: number;
  paymentMethod: string;
  customerName?: string;
  timestamp: Date;
}

interface POSViewProps {
  shopId: string;
  shopName: string;
  catalogProducts: CatalogProduct[];
}

interface CartContentProps {
  cart: CartItem[];
  subtotal: number;
  isPending: boolean;
  showUdharPrompt: boolean;
  udharName: string;
  udharInputRef: React.RefObject<HTMLInputElement | null>;
  onClearCart: () => void;
  onUpdateQty: (id: string, delta: number) => void;
  onPaymentClick: (id: string) => void;
  onCheckout: (method: string, name?: string) => void;
  onDismissUdhar: () => void;
  onUdharNameChange: (v: string) => void;
}

// ─── Unit intelligence ────────────────────────────────────────────────────────

const WEIGHT_UNITS = ["g", "kg", "gm", "gram", "grams", "kilogram", "kilograms", "mg", "milligram"];
const VOLUME_UNITS = ["l", "ml", "litre", "litres", "liter", "liters", "millilitre", "milliliter", "lt"];
const COUNT_UNITS  = ["pcs", "pkt", "packet", "packets", "piece", "pieces", "box", "boxes", "bottle", "bottles", "can", "cans", "unit", "units", "nos", "no.", "pack", "packs", "roll", "rolls", "bag", "bags", "dozen", "pair", "pairs", "sheet", "sheets", "strip", "strips", "tube", "tubes", "sachet", "sachets"];

function parseUnit(rawUnit: string | null): UnitConfig {
  if (!rawUnit || rawUnit.trim() === "") {
    return { kind: "count", step: 1, min: 1, label: "pc", priceLabel: "each", digits: 0 };
  }

  const norm = rawUnit.trim().toLowerCase();
  const parts = norm.split(/\s+/);
  const typeToken = parts.length >= 2 ? parts.slice(1).join(" ") : parts[0];

  if (WEIGHT_UNITS.includes(typeToken)) {
    if (["g", "gm", "gram", "grams", "mg", "milligram"].includes(typeToken)) {
      return { kind: "count", step: 1, min: 1, label: "pkt", priceLabel: "per pack", digits: 0 };
    }
    return { kind: "weight", step: 0.5, min: 0.5, label: "kg", priceLabel: "per kg", digits: 1 };
  }

  if (VOLUME_UNITS.includes(typeToken)) {
    if (["ml", "millilitre", "milliliter"].includes(typeToken)) {
      return { kind: "count", step: 1, min: 1, label: "btl", priceLabel: "per bottle", digits: 0 };
    }
    return { kind: "volume", step: 0.5, min: 0.5, label: "L", priceLabel: "per L", digits: 1 };
  }

  if (COUNT_UNITS.some(cu => typeToken.includes(cu))) {
    const label = typeToken.includes("packet") ? "pkt"
      : typeToken.includes("piece") ? "pc"
      : typeToken.includes("box") ? "box"
      : typeToken.includes("bottle") ? "btl"
      : typeToken.includes("can") ? "can"
      : typeToken.includes("roll") ? "roll"
      : typeToken.includes("bag") ? "bag"
      : typeToken.includes("dozen") ? "dz"
      : typeToken.includes("strip") ? "strip"
      : typeToken.includes("sachet") ? "sachet"
      : "pc";
    return { kind: "count", step: 1, min: 1, label, priceLabel: `per ${label}`, digits: 0 };
  }

  return { kind: "count", step: 1, min: 1, label: typeToken.slice(0, 4), priceLabel: `per ${typeToken.slice(0, 4)}`, digits: 0 };
}

function fmtQty(qty: number, cfg: UnitConfig): string {
  return qty.toFixed(cfg.digits) + " " + cfg.label;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Grocery:         "bg-green-50",
  Dairy:           "bg-blue-50",
  Beverages:       "bg-cyan-50",
  Snacks:          "bg-yellow-50",
  "Personal Care": "bg-pink-50",
  Electronics:     "bg-purple-50",
  Household:       "bg-orange-50",
  Other:           "bg-gray-50",
};

const PAYMENT_METHODS = [
  { id: "cash",   label: "Cash",  icon: Banknote, color: "bg-[#27324A] text-white" },
  { id: "online", label: "eSewa", icon: QrCode,   color: "bg-[#41A560]/10 text-[#41A560] border border-[#41A560]/20 hover:bg-[#41A560]/20" },
  { id: "udhar",  label: "Udhar", icon: User,     color: "bg-[#F7F0E6] text-[#A7653A] border border-[#A7653A]/20 hover:bg-[#A7653A] hover:text-white" },
];

// ─── Stateless sub-components (defined outside to avoid recreate-on-render) ──

function UnitIcon({ kind }: { kind: UnitKind }) {
  if (kind === "weight") return <Scale className="h-2.5 w-2.5" />;
  if (kind === "volume") return <Droplets className="h-2.5 w-2.5" />;
  return <Hash className="h-2.5 w-2.5" />;
}

function CartContent({
  cart, subtotal, isPending, showUdharPrompt, udharName, udharInputRef,
  onClearCart, onUpdateQty, onPaymentClick, onCheckout, onDismissUdhar, onUdharNameChange,
}: CartContentProps) {
  return (
    <div className="w-full h-full flex flex-col bg-white lg:rounded-[2rem] lg:border border-[#2E3344]/8 lg:shadow-sm overflow-hidden shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-[#2E3344]/8 flex items-center justify-between bg-[#F7F0E6]/30">
        <h2 className="font-black text-[#27324A] flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-[#A7653A]" /> Current Sale
        </h2>
        {cart.length > 0 && (
          <button onClick={onClearCart} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition">
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
            <p className="text-xs mt-1">Tap products to add them</p>
          </div>
        ) : (
          <div className="space-y-1">
            {cart.map((item) => (
              <div key={item.id} className="flex flex-col p-3 hover:bg-[#f8f8f7] rounded-xl group transition">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-bold text-[#27324A] line-clamp-1 pr-2">{item.name}</p>
                  <p className="text-sm font-black text-[#27324A] shrink-0">Rs. {(item.price * item.qty).toFixed(2)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-[#746E73] font-bold uppercase tracking-widest flex items-center gap-1">
                    <UnitIcon kind={item.cfg.kind} />
                    Rs. {item.price} {item.cfg.priceLabel}
                  </span>
                  <div className="flex items-center gap-2 bg-white border border-[#2E3344]/10 rounded-lg p-1">
                    <button onClick={() => onUpdateQty(item.id, -1)} className="h-6 w-6 rounded bg-[#f8f8f7] hover:bg-[#E8E3D1] flex items-center justify-center text-[#27324A]">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-xs font-black min-w-[3rem] text-center">{fmtQty(item.qty, item.cfg)}</span>
                    <button onClick={() => onUpdateQty(item.id, 1)} className="h-6 w-6 rounded bg-[#F7F0E6] hover:bg-[#A7653A] hover:text-white flex items-center justify-center text-[#A7653A] transition">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Udhar Customer Name Prompt */}
      {showUdharPrompt && (
        <div className="px-5 py-3 bg-[#F7F0E6]/60 border-t border-[#A7653A]/20">
          <p className="text-xs font-bold text-[#A7653A] mb-2 uppercase tracking-wider">Customer name (Udhar)</p>
          <div className="flex gap-2">
            <Input
              ref={udharInputRef}
              value={udharName}
              onChange={(e) => onUdharNameChange(e.target.value)}
              placeholder="e.g. Ram Bahadur"
              className="h-9 text-sm rounded-xl"
              onKeyDown={(e) => {
                if (e.key === "Enter") onCheckout("udhar", udharName || undefined);
                if (e.key === "Escape") onDismissUdhar();
              }}
            />
            <button
              onClick={() => onCheckout("udhar", udharName || undefined)}
              disabled={isPending}
              className="px-4 h-9 rounded-xl bg-[#A7653A] text-white text-sm font-bold shrink-0 disabled:opacity-50"
            >
              Confirm
            </button>
            <button onClick={onDismissUdhar} className="h-9 w-9 rounded-xl border border-[#2E3344]/10 flex items-center justify-center shrink-0">
              <X className="h-4 w-4 text-[#746E73]" />
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-5 border-t border-[#2E3344]/8 bg-[#f8f8f7]">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm text-[#746E73] font-medium">
            <span>{cart.length} item{cart.length !== 1 ? "s" : ""} in cart</span>
            <span>Rs. {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl font-black text-[#27324A] pt-2 border-t border-[#2E3344]/10">
            <span>Total</span>
            <span>Rs. {subtotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.id}
              disabled={isPending || cart.length === 0}
              onClick={() => onPaymentClick(pm.id)}
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
}

// ─── Bill Print ───────────────────────────────────────────────────────────────

function printBill(bill: CompletedBill, shopName: string) {
  const lines = bill.items.map(item =>
    `<tr>
      <td style="padding:4px 8px;font-size:13px;">${item.name}</td>
      <td style="padding:4px 8px;font-size:13px;text-align:center;">${fmtQty(item.qty, item.cfg)}</td>
      <td style="padding:4px 8px;font-size:13px;text-align:right;">Rs. ${(item.price * item.qty).toFixed(2)}</td>
    </tr>`
  ).join("");

  const payLabel = bill.paymentMethod === "udhar"
    ? `Udhar${bill.customerName ? ` (${bill.customerName})` : ""}`
    : bill.paymentMethod === "online" ? "eSewa" : "Cash";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Receipt</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Courier New',monospace; width:72mm; margin:auto; padding:8px; }
h1 { font-size:16px; text-align:center; margin-bottom:2px; }
.sub { font-size:11px; text-align:center; color:#555; margin-bottom:10px; }
.divider { border-top:1px dashed #999; margin:8px 0; }
table { width:100%; border-collapse:collapse; }
th { font-size:11px; text-align:left; padding:4px 8px; color:#555; }
th:last-child { text-align:right; } th:nth-child(2) { text-align:center; }
.total-row { font-size:15px; font-weight:bold; }
.footer { font-size:10px; text-align:center; margin-top:12px; color:#777; }
.pay { font-size:12px; margin:4px 8px; }
@media print { @page { margin:0; size:72mm auto; } }
</style></head>
<body>
<h1>${shopName}</h1>
<div class="sub">${bill.timestamp.toLocaleString("en-IN")}</div>
<div class="divider"></div>
<table><thead><tr><th>Item</th><th>Qty</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>${lines}</tbody></table>
<div class="divider"></div>
<table><tr class="total-row">
  <td style="padding:4px 8px;">TOTAL</td><td></td>
  <td style="padding:4px 8px;text-align:right;">Rs. ${bill.total.toFixed(2)}</td>
</tr></table>
<div class="divider"></div>
<div class="pay">Payment: <strong>${payLabel}</strong></div>
<div class="footer">Thank you for shopping at ${shopName}!<br/>Powered by Quivo</div>
</body></html>`;

  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) { toast.error("Allow pop-ups to print receipts."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 400);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function POSView({ shopId, shopName, catalogProducts }: POSViewProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [completedBill, setCompletedBill] = useState<CompletedBill | null>(null);
  const [udharName, setUdharName] = useState("");
  const [showUdharPrompt, setShowUdharPrompt] = useState(false);
  const udharInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const cats = new Set(catalogProducts.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(cats)] as string[];
  }, [catalogProducts]);

  const filteredProducts = useMemo(() => {
    return catalogProducts.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.brand ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.variant ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "All" || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [catalogProducts, search, activeCategory]);

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  const addToCart = (product: CatalogProduct) => {
    const cfg = parseUnit(product.unit);
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        const newQty = parseFloat((existing.qty + cfg.step).toFixed(3));
        if (newQty > existing.maxStock) { toast.error("Not enough stock."); return prev; }
        return prev.map((i) => i.id === product.id ? { ...i, qty: newQty } : i);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: cfg.min, maxStock: product.stock, unit: product.unit, cfg }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const newQty = parseFloat((i.qty + delta * i.cfg.step).toFixed(3));
        if (newQty <= 0) return null as unknown as CartItem;
        if (newQty > i.maxStock) { toast.error("Not enough stock."); return i; }
        return { ...i, qty: newQty };
      }).filter(Boolean)
    );
  };

  const handleCheckout = (paymentMethod: string, customerName?: string) => {
    if (!cart.length) { toast.error("Cart is empty."); return; }
    const items = cart.map((i) => ({ product_id: i.id, qty: i.qty, name: i.name, price: i.price }));
    const notes = paymentMethod === "udhar" && customerName ? `POS Sale (Udhar — ${customerName})` : undefined;

    startTransition(async () => {
      const result = await completePOSSale(shopId, items, subtotal, paymentMethod, notes);
      if (result.error) {
        toast.error(result.error);
      } else {
        setCompletedBill({ items: [...cart], total: subtotal, paymentMethod, customerName, timestamp: new Date() });
        setCart([]);
        setIsMobileCartOpen(false);
        setUdharName("");
        setShowUdharPrompt(false);
      }
    });
  };

  const handlePaymentClick = (pmId: string) => {
    if (!cart.length) { toast.error("Cart is empty."); return; }
    if (pmId === "udhar") {
      setShowUdharPrompt(true);
      setTimeout(() => udharInputRef.current?.focus(), 100);
      return;
    }
    handleCheckout(pmId);
  };

  const cartProps: CartContentProps = {
    cart, subtotal, isPending, showUdharPrompt, udharName, udharInputRef,
    onClearCart: () => setCart([]),
    onUpdateQty: updateQty,
    onPaymentClick: handlePaymentClick,
    onCheckout: handleCheckout,
    onDismissUdhar: () => setShowUdharPrompt(false),
    onUdharNameChange: setUdharName,
  };

  return (
    <>
      <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500 pb-16 lg:pb-0">
        {/* Left: Product Search & Catalog */}
        <div className="flex-1 flex flex-col bg-white lg:rounded-[2rem] border border-[#2E3344]/8 shadow-sm overflow-hidden -mx-4 sm:-mx-6 lg:mx-0">
          <div className="p-4 lg:p-6 border-b border-[#2E3344]/8 bg-[#f8f8f7]">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#746E73]" />
                <Input
                  placeholder="Search by name, brand or variant..."
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
                  const cfg = parseUnit(p.unit);
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className={`text-left bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 hover:border-[#A7653A]/50 hover:shadow-md transition group flex flex-col h-32 lg:h-36 relative overflow-hidden ${
                        cartItem ? "border-[#A7653A]/40 bg-[#FDF8F4]" : ""
                      }`}
                    >
                      <div className={`absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 rounded-full ${colorClass} opacity-50 group-hover:scale-150 transition-transform duration-500`} />
                      {cartItem && (
                        <span className="absolute top-2 right-2 h-5 min-w-[1.25rem] px-1 bg-[#A7653A] text-white rounded-full text-[10px] font-black flex items-center justify-center z-10">
                          {fmtQty(cartItem.qty, cartItem.cfg)}
                        </span>
                      )}
                      <div className="mt-auto relative z-10">
                        <span className="text-xs lg:text-sm font-black text-[#27324A] line-clamp-2 block">{p.name}</span>
                        {p.variant && <span className="text-[9px] text-[#746E73] font-medium block">{p.variant}</span>}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] lg:text-xs font-bold text-[#A7653A]">Rs. {p.price}</span>
                          <span className="text-[9px] text-[#746E73]">{cfg.priceLabel}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <UnitIcon kind={cfg.kind} />
                          <span className="text-[9px] text-[#746E73] font-medium">
                            {cfg.kind === "count" ? `Stock: ${Math.floor(p.stock)} ${cfg.label}` : `Stock: ${p.stock} ${cfg.label}`}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart (Desktop) */}
        <div className="hidden lg:flex w-[400px] xl:w-[450px]">
          <CartContent {...cartProps} />
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
                        {cart.length}
                      </span>
                    )}
                  </div>
                  <span className="font-bold">{cart.length === 0 ? "Cart Empty" : `${cart.length} item${cart.length > 1 ? "s" : ""}`}</span>
                </div>
                <span className="font-black text-lg">Rs. {subtotal.toFixed(2)}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-[2rem]">
              <SheetTitle className="sr-only">Cart</SheetTitle>
              <CartContent {...cartProps} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Completed Bill Modal */}
      {completedBill && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-[#27324A] to-[#1b2333] p-6 text-white text-center">
              <div className="h-14 w-14 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-8 w-8 text-green-300" />
              </div>
              <h2 className="font-black text-xl">Sale Complete!</h2>
              <p className="text-white/70 text-sm mt-1">{completedBill.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>

            <div className="p-6">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {completedBill.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-bold text-[#27324A]">{item.name}</span>
                      <span className="text-[#746E73] ml-2 text-xs">× {fmtQty(item.qty, item.cfg)}</span>
                    </div>
                    <span className="font-bold text-[#27324A]">Rs. {(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#2E3344]/10 mt-4 pt-4">
                <div className="flex justify-between font-black text-lg text-[#27324A]">
                  <span>Total</span>
                  <span>Rs. {completedBill.total.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-bold text-[#746E73] uppercase tracking-wider">Paid via</span>
                  <span className={`text-xs font-black px-2 py-1 rounded-lg ${
                    completedBill.paymentMethod === "cash" ? "bg-[#27324A]/10 text-[#27324A]"
                    : completedBill.paymentMethod === "online" ? "bg-[#41A560]/10 text-[#41A560]"
                    : "bg-[#A7653A]/10 text-[#A7653A]"
                  }`}>
                    {completedBill.paymentMethod === "udhar"
                      ? `Udhar${completedBill.customerName ? ` — ${completedBill.customerName}` : ""}`
                      : completedBill.paymentMethod === "online" ? "eSewa" : "Cash"}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => printBill(completedBill, shopName)}
                className="flex-1 h-12 rounded-2xl border-2 border-[#27324A]/15 font-bold text-[#27324A] flex items-center justify-center gap-2 hover:bg-[#f8f8f7] transition"
              >
                <Printer className="h-4 w-4" />
                Print Bill
              </button>
              <button
                onClick={() => setCompletedBill(null)}
                className="flex-1 h-12 rounded-2xl bg-[#27324A] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#1b2333] transition"
              >
                <Receipt className="h-4 w-4" />
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
