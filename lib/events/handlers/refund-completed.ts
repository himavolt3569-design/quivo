import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { notifyUser } from "@/lib/events/notify";
import { renderRefundProcessedEmail } from "@/emails/RefundProcessedEmail";
import { getSiteUrl } from "@/lib/security";
import { log } from "@/lib/log";

interface Payload {
  refund_id?: string;
  shop_id?: string;
  amount?: number;
  transaction_id?: string | null;
  order_id?: string | null;
}

export async function handleRefundCompleted(payload: Payload): Promise<void> {
  if (!payload.refund_id || !payload.shop_id) {
    log.warn("refund.completed handler: missing ids", { payload });
    return;
  }

  const admin = createAdminClient();
  const [{ data: refund }, { data: shop }, { data: members }] =
    await Promise.all([
      admin
        .from("refunds")
        .select(
          "id, refund_amount, tax_refunded, reason, order_id, transaction_id",
        )
        .eq("id", payload.refund_id)
        .maybeSingle(),
      admin
        .from("shops")
        .select("name, logo_url, theme_color")
        .eq("id", payload.shop_id)
        .maybeSingle(),
      admin
        .from("shop_members")
        .select("user_id")
        .eq("shop_id", payload.shop_id)
        .eq("status", "active"),
    ]);

  if (!refund) return;

  const shopBrand = {
    name: (shop?.name as string | undefined) ?? "Shop",
    logoUrl: (shop?.logo_url as string | null | undefined) ?? null,
    themeColor: (shop?.theme_color as string | null | undefined) ?? null,
  };

  // In-app for every shop member.
  await Promise.all(
    (members ?? []).map((m) =>
      notifyUser({
        userId: m.user_id as string,
        kind: "refund.completed",
        shopId: payload.shop_id ?? null,
        inApp: {
          title: `Refund of Rs. ${Number(refund.refund_amount).toFixed(2)} completed`,
          body: refund.reason as string,
          linkUrl: `/dashboard/owner/orders`,
          data: {
            refund_id: refund.id,
            order_id: refund.order_id,
            transaction_id: refund.transaction_id,
          },
        },
      }).catch((err) =>
        log.error("notify owner refund failed", {
          err: err instanceof Error ? err.message : String(err),
        }),
      ),
    ),
  );

  // Customer email — only when refund is tied to an order with a known email.
  if (refund.order_id) {
    const { data: order } = await admin
      .from("orders")
      .select("order_number, customer_name, customer_email, tracking_token")
      .eq("id", refund.order_id as string)
      .maybeSingle();
    if (order?.customer_email) {
      const trackingUrl = order.tracking_token
        ? `${getSiteUrl()}/order/${order.order_number}?t=${order.tracking_token}`
        : null;
      const rendered = renderRefundProcessedEmail({
        shop: shopBrand,
        toName: (order.customer_name as string | undefined) ?? "Customer",
        orderNumber: (order.order_number as string | undefined) ?? null,
        refundAmount: Number(refund.refund_amount),
        taxRefunded: Number(refund.tax_refunded ?? 0),
        reason: refund.reason as string,
        trackingUrl,
      });
      await sendEmail({
        to: order.customer_email as string,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: [
          { name: "kind", value: "refund_processed" },
          { name: "order", value: (order.order_number as string) ?? "" },
        ],
      });
    }
  }
}
