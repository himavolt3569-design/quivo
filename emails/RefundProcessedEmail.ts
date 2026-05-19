import { renderEmailLayout, escapeHtml, renderTextFromBlocks } from "@/lib/email/layout";
import type { BrandedShop } from "@/lib/email/layout";
import type { RenderedEmail } from "@/emails/OrderConfirmationEmail";

export interface RefundProcessedEmailInput {
  shop: BrandedShop;
  toName: string;
  orderNumber?: string | null;
  receiptNumber?: string | null;
  refundAmount: number;
  taxRefunded: number;
  reason: string;
  trackingUrl?: string | null;
}

function money(n: number) {
  return `Rs. ${n.toFixed(2)}`;
}

export function renderRefundProcessedEmail(input: RefundProcessedEmailInput): RenderedEmail {
  const ref = input.orderNumber
    ? `order ${input.orderNumber}`
    : input.receiptNumber
      ? `receipt #${input.receiptNumber}`
      : "your purchase";
  const subject = `Refund processed — ${input.shop.name}`;

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#27324A;">Refund processed</h1>
    <p style="margin:0 0 12px;color:#27324A;">Hi ${escapeHtml(input.toName.split(/\s+/)[0] || input.toName)},</p>
    <p style="margin:0 0 16px;color:#27324A;">
      We've issued a refund for ${escapeHtml(ref)}. The refund total is
      <strong>${money(input.refundAmount)}</strong>${input.taxRefunded > 0 ? ` (incl. ${money(input.taxRefunded)} VAT)` : ""}.
    </p>
    <p style="margin:0 0 16px;color:#746E73;font-size:13px;">
      <strong>Reason:</strong> ${escapeHtml(input.reason)}
    </p>
    ${input.trackingUrl
      ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;padding:12px 24px;background:#27324A;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">View order</a></p>`
      : ""}
  `;

  const html = renderEmailLayout({
    title: subject,
    preview: `${money(input.refundAmount)} refunded for ${ref}.`,
    body,
    shop: input.shop,
  });

  const text = renderTextFromBlocks([
    "Refund processed",
    `Hi ${input.toName},`,
    `We've issued a refund for ${ref}.`,
    `Refund total: ${money(input.refundAmount)}${input.taxRefunded > 0 ? ` (incl. ${money(input.taxRefunded)} VAT)` : ""}`,
    `Reason: ${input.reason}`,
    input.trackingUrl ? `View order: ${input.trackingUrl}` : "",
  ]);

  return { subject, html, text };
}
