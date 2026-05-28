import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { notifyUser } from "@/lib/events/notify";
import { getSiteUrl } from "@/lib/security";
import { log } from "@/lib/log";

interface Payload {
  customer_id?: string;
  shop_id?: string;
  item_count?: number;
  updated_at?: string;
}

export async function handleCartAbandoned(payload: Payload): Promise<void> {
  if (!payload.customer_id || !payload.shop_id) {
    log.debug("cart.abandoned: missing ids", payload as Record<string, unknown>);
    return;
  }
  const admin = createAdminClient();

  const [{ data: shop }, { data: user }] = await Promise.all([
    admin.from("shops").select("name, slug").eq("id", payload.shop_id).maybeSingle(),
    admin.from("profiles").select("email, full_name").eq("id", payload.customer_id).maybeSingle(),
  ]);
  if (!shop || !user) {
    log.debug("cart.abandoned: shop/user missing — skipping", payload as Record<string, unknown>);
    return;
  }

  const shopName = (shop.name as string) ?? "the shop";
  const slug     = (shop.slug as string) ?? "";
  const itemCount = Math.max(1, Number(payload.item_count ?? 1));
  const cartUrl  = `${getSiteUrl()}/s/${slug}`;

  // In-app notification: link straight to the storefront.
  await notifyUser({
    userId: payload.customer_id,
    kind: "cart_abandoned",
    inApp: {
      title: `Still thinking about ${shopName}?`,
      body: `You have ${itemCount} item${itemCount === 1 ? "" : "s"} waiting in your cart.`,
      linkUrl: cartUrl,
    },
  }).catch((err) => log.warn("cart.abandoned: notifyUser failed", { err: String(err) }));

  const email = (user.email as string | null | undefined) ?? null;
  if (!email) return;
  await sendEmail({
    to: email,
    subject: `Your cart at ${shopName} is waiting`,
    text:
      `Hi ${user.full_name ?? "there"},\n\n` +
      `You left ${itemCount} item${itemCount === 1 ? "" : "s"} in your ${shopName} cart. ` +
      `Come back to finish your order: ${cartUrl}\n\n— Quivo`,
  }).catch((err) => log.warn("cart.abandoned: email failed", { err: String(err) }));
}
