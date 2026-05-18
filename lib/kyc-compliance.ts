/**
 * KYC compliance policy + reminder helper.
 *
 * The "policy" half is pure — given a verification status, a creation time
 * and the current clock, it derives the grace window and the next email
 * stage. The "send" half delegates the actual transport to lib/email/send.ts
 * so we don't reach for the Resend HTTP API in two places.
 */

import { sendEmail, type SendEmailResult } from "@/lib/email/send";
import { renderKycComplianceEmail } from "@/emails/KycComplianceEmail";
import type { BrandedShop } from "@/lib/email/layout";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export type KycNotificationStage = "grace" | "warning" | "deadline";

export const KYC_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface KycComplianceInput {
  verificationStatus: VerificationStatus;
  createdAt: string;
  kycSubmittedAt?: string | null;
  now?: Date;
}

export interface KycCompliancePolicy {
  graceEndsAt: string;
  daysRemaining: number;
  isGraceActive: boolean;
  needsDocuments: boolean;
  isBlocked: boolean;
}

export function getKycCompliancePolicy({
  verificationStatus,
  createdAt,
  kycSubmittedAt,
  now = new Date(),
}: KycComplianceInput): KycCompliancePolicy {
  const createdTime = new Date(createdAt).getTime();
  const graceEndsTime = createdTime + KYC_GRACE_DAYS * DAY_MS;
  const remainingMs = graceEndsTime - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / DAY_MS));
  const isGraceActive = remainingMs > 0;
  const hasSubmittedDocuments =
    verificationStatus === "pending" ||
    verificationStatus === "verified" ||
    Boolean(kycSubmittedAt);
  const needsDocuments =
    verificationStatus === "rejected" ||
    (verificationStatus === "unverified" && !hasSubmittedDocuments);

  return {
    graceEndsAt: new Date(graceEndsTime).toISOString(),
    daysRemaining,
    isGraceActive,
    needsDocuments,
    isBlocked: !isGraceActive && needsDocuments,
  };
}

export function getKycNotificationStage(
  policy: KycCompliancePolicy,
  sent: {
    grace?: string | null;
    warning?: string | null;
    deadline?: string | null;
  }
): KycNotificationStage | null {
  if (!policy.needsDocuments) return null;
  if (!sent.grace) return "grace";
  if (policy.isBlocked && !sent.deadline) return "deadline";
  if (policy.isGraceActive && policy.daysRemaining <= 7 && !sent.warning) return "warning";
  return null;
}

export interface SendKycEmailInput {
  to: string;
  shopName: string;
  stage: KycNotificationStage;
  graceEndsAt: string;
  daysRemaining: number;
  brand?: BrandedShop;
  ctaUrl?: string;
}

export async function sendKycComplianceEmail(
  input: SendKycEmailInput
): Promise<SendEmailResult> {
  const rendered = renderKycComplianceEmail({
    shopName: input.shopName,
    stage: input.stage,
    graceEndsAt: input.graceEndsAt,
    daysRemaining: input.daysRemaining,
    graceWindowDays: KYC_GRACE_DAYS,
    brand: input.brand,
    ctaUrl: input.ctaUrl,
  });
  return sendEmail({
    to: input.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    from: process.env.KYC_EMAIL_FROM ?? process.env.EMAIL_FROM,
    tags: [
      { name: "kind", value: "kyc_compliance" },
      { name: "stage", value: input.stage },
    ],
  });
}
