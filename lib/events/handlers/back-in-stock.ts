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
}

export async function handleBackInStock(payload: Payload): Promise<void> {
  if (!payload.product_id || !payload.customer_id || !payload.shop_slug) return;
  const admin = createAdminClient();
  const { data: user } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", payload.customer_id)
    .maybeSingle();
  if (!user) return;
  const link = payload.barcode
    ? `${getSiteUrl()}/s/${payload.shop_slug}/product/${payload.barcode}`
    : `${getSiteUrl()}/s/${payload.shop_slug}`;

  await notifyUser({
    userId: payload.customer_id,
    kind: "back_in_stock",
    inApp: {
      title: "Back in stock",
      body: `${payload.product_name ?? "An item you saved"} is available again.`,
      linkUrl: link,
    },
  }).catch((err) =>
    log.warn("back_in_stock notifyUser failed", { err: String(err) }),
  );

  const email = (user.email as string | null | undefined) ?? null;
  if (!email) return;
  await sendEmail({
    to: email,
    subject: `${payload.product_name ?? "Your saved item"} is back in stock`,
    text: `${payload.product_name ?? "An item"} you saved is back in stock. ${link}`,
  }).catch((err) =>
    log.warn("back_in_stock email failed", { err: String(err) }),
  );
}
