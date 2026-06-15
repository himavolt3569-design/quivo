"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
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
  PauseCircle,
  PlayCircle,
  Split,
  CreditCard,
  Wallet,
  Trash2,
  Tag,
  History,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { completePOSSale } from "@/app/actions/owner";
import {
  enqueue as enqueueOffline,
  notifyQueueChanged,
} from "@/lib/offline/pos-queue";
import { OfflineSync } from "./OfflineSync";
import {
  parkSale,
  getHeldSale,
  deleteHeldSale,
  listHeldSales,
  type HeldSaleSummary,
} from "@/app/actions/pos";

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
  /** Per-line discount in rupees (already capped to line subtotal in the UI). */
  lineDiscount: number;
}

type SplitMethod = "cash" | "card" | "online" | "udhar" | "wallet" | "qr";

interface SplitEntry {
  method: SplitMethod;
  amount: number;
  reference?: string | null;
}

interface CompletedBill {
  items: CartItem[];
  subtotal: number;
  lineDiscountTotal: number;
  orderDiscount: number;
  orderDiscountKind: "flat" | "percent";
  orderDiscountValue: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
  splits: SplitEntry[] | null;
  customerName?: string;
  timestamp: Date;
  receiptNo: string;
}

interface POSViewProps {
  shopId: string;
  shopName: string;
  ownerName: string;
  catalogProducts: CatalogProduct[];
  shopVatRegistered: boolean;
  shopVatRate: number;
  shopPanNumber: string | null;
  initialHeldSales: HeldSaleSummary[];
}

// ─── Unit intelligence ────────────────────────────────────────────────────────

const WEIGHT_UNITS = [
  "g",
  "kg",
  "gm",
  "gram",
  "grams",
  "kilogram",
  "kilograms",
  "mg",
  "milligram",
];
const VOLUME_UNITS = [
  "l",
  "ml",
  "litre",
  "litres",
  "liter",
  "liters",
  "millilitre",
  "milliliter",
  "lt",
];
const COUNT_UNITS = [
  "pcs",
  "pkt",
  "packet",
  "packets",
  "piece",
  "pieces",
  "box",
  "boxes",
  "bottle",
  "bottles",
  "can",
  "cans",
  "unit",
  "units",
  "nos",
  "no.",
  "pack",
  "packs",
  "roll",
  "rolls",
  "bag",
  "bags",
  "dozen",
  "pair",
  "pairs",
  "sheet",
  "sheets",
  "strip",
  "strips",
  "tube",
  "tubes",
  "sachet",
  "sachets",
];

function parseUnit(rawUnit: string | null): UnitConfig {
  if (!rawUnit || rawUnit.trim() === "") {
    return {
      kind: "count",
      step: 1,
      min: 1,
      label: "pc",
      priceLabel: "each",
      digits: 0,
    };
  }

  const norm = rawUnit.trim().toLowerCase();
  const parts = norm.split(/\s+/);
  const typeToken = parts.length >= 2 ? parts.slice(1).join(" ") : parts[0];

  if (WEIGHT_UNITS.includes(typeToken)) {
    if (["g", "gm", "gram", "grams", "mg", "milligram"].includes(typeToken)) {
      return {
        kind: "count",
        step: 1,
        min: 1,
        label: "pkt",
        priceLabel: "per pack",
        digits: 0,
      };
    }
    return {
      kind: "weight",
      step: 0.5,
      min: 0.5,
      label: "kg",
      priceLabel: "per kg",
      digits: 1,
    };
  }

  if (VOLUME_UNITS.includes(typeToken)) {
    if (["ml", "millilitre", "milliliter"].includes(typeToken)) {
      return {
        kind: "count",
        step: 1,
        min: 1,
        label: "btl",
        priceLabel: "per bottle",
        digits: 0,
      };
    }
    return {
      kind: "volume",
      step: 0.5,
      min: 0.5,
      label: "L",
      priceLabel: "per L",
      digits: 1,
    };
  }

  if (COUNT_UNITS.some((cu) => typeToken.includes(cu))) {
    const label = typeToken.includes("packet")
      ? "pkt"
      : typeToken.includes("piece")
        ? "pc"
        : typeToken.includes("box")
          ? "box"
          : typeToken.includes("bottle")
            ? "btl"
            : typeToken.includes("can")
              ? "can"
              : typeToken.includes("roll")
                ? "roll"
                : typeToken.includes("bag")
                  ? "bag"
                  : typeToken.includes("dozen")
                    ? "dz"
                    : typeToken.includes("strip")
                      ? "strip"
                      : typeToken.includes("sachet")
                        ? "sachet"
                        : "pc";
    return {
      kind: "count",
      step: 1,
      min: 1,
      label,
      priceLabel: `per ${label}`,
      digits: 0,
    };
  }

  return {
    kind: "count",
    step: 1,
    min: 1,
    label: typeToken.slice(0, 4),
    priceLabel: `per ${typeToken.slice(0, 4)}`,
    digits: 0,
  };
}

function fmtQty(qty: number, cfg: UnitConfig): string {
  return qty.toFixed(cfg.digits) + " " + cfg.label;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

const PAYMENT_METHODS: {
  id: SplitMethod;
  label: string;
  icon: typeof Banknote;
  color: string;
}[] = [
  {
    id: "cash",
    label: "Cash",
    icon: Banknote,
    color: "bg-[#27324A] text-white",
  },
  {
    id: "online",
    label: "eSewa",
    icon: QrCode,
    color:
      "bg-[#41A560]/10 text-[#41A560] border border-[#41A560]/20 hover:bg-[#41A560]/20",
  },
  {
    id: "udhar",
    label: "Udhar",
    icon: User,
    color:
      "bg-[#F7F0E6] text-[#A7653A] border border-[#A7653A]/20 hover:bg-[#A7653A] hover:text-white",
  },
];

const SPLIT_METHODS: {
  id: SplitMethod;
  label: string;
  icon: typeof Banknote;
}[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "qr", label: "QR", icon: QrCode },
  { id: "online", label: "Online", icon: QrCode },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "udhar", label: "Udhar", icon: User },
];

// ─── Stateless sub-components ────────────────────────────────────────────────

function UnitIcon({ kind }: { kind: UnitKind }) {
  if (kind === "weight") return <Scale className="h-2.5 w-2.5" />;
  if (kind === "volume") return <Droplets className="h-2.5 w-2.5" />;
  return <Hash className="h-2.5 w-2.5" />;
}

// ─── Bill Print ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

function paymentLabel(method: string): string {
  if (method === "udhar") return "Udhar (credit)";
  if (method === "online") return "eSewa / Online";
  if (method === "card") return "Card";
  if (method === "qr") return "QR";
  if (method === "wallet") return "Wallet";
  if (method === "split") return "Split payment";
  return "Cash";
}

function printBill(
  bill: CompletedBill,
  shopName: string,
  ownerName: string,
  panNumber: string | null,
) {
  const lines = bill.items
    .map((item) => {
      const lineSubtotal = item.price * item.qty;
      return `<tr>
      <td style="padding:4px 6px;font-size:12px;vertical-align:top;">
        ${esc(item.name)}
        <div style="font-size:10px;color:#666;">${fmtQty(item.qty, item.cfg)} &times; Rs. ${item.price.toFixed(2)}</div>
        ${item.lineDiscount > 0 ? `<div style="font-size:10px;color:#A7653A;">Line discount: &minus; Rs. ${item.lineDiscount.toFixed(2)}</div>` : ""}
      </td>
      <td style="padding:4px 6px;font-size:12px;text-align:right;vertical-align:top;font-weight:bold;">Rs. ${(lineSubtotal - item.lineDiscount).toFixed(2)}</td>
    </tr>`;
    })
    .join("");

  const ts = bill.timestamp;
  const dateStr = ts.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
  const timeStr = ts.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const splitRowsHtml =
    bill.splits && bill.splits.length > 0
      ? bill.splits
          .map(
            (s) =>
              `<div class="row"><span>${esc(paymentLabel(s.method))}</span><strong>Rs. ${s.amount.toFixed(2)}</strong></div>`,
          )
          .join("")
      : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Receipt #${bill.receiptNo}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Courier New',monospace; width:76mm; margin:auto; padding:10px; color:#000; }
h1 { font-size:16px; text-align:center; margin-bottom:2px; }
.owner { font-size:10px; text-align:center; color:#555; }
.meta { font-size:10px; text-align:center; color:#555; margin:6px 0 8px; }
.divider { border-top:1px dashed #999; margin:6px 0; }
.row { display:flex; justify-content:space-between; font-size:11px; padding:1px 0; }
.row strong { font-weight:bold; }
table { width:100%; border-collapse:collapse; }
.total-row td { padding:6px 6px; font-size:14px; font-weight:bold; border-top:1px solid #000; }
.footer { font-size:9px; text-align:center; margin-top:10px; color:#777; }
.pan { font-size:10px; text-align:center; color:#555; }
@media print { @page { margin:0; size:76mm auto; } }
</style></head>
<body>
<h1>${esc(shopName)}</h1>
${ownerName ? `<div class="owner">Prop: ${esc(ownerName)}</div>` : ""}
${panNumber ? `<div class="pan">PAN: ${esc(panNumber)}</div>` : ""}
<div class="meta">Receipt #${bill.receiptNo}<br/>${dateStr} &middot; ${timeStr}</div>
${bill.customerName ? `<div class="row"><span>Buyer</span><strong>${esc(bill.customerName)}</strong></div><div class="divider"></div>` : '<div class="divider"></div>'}
<table><tbody>${lines}</tbody></table>
<div class="divider"></div>
<div class="row"><span>Subtotal</span><span>Rs. ${bill.subtotal.toFixed(2)}</span></div>
${bill.lineDiscountTotal > 0 ? `<div class="row" style="color:#A7653A"><span>Line discounts</span><span>&minus; Rs. ${bill.lineDiscountTotal.toFixed(2)}</span></div>` : ""}
${bill.orderDiscount > 0 ? `<div class="row" style="color:#A7653A"><span>Order discount${bill.orderDiscountKind === "percent" ? ` (${bill.orderDiscountValue}%)` : ""}</span><span>&minus; Rs. ${bill.orderDiscount.toFixed(2)}</span></div>` : ""}
${bill.taxAmount > 0 ? `<div class="row"><span>VAT (${bill.taxRate.toFixed(2)}%)</span><span>Rs. ${bill.taxAmount.toFixed(2)}</span></div>` : ""}
<table><tr class="total-row">
  <td>TOTAL</td>
  <td style="text-align:right;">Rs. ${bill.total.toFixed(2)}</td>
</tr></table>
${
  splitRowsHtml
    ? `<div class="divider"></div>${splitRowsHtml}`
    : `<div class="row" style="margin-top:6px;"><span>Payment</span><strong>${esc(paymentLabel(bill.paymentMethod))}</strong></div>`
}
<div class="footer">Thank you for shopping at ${esc(shopName)}!<br/>Powered by Quivo</div>
</body></html>`;

  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) {
    toast.error("Allow pop-ups to print receipts.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 400);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function POSView({
  shopId,
  shopName,
  ownerName,
  catalogProducts,
  shopVatRegistered,
  shopVatRate,
  shopPanNumber,
  initialHeldSales,
}: POSViewProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [completedBill, setCompletedBill] = useState<CompletedBill | null>(
    null,
  );
  const [lastReceiptBill, setLastReceiptBill] = useState<CompletedBill | null>(
    null,
  );
  const [udharName, setUdharName] = useState("");
  const [showUdharPrompt, setShowUdharPrompt] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [orderDiscountValue, setOrderDiscountValue] = useState(0);
  const [orderDiscountKind, setOrderDiscountKind] = useState<
    "flat" | "percent"
  >("flat");
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<
    { method: SplitMethod; amount: string; reference?: string }[]
  >([]);
  const [heldSales, setHeldSales] =
    useState<HeldSaleSummary[]>(initialHeldSales);
  const [isHeldSheetOpen, setIsHeldSheetOpen] = useState(false);
  const udharInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const cats = new Set(
      catalogProducts.map((p) => p.category).filter(Boolean),
    );
    return ["All", ...Array.from(cats)] as string[];
  }, [catalogProducts]);

  const filteredProducts = useMemo(() => {
    return catalogProducts.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.brand ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.variant ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === "All" || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [catalogProducts, search, activeCategory]);

  // ─── Money math ────────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => round2(cart.reduce((acc, item) => acc + item.price * item.qty, 0)),
    [cart],
  );
  const lineDiscountTotal = useMemo(
    () =>
      round2(
        cart.reduce(
          (acc, item) =>
            acc + Math.min(item.lineDiscount, item.price * item.qty),
          0,
        ),
      ),
    [cart],
  );
  const orderDiscount = useMemo(() => {
    if (orderDiscountValue <= 0) return 0;
    const base = Math.max(0, subtotal - lineDiscountTotal);
    const raw =
      orderDiscountKind === "percent"
        ? (base * orderDiscountValue) / 100
        : orderDiscountValue;
    return round2(Math.min(Math.max(raw, 0), base));
  }, [subtotal, lineDiscountTotal, orderDiscountKind, orderDiscountValue]);
  const taxBase = useMemo(
    () => Math.max(0, round2(subtotal - lineDiscountTotal - orderDiscount)),
    [subtotal, lineDiscountTotal, orderDiscount],
  );
  const taxRate = shopVatRegistered ? shopVatRate : 0;
  const taxAmount = useMemo(
    () => (shopVatRegistered ? round2((taxBase * taxRate) / 100) : 0),
    [shopVatRegistered, taxBase, taxRate],
  );
  const total = useMemo(
    () => round2(taxBase + taxAmount),
    [taxBase, taxAmount],
  );

  const splitSum = useMemo(
    () => round2(splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0)),
    [splits],
  );
  const splitRemaining = round2(total - splitSum);

  // ─── Cart mutations ────────────────────────────────────────────────────────
  const addToCart = (product: CatalogProduct) => {
    const cfg = parseUnit(product.unit);
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        const newQty = parseFloat((existing.qty + cfg.step).toFixed(3));
        if (newQty > existing.maxStock) {
          toast.error("Not enough stock.");
          return prev;
        }
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: newQty } : i,
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          qty: cfg.min,
          maxStock: product.stock,
          unit: product.unit,
          cfg,
          lineDiscount: 0,
        },
      ];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i;
          const newQty = parseFloat((i.qty + delta * i.cfg.step).toFixed(3));
          if (newQty <= 0) return null as unknown as CartItem;
          if (newQty > i.maxStock) {
            toast.error("Not enough stock.");
            return i;
          }
          // Cap the line discount if the new line subtotal can't absorb it.
          const cappedDiscount = Math.min(i.lineDiscount, i.price * newQty);
          return { ...i, qty: newQty, lineDiscount: cappedDiscount };
        })
        .filter(Boolean),
    );
  };

  const updateLineDiscount = (id: string, value: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const cap = i.price * i.qty;
        const safe = Math.max(0, Math.min(value, cap));
        return { ...i, lineDiscount: round2(safe) };
      }),
    );
  };

  const resetCart = () => {
    setCart([]);
    setBuyerName("");
    setOrderDiscountValue(0);
    setOrderDiscountKind("flat");
    setUdharName("");
    setShowUdharPrompt(false);
    setSplitMode(false);
    setSplits([]);
  };

  // ─── Held sales ────────────────────────────────────────────────────────────
  const refreshHeldSales = async () => {
    const res = await listHeldSales(shopId);
    if (res.rows) setHeldSales(res.rows);
  };

  const handlePark = () => {
    if (!cart.length) {
      toast.error("Cart is empty.");
      return;
    }
    startTransition(async () => {
      const res = await parkSale({
        shopId,
        // Zod schema uses passthrough() on cfg, so the structural types match
        // at runtime; the cast quiets the index-signature mismatch from
        // passthrough's `[x: string]: unknown`.
        cart: cart as unknown as Parameters<typeof parkSale>[0]["cart"],
        note: null,
        customerName: null,
        buyerName: buyerName.trim() || null,
        orderDiscount,
        orderDiscountKind,
        orderDiscountValue,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Sale parked. Resume any time from Held Sales.");
      resetCart();
      await refreshHeldSales();
    });
  };

  const handleResume = (id: string) => {
    startTransition(async () => {
      const res = await getHeldSale(id);
      if (res.error || !res.row) {
        toast.error(res.error ?? "Could not load held sale");
        return;
      }
      const payload = (res.row.cart ?? {}) as {
        cart?: CartItem[];
        orderDiscount?: number;
        orderDiscountKind?: "flat" | "percent";
        orderDiscountValue?: number;
        buyerName?: string | null;
      };
      const lines = Array.isArray(payload.cart) ? payload.cart : [];
      // Re-parse cfg (the held JSON may have been written by an older client).
      const restored = lines.map((l) => ({
        ...l,
        cfg: l.cfg ?? parseUnit(l.unit ?? ""),
        lineDiscount: typeof l.lineDiscount === "number" ? l.lineDiscount : 0,
      }));
      setCart(restored);
      setOrderDiscountKind(payload.orderDiscountKind ?? "flat");
      setOrderDiscountValue(payload.orderDiscountValue ?? 0);
      setBuyerName(payload.buyerName ?? "");
      setIsHeldSheetOpen(false);
      const del = await deleteHeldSale(id);
      if (!del.error) await refreshHeldSales();
      toast.success("Sale resumed");
    });
  };

  const handleCancelHold = (id: string) => {
    startTransition(async () => {
      const res = await deleteHeldSale(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      await refreshHeldSales();
      toast.success("Held sale cleared");
    });
  };

  // ─── Splits ─────────────────────────────────────────────────────────────────
  const toggleSplitMode = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty.");
      return;
    }
    setSplitMode((prev) => !prev);
    if (splitMode) setSplits([]);
  };

  const addSplit = (method: SplitMethod) => {
    setSplits((prev) => {
      if (prev.length >= 3) {
        toast.error("At most 3 split methods allowed.");
        return prev;
      }
      const suggested = Math.max(0, splitRemaining);
      return [
        ...prev,
        { method, amount: suggested > 0 ? suggested.toFixed(2) : "" },
      ];
    });
  };

  const updateSplitAmount = (idx: number, amount: string) => {
    setSplits((prev) => prev.map((s, i) => (i === idx ? { ...s, amount } : s)));
  };

  const removeSplit = (idx: number) => {
    setSplits((prev) => prev.filter((_, i) => i !== idx));
  };

  // ─── Checkout ──────────────────────────────────────────────────────────────
  const buildLines = () =>
    cart.map((i) => ({
      product_id: i.id,
      qty: i.qty,
      name: i.name,
      unit_price: i.price,
      line_discount: round2(i.lineDiscount),
    }));

  const buildBillRecord = (
    paymentMethod: string,
    finalBuyer: string | null,
    splitsForBill: SplitEntry[] | null,
  ): CompletedBill => {
    const now = new Date();
    return {
      items: [...cart],
      subtotal,
      lineDiscountTotal,
      orderDiscount,
      orderDiscountKind,
      orderDiscountValue,
      taxRate,
      taxAmount,
      total,
      paymentMethod,
      splits: splitsForBill,
      customerName: finalBuyer ?? undefined,
      timestamp: now,
      receiptNo: now.getTime().toString().slice(-8),
    };
  };

  const buildNotes = (paymentMethod: string, finalBuyer: string | null) => {
    const parts: string[] = [
      `POS Sale${paymentMethod === "udhar" ? " (Udhar)" : paymentMethod === "split" ? " (Split)" : ""}`,
    ];
    if (finalBuyer) parts.push(`Buyer: ${finalBuyer}`);
    if (orderDiscount > 0) {
      const tag =
        orderDiscountKind === "percent"
          ? `${orderDiscountValue}%`
          : `Rs.${orderDiscountValue}`;
      parts.push(`Order discount: ${tag} (Rs.${orderDiscount.toFixed(2)})`);
    }
    if (lineDiscountTotal > 0)
      parts.push(`Line discounts: Rs.${lineDiscountTotal.toFixed(2)}`);
    if (taxAmount > 0)
      parts.push(`VAT ${taxRate.toFixed(2)}%: Rs.${taxAmount.toFixed(2)}`);
    return parts.join(" — ");
  };

  const handleCheckout = (paymentMethod: string, customerName?: string) => {
    if (!cart.length) {
      toast.error("Cart is empty.");
      return;
    }
    const finalBuyer =
      (paymentMethod === "udhar" ? customerName : null) ||
      buyerName.trim() ||
      null;
    const splitsForRpc: SplitEntry[] | null =
      paymentMethod === "split"
        ? splits.map((s) => ({
            method: s.method,
            amount: round2(Number(s.amount) || 0),
            reference: s.reference?.trim() || null,
          }))
        : null;

    if (
      splitsForRpc &&
      Math.abs(splitsForRpc.reduce((a, s) => a + s.amount, 0) - total) > 0.01
    ) {
      toast.error(
        `Splits (Rs. ${splitSum.toFixed(2)}) must total Rs. ${total.toFixed(2)}`,
      );
      return;
    }

    const posInput = {
      shopId,
      items: buildLines(),
      subtotal,
      discount: round2(lineDiscountTotal + orderDiscount),
      taxRate,
      taxAmount,
      total,
      paymentMethod: paymentMethod === "split" ? "split" : paymentMethod,
      splits: splitsForRpc,
      notes: buildNotes(paymentMethod, finalBuyer),
    };

    // Offline path: stash the sale locally and let OfflineSync replay it
    // when the network is back. Receipt prints just fine since the bill
    // record is built from local state.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      startTransition(async () => {
        try {
          await enqueueOffline({
            tempId: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            shopId,
            input: posInput,
          });
          notifyQueueChanged();
          const bill = buildBillRecord(paymentMethod, finalBuyer, splitsForRpc);
          setCompletedBill(bill);
          setLastReceiptBill(bill);
          setIsMobileCartOpen(false);
          resetCart();
          toast.success("Sale queued — will sync when online.");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Could not queue sale.",
          );
        }
      });
      return;
    }

    startTransition(async () => {
      const result = await completePOSSale(posInput);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      const bill = buildBillRecord(paymentMethod, finalBuyer, splitsForRpc);
      setCompletedBill(bill);
      setLastReceiptBill(bill);
      setIsMobileCartOpen(false);
      resetCart();
    });
  };

  const handlePaymentClick = (pmId: SplitMethod) => {
    if (!cart.length) {
      toast.error("Cart is empty.");
      return;
    }
    if (splitMode) {
      addSplit(pmId);
      return;
    }
    if (pmId === "udhar") {
      setShowUdharPrompt(true);
      setTimeout(() => udharInputRef.current?.focus(), 100);
      return;
    }
    handleCheckout(pmId);
  };

  const handleSplitConfirm = () => {
    if (Math.abs(splitRemaining) > 0.01) {
      toast.error(
        `Remaining Rs. ${splitRemaining.toFixed(2)} must be 0 to confirm.`,
      );
      return;
    }
    handleCheckout("split");
  };

  // ─── Render helpers ────────────────────────────────────────────────────────
  // Some lint rules want stable references; useEffect placeholder for now
  // (no side-effects beyond resetting modal state).
  useEffect(() => {
    if (!completedBill && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [completedBill]);

  const cartContent = (
    <CartContent
      cart={cart}
      subtotal={subtotal}
      lineDiscountTotal={lineDiscountTotal}
      orderDiscount={orderDiscount}
      orderDiscountValue={orderDiscountValue}
      orderDiscountKind={orderDiscountKind}
      taxRate={taxRate}
      taxAmount={taxAmount}
      total={total}
      vatRegistered={shopVatRegistered}
      buyerName={buyerName}
      isPending={isPending}
      showUdharPrompt={showUdharPrompt}
      udharName={udharName}
      udharInputRef={udharInputRef}
      splitMode={splitMode}
      splits={splits}
      splitSum={splitSum}
      splitRemaining={splitRemaining}
      onClearCart={resetCart}
      onUpdateQty={updateQty}
      onUpdateLineDiscount={updateLineDiscount}
      onPaymentClick={handlePaymentClick}
      onCheckout={handleCheckout}
      onDismissUdhar={() => setShowUdharPrompt(false)}
      onUdharNameChange={setUdharName}
      onBuyerNameChange={setBuyerName}
      onDiscountValueChange={setOrderDiscountValue}
      onDiscountKindChange={setOrderDiscountKind}
      onToggleSplit={toggleSplitMode}
      onAddSplit={addSplit}
      onUpdateSplitAmount={updateSplitAmount}
      onRemoveSplit={removeSplit}
      onConfirmSplit={handleSplitConfirm}
      onPark={handlePark}
    />
  );

  return (
    <>
      <OfflineSync />
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
              {/* Held sales sheet trigger */}
              <Sheet open={isHeldSheetOpen} onOpenChange={setIsHeldSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-12 lg:h-14 rounded-xl lg:rounded-2xl border-[#27324A]/15 text-[#27324A] font-bold shrink-0 px-3 lg:px-4 gap-2"
                  >
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">Held</span>
                    {heldSales.length > 0 && (
                      <span className="bg-[#A7653A] text-white text-[10px] font-black rounded-full h-5 min-w-[1.25rem] px-1 flex items-center justify-center">
                        {heldSales.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md p-0">
                  <SheetTitle className="sr-only">Held sales</SheetTitle>
                  <HeldSalesPanel
                    holds={heldSales}
                    onResume={handleResume}
                    onCancel={handleCancelHold}
                    isPending={isPending}
                  />
                </SheetContent>
              </Sheet>
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
                <p className="font-bold text-[#27324A]">
                  No products in catalog yet.
                </p>
                <p className="text-sm text-[#746E73]">
                  Add products in the Inventory section first.
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-[#746E73] font-medium">
                No products match &quot;{search}&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {filteredProducts.map((p) => {
                  const colorClass =
                    CATEGORY_COLORS[p.category ?? "Other"] ?? "bg-gray-50";
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
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="absolute top-2 right-2 h-11 w-11 rounded-xl object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                      ) : (
                        <div
                          className={`absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 rounded-full ${colorClass} opacity-50 group-hover:scale-150 transition-transform duration-500`}
                        />
                      )}
                      {cartItem && (
                        <span className="absolute top-2 right-2 h-5 min-w-[1.25rem] px-1 bg-[#A7653A] text-white rounded-full text-[10px] font-black flex items-center justify-center z-10">
                          {fmtQty(cartItem.qty, cartItem.cfg)}
                        </span>
                      )}
                      <div className="mt-auto relative z-10">
                        <span className="text-xs lg:text-sm font-black text-[#27324A] line-clamp-2 block">
                          {p.name}
                        </span>
                        {p.variant && (
                          <span className="text-[9px] text-[#746E73] font-medium block">
                            {p.variant}
                          </span>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] lg:text-xs font-bold text-[#A7653A]">
                            Rs. {p.price}
                          </span>
                          <span className="text-[9px] text-[#746E73]">
                            {cfg.priceLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <UnitIcon kind={cfg.kind} />
                          <span className="text-[9px] text-[#746E73] font-medium">
                            {cfg.kind === "count"
                              ? `Stock: ${Math.floor(p.stock)} ${cfg.label}`
                              : `Stock: ${p.stock} ${cfg.label}`}
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
          {cartContent}
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
                  <span className="font-bold">
                    {cart.length === 0
                      ? "Cart Empty"
                      : `${cart.length} item${cart.length > 1 ? "s" : ""}`}
                  </span>
                </div>
                <span className="font-black text-lg">
                  Rs. {total.toFixed(2)}
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="h-[85vh] p-0 rounded-t-[2rem]"
            >
              <SheetTitle className="sr-only">Cart</SheetTitle>
              {cartContent}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Re-print persistent button — visible once a sale is done. */}
      {lastReceiptBill && !completedBill && (
        <button
          onClick={() =>
            printBill(lastReceiptBill, shopName, ownerName, shopPanNumber)
          }
          className="fixed bottom-24 lg:bottom-6 right-4 z-40 h-12 px-4 rounded-2xl bg-white border-2 border-[#27324A]/15 text-[#27324A] font-bold shadow-lg flex items-center gap-2 hover:bg-[#f8f8f7] transition"
          title={`Re-print receipt #${lastReceiptBill.receiptNo}`}
        >
          <Printer className="h-4 w-4" />
          Re-print #{lastReceiptBill.receiptNo}
        </button>
      )}

      {/* Completed Bill Modal */}
      {completedBill && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-[#27324A] to-[#1b2333] p-6 text-white text-center">
              <div className="h-14 w-14 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-8 w-8 text-green-300" />
              </div>
              <h2 className="font-black text-xl">Sale Complete!</h2>
              <p className="text-white/70 text-sm mt-1">
                Receipt #{completedBill.receiptNo} ·{" "}
                {completedBill.timestamp.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div className="p-6">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {completedBill.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-sm"
                  >
                    <div>
                      <span className="font-bold text-[#27324A]">
                        {item.name}
                      </span>
                      <span className="text-[#746E73] ml-2 text-xs">
                        × {fmtQty(item.qty, item.cfg)}
                      </span>
                      {item.lineDiscount > 0 && (
                        <span className="text-[10px] text-[#A7653A] block">
                          − Rs. {item.lineDiscount.toFixed(2)} line discount
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-[#27324A]">
                      Rs.{" "}
                      {(item.price * item.qty - item.lineDiscount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#2E3344]/10 mt-4 pt-4 space-y-1.5">
                <div className="flex justify-between text-sm text-[#746E73] font-medium">
                  <span>Subtotal</span>
                  <span>Rs. {completedBill.subtotal.toFixed(2)}</span>
                </div>
                {completedBill.lineDiscountTotal > 0 && (
                  <div className="flex justify-between text-sm text-[#A7653A]">
                    <span>Line discounts</span>
                    <span>
                      − Rs. {completedBill.lineDiscountTotal.toFixed(2)}
                    </span>
                  </div>
                )}
                {completedBill.orderDiscount > 0 && (
                  <div className="flex justify-between text-sm font-bold text-[#A7653A]">
                    <span>
                      Order discount
                      {completedBill.orderDiscountKind === "percent"
                        ? ` (${completedBill.orderDiscountValue}%)`
                        : ""}
                    </span>
                    <span>− Rs. {completedBill.orderDiscount.toFixed(2)}</span>
                  </div>
                )}
                {completedBill.taxAmount > 0 && (
                  <div className="flex justify-between text-sm text-[#27324A]">
                    <span>VAT ({completedBill.taxRate.toFixed(2)}%)</span>
                    <span>Rs. {completedBill.taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-lg text-[#27324A] pt-1.5 border-t border-[#2E3344]/10">
                  <span>Total</span>
                  <span>Rs. {completedBill.total.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs font-bold text-[#746E73] uppercase tracking-wider">
                    Paid via
                  </span>
                  {completedBill.splits && completedBill.splits.length > 0 ? (
                    completedBill.splits.map((s, i) => (
                      <span
                        key={i}
                        className="text-xs font-black px-2 py-1 rounded-lg bg-[#27324A]/10 text-[#27324A]"
                      >
                        {paymentLabel(s.method)} · Rs. {s.amount.toFixed(2)}
                      </span>
                    ))
                  ) : (
                    <span
                      className={`text-xs font-black px-2 py-1 rounded-lg ${
                        completedBill.paymentMethod === "cash"
                          ? "bg-[#27324A]/10 text-[#27324A]"
                          : completedBill.paymentMethod === "online"
                            ? "bg-[#41A560]/10 text-[#41A560]"
                            : completedBill.paymentMethod === "udhar"
                              ? "bg-[#A7653A]/10 text-[#A7653A]"
                              : "bg-[#27324A]/10 text-[#27324A]"
                      }`}
                    >
                      {completedBill.paymentMethod === "udhar"
                        ? `Udhar${completedBill.customerName ? ` — ${completedBill.customerName}` : ""}`
                        : paymentLabel(completedBill.paymentMethod)}
                    </span>
                  )}
                </div>
                {completedBill.customerName &&
                  completedBill.paymentMethod !== "udhar" && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-[#746E73] uppercase tracking-wider">
                        Buyer
                      </span>
                      <span className="text-xs font-bold text-[#27324A]">
                        {completedBill.customerName}
                      </span>
                    </div>
                  )}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() =>
                  printBill(completedBill, shopName, ownerName, shopPanNumber)
                }
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

// ─── CartContent ─────────────────────────────────────────────────────────────

interface CartContentProps {
  cart: CartItem[];
  subtotal: number;
  lineDiscountTotal: number;
  orderDiscount: number;
  orderDiscountValue: number;
  orderDiscountKind: "flat" | "percent";
  taxRate: number;
  taxAmount: number;
  total: number;
  vatRegistered: boolean;
  buyerName: string;
  isPending: boolean;
  showUdharPrompt: boolean;
  udharName: string;
  udharInputRef: React.RefObject<HTMLInputElement | null>;
  splitMode: boolean;
  splits: { method: SplitMethod; amount: string; reference?: string }[];
  splitSum: number;
  splitRemaining: number;
  onClearCart: () => void;
  onUpdateQty: (id: string, delta: number) => void;
  onUpdateLineDiscount: (id: string, value: number) => void;
  onPaymentClick: (id: SplitMethod) => void;
  onCheckout: (method: string, name?: string) => void;
  onDismissUdhar: () => void;
  onUdharNameChange: (v: string) => void;
  onBuyerNameChange: (v: string) => void;
  onDiscountValueChange: (v: number) => void;
  onDiscountKindChange: (k: "flat" | "percent") => void;
  onToggleSplit: () => void;
  onAddSplit: (m: SplitMethod) => void;
  onUpdateSplitAmount: (idx: number, v: string) => void;
  onRemoveSplit: (idx: number) => void;
  onConfirmSplit: () => void;
  onPark: () => void;
}

function CartContent(props: CartContentProps) {
  const {
    cart,
    subtotal,
    lineDiscountTotal,
    orderDiscount,
    orderDiscountValue,
    orderDiscountKind,
    taxRate,
    taxAmount,
    total,
    vatRegistered,
    buyerName,
    isPending,
    showUdharPrompt,
    udharName,
    udharInputRef,
    splitMode,
    splits,
    splitSum,
    splitRemaining,
    onClearCart,
    onUpdateQty,
    onUpdateLineDiscount,
    onPaymentClick,
    onCheckout,
    onDismissUdhar,
    onUdharNameChange,
    onBuyerNameChange,
    onDiscountValueChange,
    onDiscountKindChange,
    onToggleSplit,
    onAddSplit,
    onUpdateSplitAmount,
    onRemoveSplit,
    onConfirmSplit,
    onPark,
  } = props;

  return (
    <div className="w-full h-full flex flex-col bg-white lg:rounded-[2rem] lg:border border-[#2E3344]/8 lg:shadow-sm overflow-hidden shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-[#2E3344]/8 flex items-center justify-between bg-[#F7F0E6]/30">
        <h2 className="font-black text-[#27324A] flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-[#A7653A]" /> Current Sale
        </h2>
        {cart.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onPark}
              disabled={isPending}
              className="text-xs font-bold text-[#27324A] hover:bg-[#27324A]/5 px-3 py-1.5 rounded-lg transition flex items-center gap-1 disabled:opacity-40"
              title="Park this cart"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Park
            </button>
            <button
              onClick={onClearCart}
              className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
            >
              Clear
            </button>
          </div>
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
            {cart.map((item) => {
              const lineSubtotal = item.price * item.qty;
              const lineNet = Math.max(0, lineSubtotal - item.lineDiscount);
              return (
                <div
                  key={item.id}
                  className="flex flex-col p-3 hover:bg-[#f8f8f7] rounded-xl group transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-bold text-[#27324A] line-clamp-1 pr-2">
                      {item.name}
                    </p>
                    <p className="text-sm font-black text-[#27324A] shrink-0">
                      Rs. {lineNet.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[9px] text-[#746E73] font-bold uppercase tracking-widest flex items-center gap-1">
                      <UnitIcon kind={item.cfg.kind} />
                      Rs. {item.price} {item.cfg.priceLabel}
                    </span>
                    <div className="flex items-center gap-2 bg-white border border-[#2E3344]/10 rounded-lg p-1">
                      <button
                        onClick={() => onUpdateQty(item.id, -1)}
                        className="h-6 w-6 rounded bg-[#f8f8f7] hover:bg-[#E8E3D1] flex items-center justify-center text-[#27324A]"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-black min-w-[3rem] text-center">
                        {fmtQty(item.qty, item.cfg)}
                      </span>
                      <button
                        onClick={() => onUpdateQty(item.id, 1)}
                        className="h-6 w-6 rounded bg-[#F7F0E6] hover:bg-[#A7653A] hover:text-white flex items-center justify-center text-[#A7653A] transition"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {/* Per-line discount */}
                  <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-[#746E73]">
                    <Tag className="h-3 w-3 text-[#A7653A]" />
                    <span className="uppercase tracking-wider">
                      Line discount
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      max={lineSubtotal}
                      value={item.lineDiscount > 0 ? item.lineDiscount : ""}
                      onChange={(e) =>
                        onUpdateLineDiscount(
                          item.id,
                          Number(e.target.value) || 0,
                        )
                      }
                      placeholder="0"
                      className="flex-1 px-2 h-7 text-xs text-right outline-none border border-[#2E3344]/10 rounded bg-white"
                    />
                    <span>Rs.</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Udhar Customer Name Prompt */}
      {showUdharPrompt && (
        <div className="px-5 py-3 bg-[#F7F0E6]/60 border-t border-[#A7653A]/20">
          <p className="text-xs font-bold text-[#A7653A] mb-2 uppercase tracking-wider">
            Customer name (Udhar)
          </p>
          <div className="flex gap-2">
            <Input
              ref={udharInputRef}
              value={udharName}
              onChange={(e) => onUdharNameChange(e.target.value)}
              placeholder="e.g. Ram Bahadur"
              className="h-9 text-sm rounded-xl"
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  onCheckout("udhar", udharName || undefined);
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
            <button
              onClick={onDismissUdhar}
              className="h-9 w-9 rounded-xl border border-[#2E3344]/10 flex items-center justify-center shrink-0"
            >
              <X className="h-4 w-4 text-[#746E73]" />
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-5 border-t border-[#2E3344]/8 bg-[#f8f8f7]">
        {/* Buyer name (optional) */}
        {cart.length > 0 && (
          <div className="mb-3">
            <Input
              value={buyerName}
              onChange={(e) => onBuyerNameChange(e.target.value)}
              placeholder="Buyer name (optional)"
              className="h-9 text-sm rounded-xl bg-white"
            />
          </div>
        )}

        {/* Order discount */}
        {cart.length > 0 && (
          <div className="mb-3 flex gap-2 items-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#746E73] shrink-0">
              Order discount
            </span>
            <div className="flex flex-1 rounded-xl border border-[#2E3344]/10 overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => onDiscountKindChange("flat")}
                className={`px-2 text-xs font-black ${orderDiscountKind === "flat" ? "bg-[#27324A] text-white" : "text-[#746E73]"}`}
                aria-label="Flat amount"
              >
                Rs
              </button>
              <button
                type="button"
                onClick={() => onDiscountKindChange("percent")}
                className={`px-2 text-xs font-black ${orderDiscountKind === "percent" ? "bg-[#27324A] text-white" : "text-[#746E73]"}`}
                aria-label="Percent"
              >
                %
              </button>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={orderDiscountValue || ""}
                onChange={(e) =>
                  onDiscountValueChange(Number(e.target.value) || 0)
                }
                placeholder="0"
                className="flex-1 px-2 h-9 text-sm outline-none bg-transparent"
              />
            </div>
          </div>
        )}

        {/* Money breakdown */}
        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-sm text-[#746E73] font-medium">
            <span>
              Subtotal · {cart.length} item{cart.length !== 1 ? "s" : ""}
            </span>
            <span>Rs. {subtotal.toFixed(2)}</span>
          </div>
          {lineDiscountTotal > 0 && (
            <div className="flex justify-between text-xs text-[#A7653A]">
              <span>Line discounts</span>
              <span>− Rs. {lineDiscountTotal.toFixed(2)}</span>
            </div>
          )}
          {orderDiscount > 0 && (
            <div className="flex justify-between text-sm font-bold text-[#A7653A]">
              <span>
                Order discount
                {orderDiscountKind === "percent"
                  ? ` (${orderDiscountValue}%)`
                  : ""}
              </span>
              <span>− Rs. {orderDiscount.toFixed(2)}</span>
            </div>
          )}
          {vatRegistered && cart.length > 0 && (
            <div className="flex justify-between text-xs text-[#27324A] font-bold">
              <span>VAT ({taxRate.toFixed(2)}%)</span>
              <span>Rs. {taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-black text-[#27324A] pt-2 border-t border-[#2E3344]/10">
            <span>Total</span>
            <span>Rs. {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Split mode toggle */}
        {cart.length > 0 && (
          <button
            onClick={onToggleSplit}
            className={`w-full mb-3 h-10 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
              splitMode
                ? "bg-[#27324A] text-white border-[#27324A]"
                : "bg-white text-[#27324A] border-[#27324A]/15 hover:bg-[#f8f8f7]"
            }`}
          >
            <Split className="h-4 w-4" />
            {splitMode ? "Cancel split payment" : "Split payment"}
          </button>
        )}

        {/* Splits editor */}
        {splitMode && (
          <div className="mb-3 p-3 rounded-xl bg-white border border-[#27324A]/10 space-y-2">
            {splits.length === 0 ? (
              <p className="text-[11px] font-bold text-[#746E73]">
                Tap a method below to start a split (max 3).
              </p>
            ) : (
              splits.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#27324A] w-16">
                    {paymentLabel(s.method)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={s.amount}
                    onChange={(e) => onUpdateSplitAmount(idx, e.target.value)}
                    placeholder="0.00"
                    className="flex-1 h-9 px-2 text-sm border border-[#2E3344]/10 rounded-lg outline-none"
                  />
                  <button
                    onClick={() => onRemoveSplit(idx)}
                    className="h-9 w-9 rounded-lg border border-[#2E3344]/10 flex items-center justify-center text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
            <div className="flex items-center justify-between pt-1 text-[11px] font-bold">
              <span className="text-[#746E73]">Allocated</span>
              <span className="text-[#27324A]">
                Rs. {splitSum.toFixed(2)} / Rs. {total.toFixed(2)}
              </span>
            </div>
            {Math.abs(splitRemaining) > 0.01 && (
              <p
                className={`text-[11px] font-bold ${splitRemaining > 0 ? "text-[#A7653A]" : "text-red-600"}`}
              >
                {splitRemaining > 0
                  ? `Remaining: Rs. ${splitRemaining.toFixed(2)}`
                  : `Over by: Rs. ${(-splitRemaining).toFixed(2)}`}
              </p>
            )}
            <button
              onClick={onConfirmSplit}
              disabled={
                isPending ||
                splits.length === 0 ||
                Math.abs(splitRemaining) > 0.01
              }
              className="w-full h-10 rounded-xl bg-[#27324A] text-white text-sm font-bold disabled:opacity-40"
            >
              Confirm split sale
            </button>
          </div>
        )}

        {/* Payment buttons (or split-method picker) */}
        {!splitMode ? (
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.id}
                disabled={isPending || cart.length === 0}
                onClick={() => onPaymentClick(pm.id)}
                className={`py-3 rounded-xl flex flex-col items-center gap-1 active:scale-95 transition shadow-sm disabled:opacity-40 ${pm.color}`}
              >
                <pm.icon className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {pm.label}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {SPLIT_METHODS.map((pm) => (
              <button
                key={pm.id}
                disabled={isPending || cart.length === 0 || splits.length >= 3}
                onClick={() => onAddSplit(pm.id)}
                className="py-2 rounded-xl flex flex-col items-center gap-1 active:scale-95 transition shadow-sm disabled:opacity-40 bg-white border border-[#27324A]/15 text-[#27324A] hover:bg-[#f8f8f7]"
              >
                <pm.icon className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {pm.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HeldSalesPanel ──────────────────────────────────────────────────────────

interface HeldSalesPanelProps {
  holds: HeldSaleSummary[];
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  isPending: boolean;
}

function HeldSalesPanel({
  holds,
  onResume,
  onCancel,
  isPending,
}: HeldSalesPanelProps) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-5 border-b border-[#2E3344]/8 flex items-center gap-2">
        <History className="h-5 w-5 text-[#A7653A]" />
        <h2 className="font-black text-[#27324A]">Held sales</h2>
        <span className="ml-auto text-xs font-bold text-[#746E73]">
          {holds.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {holds.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#746E73] py-12">
            <PauseCircle className="h-10 w-10 opacity-20 mb-3" />
            <p className="text-sm font-bold">No parked sales.</p>
            <p className="text-xs mt-1">Park a cart to resume it later.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {holds.map((h) => (
              <li
                key={h.id}
                className="p-3 rounded-2xl border border-[#2E3344]/8 bg-[#f8f8f7]/50 hover:bg-white transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#27324A]">
                      Rs. {h.total.toFixed(2)}
                    </p>
                    <p className="text-[11px] font-bold text-[#746E73] mt-0.5">
                      {h.item_count} item{h.item_count !== 1 ? "s" : ""}
                      {h.customer_name ? ` · ${h.customer_name}` : ""}
                    </p>
                    {h.note && (
                      <p className="text-[11px] text-[#746E73] mt-1 line-clamp-2">
                        {h.note}
                      </p>
                    )}
                    <p className="text-[10px] text-[#a4a09a] mt-1">
                      {new Date(h.created_at).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => onResume(h.id)}
                      disabled={isPending}
                      className="h-9 px-3 rounded-xl bg-[#27324A] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40 hover:bg-[#1b2333]"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Resume
                    </button>
                    <button
                      onClick={() => onCancel(h.id)}
                      disabled={isPending}
                      className="h-9 px-3 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-bold flex items-center gap-1 disabled:opacity-40 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
