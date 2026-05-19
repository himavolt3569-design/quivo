import { renderEmailLayout, escapeHtml, renderTextFromBlocks } from "@/lib/email/layout";
import type { BrandedShop } from "@/lib/email/layout";
import type { RenderedEmail } from "@/emails/OrderConfirmationEmail";

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface OrderStatusUpdateEmailInput {
  shop: BrandedShop;
  orderNumber: string;
  trackingUrl: string;
  customerName: string;
  status: OrderStatus;
  etaMinutes?: number | null;
}

const HEADLINES: Record<OrderStatus, string> = {
  placed: "Order received",
  confirmed: "Order confirmed",
  packing: "Packing your order",
  out_for_delivery: "Out for delivery",
  delivered: "Order delivered",
  cancelled: "Order cancelled",
};

const COPY: Record<OrderStatus, (eta: string) => string> = {
  placed: () => "We've got your order and will confirm it shortly.",
  confirmed: () => "Your order is confirmed. We'll start preparing it now.",
  packing: () => "Your items are being packed. We'll let you know when they leave the shop.",
  out_for_delivery: (eta) => `Your order is on its way${eta ? ` — estimated arrival ${eta}` : ""}.`,
  delivered: () => "Your order has been delivered. Enjoy!",
  cancelled: () => "Your order has been cancelled. Get in touch if this was a mistake.",
};

function fmtEta(min: number | null | undefined): string {
  if (!min || min <= 0) return "";
  if (min < 60) return `in ~${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `in ~${h} h ${m} m` : `in ~${h} h`;
}

export function renderOrderStatusUpdateEmail(
  input: OrderStatusUpdateEmailInput
): RenderedEmail {
  const headline = HEADLINES[input.status];
  const eta = fmtEta(input.etaMinutes ?? null);
  const message = COPY[input.status](eta);
  const subject = `${headline} — Order ${input.orderNumber}`;

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#27324A;">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 16px;color:#27324A;">Hi ${escapeHtml(input.customerName.split(/\s+/)[0] || input.customerName)},</p>
    <p style="margin:0 0 24px;color:#27324A;">${escapeHtml(message)}</p>
    <p style="margin:0 0 8px;color:#746E73;font-size:13px;">
      <strong>Order:</strong> ${escapeHtml(input.orderNumber)}<br/>
      <strong>Shop:</strong> ${escapeHtml(input.shop.name)}
    </p>
    <p style="margin:24px 0 0;">
      <a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;padding:12px 24px;background:#27324A;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Track order</a>
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    preview: message,
    body,
    shop: input.shop,
  });

  const text = renderTextFromBlocks([
    headline,
    `Hi ${input.customerName},`,
    message,
    `Order: ${input.orderNumber}`,
    `Track: ${input.trackingUrl}`,
  ]);

  return { subject, html, text };
}
