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

export async function sendKycComplianceEmail({
  to,
  shopName,
  stage,
  graceEndsAt,
  daysRemaining,
}: {
  to: string;
  shopName: string;
  stage: KycNotificationStage;
  graceEndsAt: string;
  daysRemaining: number;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.KYC_EMAIL_FROM ?? "Quivo <onboarding@quivo.app>";
  const dueDate = new Date(graceEndsAt).toLocaleDateString("en-NP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subjects: Record<KycNotificationStage, string> = {
    grace: `KYC documents due in ${KYC_GRACE_DAYS} days for ${shopName}`,
    warning: `KYC documents due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} for ${shopName}`,
    deadline: `KYC documents are now required for ${shopName}`,
  };

  const intro: Record<KycNotificationStage, string> = {
    grace: `Your shop is live. You can use Quivo for ${KYC_GRACE_DAYS} days without uploading business proof.`,
    warning: `Your KYC grace period is almost over. Please upload your business proof before ${dueDate}.`,
    deadline: `Your ${KYC_GRACE_DAYS}-day KYC grace period has ended. Upload documents to continue using owner features.`,
  };

  const text = `${intro[stage]}\n\nShop: ${shopName}\nDue date: ${dueDate}\n\nOpen Quivo and go to Owner Dashboard > Settings > KYC Verification.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#27324A">
      <h2 style="margin:0 0 12px">KYC verification reminder</h2>
      <p>${intro[stage]}</p>
      <p><strong>Shop:</strong> ${shopName}<br/><strong>Due date:</strong> ${dueDate}</p>
      <p>Open Quivo and go to <strong>Owner Dashboard &gt; Settings &gt; KYC Verification</strong>.</p>
    </div>
  `;

  if (!apiKey) {
    console.info("KYC email not sent: RESEND_API_KEY is not configured", {
      to,
      shopName,
      stage,
    });
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: subjects[stage],
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("KYC email failed", response.status, body);
    return { error: body || `Email API returned ${response.status}` };
  }

  return { success: true };
}
