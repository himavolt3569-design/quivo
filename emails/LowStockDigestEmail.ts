import { renderEmailLayout, escapeHtml, renderTextFromBlocks } from "@/lib/email/layout";
import type { BrandedShop } from "@/lib/email/layout";
import type { RenderedEmail } from "@/emails/OrderConfirmationEmail";

export interface LowStockLine {
  name: string;
  current: number;
  threshold: number;
  unit: string | null;
}

export interface LowStockDigestEmailInput {
  shop: BrandedShop;
  ownerName: string;
  items: LowStockLine[];
  productsUrl: string;
}

export function renderLowStockDigestEmail(input: LowStockDigestEmailInput): RenderedEmail {
  const count = input.items.length;
  const subject = `${count} ${count === 1 ? "item is" : "items are"} low on stock — ${input.shop.name}`;

  const rows = input.items
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 10px;font-size:13px;color:#27324A;border-bottom:1px solid rgba(46,51,68,0.05);">${escapeHtml(i.name)}</td>
        <td style="padding:6px 10px;font-size:12px;color:#A7653A;text-align:right;font-weight:700;border-bottom:1px solid rgba(46,51,68,0.05);">
          ${i.current.toString()}${i.unit ? ` ${escapeHtml(i.unit)}` : ""}
        </td>
        <td style="padding:6px 10px;font-size:12px;color:#746E73;text-align:right;border-bottom:1px solid rgba(46,51,68,0.05);">
          ≤ ${i.threshold.toString()}
        </td>
      </tr>`
    )
    .join("");

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#27324A;">Stock running low</h1>
    <p style="margin:0 0 16px;color:#27324A;">
      Hi ${escapeHtml(input.ownerName.split(/\s+/)[0] || input.ownerName)},
      these items in <strong>${escapeHtml(input.shop.name)}</strong> need restocking:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;border:1px solid rgba(46,51,68,0.1);border-radius:10px;overflow:hidden;">
      <thead>
        <tr style="background:#f8f6f1;">
          <th style="padding:8px 10px;font-size:10px;font-weight:900;text-align:left;text-transform:uppercase;letter-spacing:0.08em;color:#746E73;">Product</th>
          <th style="padding:8px 10px;font-size:10px;font-weight:900;text-align:right;text-transform:uppercase;letter-spacing:0.08em;color:#746E73;">Current</th>
          <th style="padding:8px 10px;font-size:10px;font-weight:900;text-align:right;text-transform:uppercase;letter-spacing:0.08em;color:#746E73;">Threshold</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <p style="margin:0;">
      <a href="${escapeHtml(input.productsUrl)}" style="display:inline-block;padding:12px 24px;background:#27324A;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Open Inventory</a>
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    preview: `${count} ${count === 1 ? "item" : "items"} below threshold.`,
    body,
    shop: input.shop,
  });

  const text = renderTextFromBlocks([
    "Stock running low",
    `Hi ${input.ownerName},`,
    `These items in ${input.shop.name} need restocking:`,
    input.items.map((i) => `- ${i.name}: ${i.current}${i.unit ? ` ${i.unit}` : ""} (≤ ${i.threshold})`).join("\n"),
    `Open Inventory: ${input.productsUrl}`,
  ]);

  return { subject, html, text };
}
