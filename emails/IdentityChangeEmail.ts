import { renderEmailLayout, escapeHtml, renderTextFromBlocks } from "@/lib/email/layout";
import type { RenderedEmail } from "@/emails/OrderConfirmationEmail";

export type IdentityChangeKind = "password_changed" | "email_changed";

export interface IdentityChangeEmailInput {
  kind: IdentityChangeKind;
  toName: string;
  /** When the change happened (ISO). */
  whenIso?: string;
  /** Only for email_changed: the new email. */
  newEmail?: string | null;
  /** IP hash or coarse location to give the user a fingerprint. */
  ipHash?: string | null;
  /** Where the user goes to revert if this wasn't them. */
  helpUrl?: string;
}

const COPY: Record<IdentityChangeKind, { title: string; body: string }> = {
  password_changed: {
    title: "Your password was changed",
    body: "If this wasn't you, reset your password immediately and contact support.",
  },
  email_changed: {
    title: "Your account email was changed",
    body: "If this wasn't you, contact support straight away — your account may be compromised.",
  },
};

export function renderIdentityChangeEmail(input: IdentityChangeEmailInput): RenderedEmail {
  const c = COPY[input.kind];
  const subject = `${c.title} — Quivo`;
  const when = input.whenIso
    ? new Date(input.whenIso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#27324A;">${escapeHtml(c.title)}</h1>
    <p style="margin:0 0 12px;color:#27324A;">Hi ${escapeHtml(input.toName.split(/\s+/)[0] || input.toName)},</p>
    <p style="margin:0 0 16px;color:#27324A;">${escapeHtml(c.body)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;background:#f8f6f1;border-radius:12px;padding:14px;">
      <tr><td style="padding:4px 8px;font-size:12px;color:#746E73;text-transform:uppercase;letter-spacing:0.08em;font-weight:900;">When</td>
          <td style="padding:4px 8px;font-size:13px;color:#27324A;text-align:right;">${escapeHtml(when)}</td></tr>
      ${input.newEmail
        ? `<tr><td style="padding:4px 8px;font-size:12px;color:#746E73;text-transform:uppercase;letter-spacing:0.08em;font-weight:900;">New email</td>
                <td style="padding:4px 8px;font-size:13px;color:#27324A;text-align:right;">${escapeHtml(input.newEmail)}</td></tr>`
        : ""}
      ${input.ipHash
        ? `<tr><td style="padding:4px 8px;font-size:12px;color:#746E73;text-transform:uppercase;letter-spacing:0.08em;font-weight:900;">Device hash</td>
                <td style="padding:4px 8px;font-size:11px;font-family:monospace;color:#27324A;text-align:right;">${escapeHtml(input.ipHash)}</td></tr>`
        : ""}
    </table>
    ${input.helpUrl
      ? `<p style="margin:0;"><a href="${escapeHtml(input.helpUrl)}" style="display:inline-block;padding:12px 24px;background:#27324A;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Secure my account</a></p>`
      : ""}
  `;

  const html = renderEmailLayout({
    title: subject,
    preview: c.body,
    body,
    shop: { name: "Quivo" },
  });

  const text = renderTextFromBlocks([
    c.title,
    `Hi ${input.toName},`,
    c.body,
    `When: ${when}`,
    input.newEmail ? `New email: ${input.newEmail}` : "",
    input.ipHash ? `Device hash: ${input.ipHash}` : "",
    input.helpUrl ? `Secure my account: ${input.helpUrl}` : "",
  ]);

  return { subject, html, text };
}
