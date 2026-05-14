import type { CartItem } from "../CartDrawer";

export interface StoreProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string | null;
  variant: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  images: string[] | null;
  description: string | null;
  barcode: string | null;
}

export interface ShopData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  opening_time: string | null;
  closing_time: string | null;
  logo_url: string | null;
  theme_color: string;
  theme_layout: string;
  template: string;
  font_family: string;
  hero_headline: string | null;
  hero_subtext: string | null;
  cover_image_url: string | null;
  announcement_text: string | null;
  announcement_active: boolean;
  sections_order: string[];
  whatsapp_number: string | null;
  featured_product_ids: string[] | null;
}

export interface TemplateProps {
  shop: ShopData;
  products: StoreProduct[];
  cart: CartItem[];
  onAddToCart: (product: StoreProduct) => void;
  onUpdateQty: (id: string, delta: number) => void;
  onOpenCart: () => void;
  onOpenChat: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
}
