export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  image?: string;
}

export interface Order {
  id: string;
  customer_id: string;
  order_number: string;
  shop_name: string;
  status: OrderStatus;
  total_amount: number;
  items: OrderItem[];
  notes: string | null;
  eta_minutes: number | null;
  delivery_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  customer_id: string;
  label: string;
  address_line: string;
  landmark: string | null;
  phone: string | null;
  is_default: boolean;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface SavedShop {
  id: string;
  customer_id: string;
  shop_name: string;
  shop_category: string | null;
  shop_distance: number | null;
  shop_image: string | null;
  created_at: string;
}

export interface SavedProduct {
  id: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  product_price: string | null;
  product_image: string | null;
  product_shop: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  cover_color: string | null;
  font_size: "small" | "standard" | "large" | "xlarge";
  wallet_balance: number;
  quivo_coins: number;
  role: "customer" | "owner";
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  coins: number;
  type: "cashback" | "coins_award" | "spend" | "refund" | "bonus";
  description: string | null;
  reference_id: string | null;
  created_at: string;
}
