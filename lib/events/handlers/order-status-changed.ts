import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { renderOrderStatusUpdateEmail, type OrderStatus } from "@/emails/OrderStatusUpdateEmail";
import { getSiteUrl } from "@/lib/security";
import { log } from "@/lib/log";

interface Payload {
  order_id?: string;
  order_number?: string;
  shop_id?: string;
  status?: OrderStatus;
}

export async function handleOrderStatusChanged(payload: Payload): Promise<void> {
  if (!payload.order_id || !payload.status) {
    log.warn("order.status_changed handler: missing fields", { payload });
    return;
  }
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("order_number, customer_name, customer_email, tracking_token, eta_minutes, shop_id")
    .eq("id", payload.order_id)
    .maybeSingle();
  if (!order || !order.customer_email) return;

  const { data: shop } = await admin
    .from("shops")
    .select("name, logo_url, theme_color")
    .eq("id", order.shop_id as string)
    .maybeSingle();

  const trackingUrl = order.tracking_token
    ? `${getSiteUrl()}/order/${order.order_number}?t=${order.tracking_token}`
    : `${getSiteUrl()}/order/${order.order_number}`;

  const rendered = renderOrderStatusUpdateEmail({
    shop: {
      name: (shop?.name as string | undefined) ?? "Shop",
      logoUrl: (shop?.logo_url as string | null | undefined) ?? null,
      themeColor: (shop?.theme_color as string | null | undefined) ?? null,
    },
    orderNumber: order.order_number as string,
    trackingUrl,
    customerName: (order.customer_name as string | undefined) ?? "Customer",
    status: payload.status,
    etaMinutes: (order.eta_minutes as number | null | undefined) ?? null,
  });

  await sendEmail({
    to: order.customer_email as string,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: [
      { name: "kind", value: "order_status_update" },
      { name: "status", value: payload.status },
      { name: "order", value: (order.order_number as string) ?? "" },
    ],
  });
}
