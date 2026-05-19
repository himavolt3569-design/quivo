/**
 * Shared HTML scaffolding used by every transactional email template.
 *
 * Keeping the layout in one place means a brand or contrast change rolls out
 * to every email at once. Templates return only their body content; this
 * wrapper takes care of the safe email-client HTML (table-based, inlined CSS)
 * and shop-aware branding when a `shop` is passed in.
 */

const escapeRe = /[&<>"']/g;
const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(escapeRe, (c) => ESCAPE_MAP[c]);
}

export interface BrandedShop {
  name: string;
  logoUrl?: string | null;
  themeColor?: string | null;
}

export interface EmailLayoutInput {
  title: string;
  preview?: string;
  body: string;
  shop?: BrandedShop | null;
  footerNote?: string;
}

export function renderEmailLayout({
  title,
  preview,
  body,
  shop,
  footerNote,
}: EmailLayoutInput): string {
  const theme = shop?.themeColor ?? "#27324A";
  const safeTitle = escapeHtml(title);
  const safePreview = preview ? escapeHtml(preview) : "";
  const shopName = shop?.name ? escapeHtml(shop.name) : "Quivo";
  const logoUrl = shop?.logoUrl;
  const safeFooter =
    footerNote ??
    "You're receiving this because you have an account on Quivo. If this wasn't you, please contact support.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#F7F0E6;font-family:Helvetica,Arial,sans-serif;color:#27324A;">
    ${safePreview ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent;visibility:hidden;mso-hide:all;">${safePreview}</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F0E6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;box-shadow:0 1px 8px rgba(39,50,74,0.08);overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid rgba(46,51,68,0.08);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${shopName}" width="40" height="40" style="display:block;border-radius:10px;border:0;" />` : `<div style="font-weight:900;font-size:18px;color:${theme};">${shopName}</div>`}
                    </td>
                    <td align="right" style="vertical-align:middle;font-weight:700;font-size:12px;color:#746E73;letter-spacing:0.12em;text-transform:uppercase;">
                      Quivo
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;line-height:1.6;font-size:15px;color:#27324A;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8f6f1;border-top:1px solid rgba(46,51,68,0.05);">
                <p style="margin:0;font-size:12px;color:#746E73;line-height:1.6;">${escapeHtml(safeFooter)}</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#a4a09a;">© ${new Date().getFullYear()} Quivo · Nepal</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderTextFromBlocks(blocks: string[]): string {
  return blocks
    .map((b) => b.trim())
    .filter(Boolean)
    .join("\n\n");
}
