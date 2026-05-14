"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface CartItemInput {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface CustomerInfo {
  name: string;
  phone: string;
  email?: string;
  address: string;
  notes?: string;
}

export async function placeStorefrontOrder(
  shopId: string,
  shopName: string,
  cart: CartItemInput[],
  total: number,
  paymentMethod: "cod" | "esewa",
  customer: CustomerInfo
): Promise<{ error?: string; orderNumber?: string }> {
  if (!cart.length) return { error: "Cart is empty." };
  if (!customer.name.trim()) return { error: "Name is required." };
  if (!customer.phone.trim()) return { error: "Phone number is required." };
  if (!customer.address.trim()) return { error: "Delivery address is required." };

  const supabase = await createClient();

  const orderNumber = `STO-${Date.now().toString(36).toUpperCase().slice(-8)}`;

  const { error } = await supabase.rpc("place_storefront_order", {
    p_shop_id: shopId,
    p_shop_name: shopName,
    p_order_number: orderNumber,
    p_customer_name: customer.name.trim(),
    p_customer_phone: customer.phone.trim(),
    p_customer_email: customer.email?.trim() || null,
    p_delivery_address: customer.address.trim(),
    p_items: cart,
    p_total_amount: total,
    p_payment_method: paymentMethod,
    p_notes: customer.notes?.trim() || null,
  });

  if (error) {
    if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
      const name = error.message.slice("INSUFFICIENT_STOCK:".length);
      return { error: `"${name}" is no longer available in the requested quantity.` };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/owner/orders`);
  return { orderNumber };
}

export async function sendCustomerChatMessage(
  shopId: string,
  sessionId: string,
  customerName: string,
  message: string
): Promise<{ error?: string }> {
  if (!message.trim()) return { error: "Message is empty." };

  const supabase = await createClient();
  const { error } = await supabase.from("chat_messages").insert({
    shop_id: shopId,
    session_id: sessionId,
    customer_name: customerName.trim() || "Customer",
    sender: "customer",
    message: message.trim(),
  });

  if (error) return { error: error.message };
  return {};
}

export async function sendOwnerChatReply(
  shopId: string,
  sessionId: string,
  message: string
): Promise<{ error?: string }> {
  if (!message.trim()) return { error: "Message is empty." };

  const supabase = await createClient();

  // Verify the user is a shop member
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase.from("chat_messages").insert({
    shop_id: shopId,
    session_id: sessionId,
    sender: "owner",
    message: message.trim(),
  });

  if (error) return { error: error.message };
  return {};
}

export async function markChatSessionRead(
  shopId: string,
  sessionId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("chat_messages")
    .update({ read: true })
    .eq("shop_id", shopId)
    .eq("session_id", sessionId)
    .eq("sender", "customer");

  if (error) return { error: error.message };
  return {};
}

export async function updateStorefrontSettings(
  shopId: string,
  settings: {
    template?: string;
    font_family?: string;
    hero_headline?: string | null;
    hero_subtext?: string | null;
    cover_image_url?: string | null;
    announcement_text?: string | null;
    announcement_active?: boolean;
    sections_order?: string[];
    whatsapp_number?: string | null;
    featured_product_ids?: string[];
    theme_color?: string;
    theme_layout?: "modern" | "list";
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shops")
    .update(settings)
    .eq("id", shopId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/owner/storefront`);
  return {};
}
