import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/events/notify";
import { renderOrderConfirmationEmail } from "@/emails/OrderConfirmationEmail";
import { getSiteUrl } from "@/lib/security";
import { log } from "@/lib/log";

/**
 * Storefront order placed — emails the customer their confirmation and
 * writes an in-app notification for every active shop member.
 */

interface Payload {
  order_id?: string;
  order_number?: string;
  shop_id?: string;
  payment_method?: string;
  subtotal?: number;
  tax_amount?: number;
  delivery_fee?: number;
  service_charge?: number;
  total?: number;
  customer_email?: string | null;
  customer_phone?: string;
}

export async function handleOrderPlaced(payload: Payload): Promise<void> {
  if (!payload.shop_id || !payload.order_id || !payload.order_number) {
    log.warn("order.placed handler: missing ids", { payload });
    return;
  }

  const admin = createAdminClient();

  const [{ data: shop }, { data: order }, { data: members }] =
    await Promise.all([
      admin
        .from("shops")
        .select("id, name, logo_url, theme_color, pan_number")
        .eq("id", payload.shop_id)
        .maybeSingle(),
      admin
        .from("orders")
        .select("items, tax_rate, customer_name, tracking_token")
        .eq("id", payload.order_id)
        .maybeSingle(),
      admin
        .from("shop_members")
        .select("user_id")
        .eq("shop_id", payload.shop_id)
        .eq("status", "active"),
    ]);

  const shopName = (shop?.name as string | undefined) ?? "the shop";

  // Owner / staff in-app — every active member sees the new order.
  await Promise.all(
    (members ?? []).map((m) =>
      notifyUser({
        userId: m.user_id as string,
        kind: "order.placed",
        shopId: payload.shop_id ?? null,
        inApp: {
          title: `New order ${payload.order_number}`,
          body: `${shopName} — total Rs. ${(payload.total ?? 0).toFixed(2)}.`,
          linkUrl: `/dashboard/owner/orders`,
          data: {
            order_id: payload.order_id,
            order_number: payload.order_number,
            total: payload.total,
          },
        },
      }).catch((err) =>
        log.error("notifyUser owner failed", {
          err: err instanceof Error ? err.message : String(err),
        }),
      ),
    ),
  );

  // Customer email — only when we have one. Anonymous orders carry only a
  // phone number; SMS path lands in Phase 7.
  if (payload.customer_email && order) {
    const items = Array.isArray(order.items)
      ? (
          order.items as Array<{ name?: string; qty?: number; price?: number }>
        ).map((i) => ({
          name: i.name ?? "Item",
          qty: Number(i.qty ?? 0),
          price: Number(i.price ?? 0),
        }))
      : [];

    const trackingToken = order.tracking_token as string | undefined;
    const trackingUrl = trackingToken
      ? `${getSiteUrl()}/order/${payload.order_number}?t=${trackingToken}`
      : `${getSiteUrl()}/order/${payload.order_number}`;

    const rendered = renderOrderConfirmationEmail({
      shop: {
        name: shopName,
        logoUrl: (shop?.logo_url as string | null | undefined) ?? null,
        themeColor: (shop?.theme_color as string | null | undefined) ?? null,
      },
      orderNumber: payload.order_number,
      trackingUrl,
      customerName: (order.customer_name as string | undefined) ?? "Customer",
      items,
      subtotal: payload.subtotal ?? 0,
      taxAmount: payload.tax_amount ?? 0,
      deliveryFee: payload.delivery_fee ?? 0,
      serviceCharge: payload.service_charge ?? 0,
      total: payload.total ?? 0,
      vatRate: Number(order.tax_rate ?? 0),
      paymentMethod: payload.payment_method ?? "—",
      panNumber: (shop?.pan_number as string | null | undefined) ?? null,
    });

    // Anonymous orders have no auth.uid(); we still want to email them, so
    // skip the per-user pref lookup and just send.
    const { sendEmail } = await import("@/lib/email/send");
    await sendEmail({
      to: payload.customer_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: "kind", value: "order_confirmation" },
        { name: "order", value: payload.order_number },
      ],
    });
  }
}
