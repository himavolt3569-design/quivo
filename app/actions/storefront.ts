"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ShopIdSchema = z.string().uuid();
const SessionIdSchema = z.string().trim().min(8).max(160);
const SessionSecretSchema = z.string().trim().regex(/^[a-f0-9]{64,128}$/i, "Invalid chat session.");
const NameSchema = z.string().trim().max(80);
const MessageSchema = z.string().trim().min(1).max(1000);
const StorefrontSettingsSchema = z.object({
  template: z.enum(["modern", "boutique", "minimal", "dark"]).optional(),
  font_family: z.enum(["inter", "poppins", "playfair", "space", "dmsans"]).optional(),
  hero_headline: z.string().trim().max(120).nullable().optional(),
  hero_subtext: z.string().trim().max(240).nullable().optional(),
  cover_image_url: z.string().trim().url().max(1000).nullable().optional(),
  announcement_text: z.string().trim().max(160).nullable().optional(),
  announcement_active: z.boolean().optional(),
  sections_order: z.array(z.enum(["hero", "announcement", "featured", "categories", "products", "about", "contact"])).max(7).optional(),
  whatsapp_number: z.string().trim().max(40).nullable().optional(),
  featured_product_ids: z.array(z.string().uuid()).max(24).optional(),
  theme_color: z.string().trim().regex(/^#[0-9a-f]{6}$/i).optional(),
  theme_layout: z.enum(["modern", "list"]).optional(),
}).strict();

export interface CustomerChatMessage {
  id: string;
  sender: "customer" | "owner";
  message: string;
  created_at: string;
  customer_name: string | null;
}

export async function sendCustomerChatMessage(
  shopId: string,
  sessionId: string,
  sessionSecret: string,
  customerName: string,
  message: string
): Promise<{ error?: string }> {
  const rateLimit = await checkRateLimit("sendCustomerChatMessage", { maxAttempts: 40, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.success) return { error: rateLimit.error };

  const shopParse = ShopIdSchema.safeParse(shopId);
  const sessionParse = SessionIdSchema.safeParse(sessionId);
  const secretParse = SessionSecretSchema.safeParse(sessionSecret);
  const nameParse = NameSchema.safeParse(customerName);
  const messageParse = MessageSchema.safeParse(message);
  if (!shopParse.success || !sessionParse.success || !secretParse.success) return { error: "Invalid chat session." };
  if (!messageParse.success) return { error: messageParse.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("chat_messages").insert({
    shop_id: shopParse.data,
    session_id: sessionParse.data,
    session_secret: secretParse.data,
    customer_name: nameParse.success && nameParse.data ? nameParse.data : "Customer",
    sender: "customer",
    message: messageParse.data,
  });

  if (error) return { error: error.message };
  return {};
}

export async function getCustomerChatMessages(
  shopId: string,
  sessionId: string,
  sessionSecret: string
): Promise<{ error?: string; messages?: CustomerChatMessage[] }> {
  const rateLimit = await checkRateLimit("getCustomerChatMessages", { maxAttempts: 120, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.success) return { error: rateLimit.error };

  const shopParse = ShopIdSchema.safeParse(shopId);
  const sessionParse = SessionIdSchema.safeParse(sessionId);
  const secretParse = SessionSecretSchema.safeParse(sessionSecret);
  if (!shopParse.success || !sessionParse.success || !secretParse.success) {
    return { error: "Invalid chat session." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_customer_chat_messages", {
    p_shop_id: shopParse.data,
    p_session_id: sessionParse.data,
    p_session_secret: secretParse.data,
  });
  if (error) return { error: error.message };
  return { messages: (data ?? []) as CustomerChatMessage[] };
}

export async function sendOwnerChatReply(
  shopId: string,
  sessionId: string,
  message: string
): Promise<{ error?: string }> {
  const shopParse = ShopIdSchema.safeParse(shopId);
  const sessionParse = SessionIdSchema.safeParse(sessionId);
  const messageParse = MessageSchema.safeParse(message);
  if (!shopParse.success || !sessionParse.success) return { error: "Invalid chat session." };
  if (!messageParse.success) return { error: messageParse.error.issues[0].message };

  const supabase = await createClient();

  // Verify the user is a shop member
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase.from("chat_messages").insert({
    shop_id: shopParse.data,
    session_id: sessionParse.data,
    session_secret: `owner:${sessionParse.data}`,
    sender: "owner",
    message: messageParse.data,
  });

  if (error) return { error: error.message };
  return {};
}

export async function markChatSessionRead(
  shopId: string,
  sessionId: string
): Promise<{ error?: string }> {
  const shopParse = ShopIdSchema.safeParse(shopId);
  const sessionParse = SessionIdSchema.safeParse(sessionId);
  if (!shopParse.success || !sessionParse.success) return { error: "Invalid chat session." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("chat_messages")
    .update({ read: true })
    .eq("shop_id", shopParse.data)
    .eq("session_id", sessionParse.data)
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
  const shopParse = ShopIdSchema.safeParse(shopId);
  if (!shopParse.success) return { error: "Invalid shop." };
  const settingsParse = StorefrontSettingsSchema.safeParse(settings);
  if (!settingsParse.success) return { error: settingsParse.error.issues[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase
    .from("shops")
    .update(settingsParse.data)
    .eq("id", shopParse.data);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/owner/storefront`);
  return {};
}
