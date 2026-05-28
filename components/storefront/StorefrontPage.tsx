"use client";

import { useEffect, useRef, useState, useReducer } from "react";
import { toast } from "sonner";
import type { ShopData, StoreProduct } from "./templates/types";
import type { CartItem } from "./CartDrawer";
import { CartDrawer } from "./CartDrawer";
import { CheckoutModal, OrderConfirmation } from "./CheckoutModal";
import { ChatWidget } from "./ChatWidget";
import { ModernTemplate } from "./templates/ModernTemplate";
import { BoutiqueTemplate } from "./templates/BoutiqueTemplate";
import { MinimalTemplate } from "./templates/MinimalTemplate";
import { DarkTemplate } from "./templates/DarkTemplate";
import { syncCartToServer, clearServerCart } from "@/app/actions/cart";

const REORDER_KEY = "quivo-reorder";

const FONT_MAP: Record<string, string> = {
  inter: "Inter, sans-serif",
  poppins: "Poppins, sans-serif",
  playfair: "'Playfair Display', serif",
  space: "'Space Grotesk', sans-serif",
  dmsans: "'DM Sans', sans-serif",
};

type CartAction =
  | { type: "ADD"; product: StoreProduct }
  | { type: "UPDATE_QTY"; id: string; delta: number }
  | { type: "SEED"; items: CartItem[] }
  | { type: "CLEAR" };

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "ADD": {
      const p = action.product;
      const existing = state.find((i) => i.id === p.id);
      if (existing) {
        if (existing.qty >= existing.maxStock) return state;
        return state.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...state, { id: p.id, name: p.name, price: p.price, qty: 1, maxStock: p.stock, image_url: p.image_url }];
    }
    case "UPDATE_QTY": {
      return state
        .map((i) => {
          if (i.id !== action.id) return i;
          const newQty = i.qty + action.delta;
          if (newQty <= 0) return null as unknown as CartItem;
          if (newQty > i.maxStock) return i;
          return { ...i, qty: newQty };
        })
        .filter(Boolean);
    }
    case "SEED":
      return action.items;
    case "CLEAR":
      return [];
    default:
      return state;
  }
}

interface StorefrontPageProps {
  shop: ShopData;
  products: StoreProduct[];
}

export function StorefrontPage({ shop, products }: StorefrontPageProps) {
  const [cart, dispatch] = useReducer(cartReducer, []);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{ orderNumber: string; trackingToken: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Hydrate cart from a reorder handoff. Defer the state writes to a
  // microtask so we don't trigger a cascading re-render mid-effect.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = sessionStorage.getItem(REORDER_KEY);
        if (!raw) return;
        const payload = JSON.parse(raw) as { shopSlug: string; items: CartItem[]; skipped?: Array<{ name: string; reason: string }> };
        if (!payload || payload.shopSlug !== shop.slug) return;
        if (Array.isArray(payload.items) && payload.items.length > 0) {
          dispatch({ type: "SEED", items: payload.items });
          setIsCartOpen(true);
          const skipped = payload.skipped ?? [];
          if (skipped.length > 0) {
            toast.info(`Reorder added ${payload.items.length} item${payload.items.length === 1 ? "" : "s"}; ${skipped.length} unavailable.`);
          } else {
            toast.success(`Reorder added ${payload.items.length} item${payload.items.length === 1 ? "" : "s"}.`);
          }
        }
        sessionStorage.removeItem(REORDER_KEY);
      } catch {
        sessionStorage.removeItem(REORDER_KEY);
      }
    });
    return () => { cancelled = true; };
  }, [shop.slug]);

  // Debounced server-cart sync. Anonymous users no-op silently.
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSynced = useRef<string>("");
  useEffect(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const payload = JSON.stringify(cart.map((i) => ({ id: i.id, qty: i.qty })));
      if (payload === lastSynced.current) return;
      lastSynced.current = payload;
      void syncCartToServer({ shopId: shop.id, items: cart.map((i) => ({ id: i.id, qty: i.qty })) });
    }, 600);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [cart, shop.id]);

  const themeColor = shop.theme_color || "#A7653A";
  const fontFamily = FONT_MAP[shop.font_family] ?? FONT_MAP.inter;

  const templateProps = {
    shop,
    products,
    cart,
    onAddToCart: (p: StoreProduct) => dispatch({ type: "ADD", product: p }),
    onUpdateQty: (id: string, delta: number) => dispatch({ type: "UPDATE_QTY", id, delta }),
    onOpenCart: () => setIsCartOpen(true),
    onOpenChat: () => {},
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
  };

  const handleOrderSuccess = (orderNumber: string, trackingToken: string) => {
    setConfirmedOrder({ orderNumber, trackingToken });
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    dispatch({ type: "CLEAR" });
    // Drop the server cart so the abandoned-cart cron doesn't email us.
    void clearServerCart(shop.id);
  };

  const renderTemplate = () => {
    switch (shop.template) {
      case "boutique": return <BoutiqueTemplate {...templateProps} />;
      case "minimal": return <MinimalTemplate {...templateProps} />;
      case "dark": return <DarkTemplate {...templateProps} />;
      default: return <ModernTemplate {...templateProps} />;
    }
  };

  return (
    <div style={{ fontFamily }}>
      {renderTemplate()}

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQty={(id, delta) => dispatch({ type: "UPDATE_QTY", id, delta })}
        onCheckout={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
        themeColor={themeColor}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        subtotal={cart.reduce((a, b) => a + b.price * b.qty, 0)}
        shopId={shop.id}
        shopName={shop.name}
        themeColor={themeColor}
        vatRegistered={Boolean(shop.vat_registered)}
        vatRate={Number(shop.vat_rate ?? 0)}
        panNumber={shop.pan_number ?? null}
        onSuccess={handleOrderSuccess}
      />

      {confirmedOrder && (
        <OrderConfirmation
          orderNumber={confirmedOrder.orderNumber}
          trackingToken={confirmedOrder.trackingToken}
          shopName={shop.name}
          themeColor={themeColor}
          onClose={() => setConfirmedOrder(null)}
        />
      )}

      <ChatWidget shopId={shop.id} shopName={shop.name} themeColor={themeColor} />
    </div>
  );
}
