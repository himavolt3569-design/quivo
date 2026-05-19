import { renderEmailLayout, escapeHtml, renderTextFromBlocks } from "@/lib/email/layout";
import type { BrandedShop } from "@/lib/email/layout";
import type { RenderedEmail } from "@/emails/OrderConfirmationEmail";

export interface PaymentReceiptEmailInput {
  shop: BrandedShop;
  customerName: string;
  orderNumber: string;
  trackingUrl: string;
  paymentMethod: string;
  amount: number;
  taxAmount: number;
  vatRate: number;
  transactionReference?: string | null;
  paidAt?: string | null;
  panNumber?: string | null;
}

function money(n: number) {
  return `Rs. ${n.toFixed(2)}`;
}

export function renderPaymentReceiptEmail(input: PaymentReceiptEmailInput): RenderedEmail {
  const subject = `Payment received — Order ${input.orderNumber}`;
  const dateStr = input.paidAt ? new Date(input.paidAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#27324A;">Payment received</h1>
    <p style="margin:0 0 16px;color:#27324A;">
      Thanks ${escapeHtml(input.customerName.split(/\s+/)[0] || input.customerName)} — we've recorded your payment for order <strong>${escapeHtml(input.orderNumber)}</strong>.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;background:#f8f6f1;border-radius:12px;padding:14px;">
      <tr>
        <td style="padding:4px 8px;font-size:12px;color:#746E73;text-transform:uppercase;letter-spacing:0.08em;font-weight:900;">Method</td>
        <td style="padding:4px 8px;font-size:13px;color:#27324A;font-weight:700;text-align:right;">${escapeHtml(input.paymentMethod)}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px;font-size:12px;color:#746E73;text-transform:uppercase;letter-spacing:0.08em;font-weight:900;">Amount</td>
        <td style="padding:4px 8px;font-size:13px;color:#27324A;font-weight:700;text-align:right;">${money(input.amount)}</td>
      </tr>
      ${input.taxAmount > 0 ? `
      <tr>
        <td style="padding:4px 8px;font-size:12px;color:#746E73;text-transform:uppercase;letter-spacing:0.08em;font-weight:900;">VAT (${input.vatRate.toFixed(2)}%)</td>
        <td style="padding:4px 8px;font-size:13px;color:#27324A;font-weight:700;text-align:right;">${money(input.taxAmount)}</td>
      </tr>` : ""}
      ${input.transactionReference ? `
      <tr>
        <td style="padding:4px 8px;font-size:12px;color:#746E73;text-transform:uppercase;letter-spacing:0.08em;font-weight:900;">Reference</td>
        <td style="padding:4px 8px;font-size:12px;color:#27324A;font-family:monospace;text-align:right;">${escapeHtml(input.transactionReference)}</td>
      </tr>` : ""}
      ${input.panNumber ? `
      <tr>
        <td style="padding:4px 8px;font-size:12px;color:#746E73;text-transform:uppercase;letter-spacing:0.08em;font-weight:900;">Shop PAN</td>
        <td style="padding:4px 8px;font-size:12px;color:#27324A;text-align:right;">${escapeHtml(input.panNumber)}</td>
      </tr>` : ""}
      ${dateStr ? `
      <tr>
        <td style="padding:4px 8px;font-size:12px;color:#746E73;text-transform:uppercase;letter-spacing:0.08em;font-weight:900;">Paid at</td>
        <td style="padding:4px 8px;font-size:12px;color:#27324A;text-align:right;">${escapeHtml(dateStr)}</td>
      </tr>` : ""}
    </table>

    <p style="margin:0;">
      <a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;padding:12px 24px;background:#27324A;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">View order</a>
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    preview: `Payment of ${money(input.amount)} received for ${input.orderNumber}.`,
    body,
    shop: input.shop,
  });

  const text = renderTextFromBlocks([
    "Payment received",
    `Order: ${input.orderNumber}`,
    `Method: ${input.paymentMethod}`,
    `Amount: ${money(input.amount)}`,
    input.taxAmount > 0 ? `VAT (${input.vatRate.toFixed(2)}%): ${money(input.taxAmount)}` : "",
    input.transactionReference ? `Reference: ${input.transactionReference}` : "",
    dateStr ? `Paid at: ${dateStr}` : "",
    `Track: ${input.trackingUrl}`,
  ]);

  return { subject, html, text };
}
