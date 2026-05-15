"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
