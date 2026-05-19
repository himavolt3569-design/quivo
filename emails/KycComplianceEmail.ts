/**
 * KYC compliance email template.
 *
 * Returns the subject/html/text trio used by sendEmail(). The original copy
 * lives here so a future product/branding update edits one file. The
 * three stages map onto our KYC notification ladder:
 *
 *   grace    — first reminder after shop creation, 30 days out.
 *   warning  — 7-day reminder.
 *   deadline — grace period has ended, owner features locked.
 */

import { renderEmailLayout, escapeHtml, renderTextFromBlocks } from "@/lib/email/layout";
import type { BrandedShop } from "@/lib/email/layout";

export type KycNotificationStage = "grace" | "warning" | "deadline";

export interface KycComplianceEmailInput {
  shopName: string;
  stage: KycNotificationStage;
  graceEndsAt: string;
  daysRemaining: number;
  graceWindowDays: number;
  brand?: BrandedShop;
  /** Absolute URL the owner clicks to open the KYC page. */
  ctaUrl?: string;
}

export interface KycComplianceEmailOutput {
  subject: string;
  html: string;
  text: string;
}

const SUBJECTS: Record<KycNotificationStage, (i: KycComplianceEmailInput) => string> = {
  grace: (i) => `KYC documents due in ${i.graceWindowDays} days for ${i.shopName}`,
  warning: (i) =>
    `KYC documents due in ${i.daysRemaining} day${i.daysRemaining === 1 ? "" : "s"} for ${i.shopName}`,
  deadline: (i) => `KYC documents are now required for ${i.shopName}`,
};

const HEADLINES: Record<KycNotificationStage, string> = {
  grace: "Verify your business",
  warning: "Your KYC grace period is ending soon",
  deadline: "KYC verification is required",
};

function intro(i: KycComplianceEmailInput): string {
  const dueDate = new Date(i.graceEndsAt).toLocaleDateString("en-NP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  switch (i.stage) {
    case "grace":
      return `Your shop is live. You can use Quivo for ${i.graceWindowDays} days without uploading business proof. After that, owner features are paused until your KYC is on file. Due date: ${dueDate}.`;
    case "warning":
      return `Your KYC grace period is almost over. Please upload your business proof before ${dueDate} so your shop stays fully active.`;
    case "deadline":
      return `Your ${i.graceWindowDays}-day KYC grace period has ended. Upload your documents to continue using owner features. Due date: ${dueDate}.`;
  }
}

export function renderKycComplianceEmail(input: KycComplianceEmailInput): KycComplianceEmailOutput {
  const subject = SUBJECTS[input.stage](input);
  const headline = HEADLINES[input.stage];
  const introCopy = intro(input);
  const ctaUrl = input.ctaUrl ?? "https://quivo.app/dashboard/owner/settings/kyc";
  const safeShop = escapeHtml(input.shopName);
  const safeCta = escapeHtml(ctaUrl);

  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:900;color:#27324A;">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 20px;">${escapeHtml(introCopy)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8f6f1;border-radius:14px;padding:16px;margin:0 0 24px;">
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#746E73;">
          <strong style="display:block;color:#27324A;margin-bottom:4px;">Shop</strong>${safeShop}
        </td>
        <td style="padding:8px 12px;font-size:13px;color:#746E73;">
          <strong style="display:block;color:#27324A;margin-bottom:4px;">Status</strong>${escapeHtml(input.stage)}
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;">Open the Quivo owner dashboard and go to <strong>Settings → KYC Verification</strong>, or jump straight in:</p>
    <p style="margin:0 0 8px;">
      <a href="${safeCta}" style="display:inline-block;padding:12px 24px;background:#27324A;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Upload documents</a>
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:#a4a09a;">Need a hand? Reply to this email and our team will help.</p>
  `;

  const html = renderEmailLayout({
    title: subject,
    preview: introCopy,
    body,
    shop: input.brand ?? { name: input.shopName },
  });

  const text = renderTextFromBlocks([
    headline,
    introCopy,
    `Shop: ${input.shopName}`,
    `Open Quivo and go to Owner Dashboard > Settings > KYC Verification.`,
    `Direct link: ${ctaUrl}`,
  ]);

  return { subject, html, text };
}
