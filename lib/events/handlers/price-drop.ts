import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/events/notify";
import { sendEmail } from "@/lib/email/send";
import { getSiteUrl } from "@/lib/security";
import { log } from "@/lib/log";

interface Payload {
  product_id?: string;
  customer_id?: string;
  product_name?: string;
  shop_slug?: string;
  barcode?: string | null;
  old_price?: number;
  new_price?: number;
  drop_pct?: number;
}

export async function handlePriceDrop(payload: Payload): Promise<void> {
  if (!payload.product_id || !payload.customer_id || !payload.shop_slug) return;
  const admin = createAdminClient();
  const { data: user } = await admin.from("profiles").select("email, full_name").eq("id", payload.customer_id).maybeSingle();
  if (!user) return;
  const link = payload.barcode
    ? `${getSiteUrl()}/s/${payload.shop_slug}/product/${payload.barcode}`
    : `${getSiteUrl()}/s/${payload.shop_slug}`;

  const dropLine = payload.old_price != null && payload.new_price != null
    ? `Rs. ${payload.old_price} → Rs. ${payload.new_price}`
    : "";

  await notifyUser({
    userId: payload.customer_id,
    kind: "price_drop",
    inApp: {
      title: "Price dropped",
      body: `${payload.product_name ?? "A saved item"} is now cheaper${dropLine ? ` (${dropLine})` : ""}.`,
      linkUrl: link,
    },
  }).catch((err) => log.warn("price_drop notifyUser failed", { err: String(err) }));

  const email = (user.email as string | null | undefined) ?? null;
  if (!email) return;
  await sendEmail({
    to: email,
    subject: `Price drop on ${payload.product_name ?? "your saved item"}`,
    text:
      `${payload.product_name ?? "An item"} you saved has dropped in price` +
      (dropLine ? ` (${dropLine})` : "") +
      `. ${link}`,
  }).catch((err) => log.warn("price_drop email failed", { err: String(err) }));
}
