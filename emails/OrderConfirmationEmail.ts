import { renderEmailLayout, escapeHtml, renderTextFromBlocks } from "@/lib/email/layout";
import type { BrandedShop } from "@/lib/email/layout";

export interface OrderConfirmationItem {
  name: string;
  qty: number;
  price: number;
}

export interface OrderConfirmationEmailInput {
  shop: BrandedShop;
  orderNumber: string;
  trackingUrl: string;
  customerName: string;
  items: OrderConfirmationItem[];
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  serviceCharge: number;
  total: number;
  vatRate: number;
  paymentMethod: string;
  panNumber?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function money(n: number): string {
  return `Rs. ${n.toFixed(2)}`;
}

export function renderOrderConfirmationEmail(input: OrderConfirmationEmailInput): RenderedEmail {
  const subject = `Order ${input.orderNumber} confirmed — ${input.shop.name}`;

  const lineRows = input.items
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 0;font-size:13px;">
          <strong>${escapeHtml(i.name)}</strong>
          <div style="font-size:11px;color:#746E73;">× ${i.qty.toString()}</div>
        </td>
        <td style="padding:6px 0;font-size:13px;text-align:right;">${money(i.price * i.qty)}</td>
      </tr>`
    )
    .join("");

  const totalsRow = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:${bold ? "#27324A" : "#746E73"};${bold ? "font-weight:bold;" : ""}">${escapeHtml(label)}</td>
      <td style="padding:4px 0;font-size:13px;text-align:right;color:${bold ? "#27324A" : "#746E73"};${bold ? "font-weight:bold;" : ""}">${value}</td>
    </tr>
  `;

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#27324A;">Thanks, ${escapeHtml(input.customerName.split(/\s+/)[0] || input.customerName)}!</h1>
    <p style="margin:0 0 20px;color:#27324A;">
      Your order <strong>${escapeHtml(input.orderNumber)}</strong> is in. We'll let you know when it ships.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid rgba(46,51,68,0.1);border-bottom:1px solid rgba(46,51,68,0.1);margin-bottom:16px;">
      ${lineRows}
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;">
      ${totalsRow("Subtotal", money(input.subtotal))}
      ${input.taxAmount > 0 ? totalsRow(`VAT (${input.vatRate.toFixed(2)}%)`, money(input.taxAmount)) : ""}
      ${input.deliveryFee > 0 ? totalsRow("Delivery fee", money(input.deliveryFee)) : ""}
      ${input.serviceCharge > 0 ? totalsRow("Service charge", money(input.serviceCharge)) : ""}
      <tr><td colspan="2" style="height:1px;background:rgba(46,51,68,0.1);"></td></tr>
      ${totalsRow("Total", money(input.total), true)}
    </table>

    <p style="margin:0 0 24px;font-size:13px;color:#27324A;">
      <strong>Payment:</strong> ${escapeHtml(input.paymentMethod)}<br />
      ${input.panNumber ? `<strong>Shop PAN:</strong> ${escapeHtml(input.panNumber)}<br />` : ""}
    </p>

    <p style="margin:0;">
      <a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;padding:12px 24px;background:#27324A;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Track your order</a>
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    preview: `Your order ${input.orderNumber} is confirmed.`,
    body,
    shop: input.shop,
  });

  const text = renderTextFromBlocks([
    `Thanks, ${input.customerName}!`,
    `Order ${input.orderNumber} is confirmed at ${input.shop.name}.`,
    input.items.map((i) => `- ${i.name} × ${i.qty} — ${money(i.price * i.qty)}`).join("\n"),
    `Subtotal: ${money(input.subtotal)}`,
    input.taxAmount > 0 ? `VAT (${input.vatRate.toFixed(2)}%): ${money(input.taxAmount)}` : "",
    input.deliveryFee > 0 ? `Delivery: ${money(input.deliveryFee)}` : "",
    input.serviceCharge > 0 ? `Service: ${money(input.serviceCharge)}` : "",
    `Total: ${money(input.total)}`,
    `Track: ${input.trackingUrl}`,
  ]);

  return { subject, html, text };
}
