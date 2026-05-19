import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendKycComplianceEmail } from "@/lib/kyc-compliance";
import { log } from "@/lib/log";

interface Payload {
  shop_id?: string;
  stage?: "grace" | "warning" | "deadline";
  to?: string;
  grace_ends_at?: string;
  days_remaining?: number;
}

export async function handleKycStageDue(payload: Payload): Promise<void> {
  if (!payload.shop_id || !payload.stage || !payload.to || !payload.grace_ends_at) {
    log.warn("kyc.stage_due handler: missing fields", { payload });
    return;
  }

  const admin = createAdminClient();
  const { data: shop } = await admin
    .from("shops")
    .select("id, name, logo_url, theme_color")
    .eq("id", payload.shop_id)
    .maybeSingle();
  if (!shop) return;

  const res = await sendKycComplianceEmail({
    to: payload.to,
    shopName: shop.name as string,
    stage: payload.stage,
    graceEndsAt: payload.grace_ends_at,
    daysRemaining: payload.days_remaining ?? 0,
    brand: {
      name: shop.name as string,
      logoUrl: (shop.logo_url as string | null | undefined) ?? null,
      themeColor: (shop.theme_color as string | null | undefined) ?? null,
    },
  });

  if (res.ok) {
    const column =
      payload.stage === "grace"
        ? "kyc_grace_email_sent_at"
        : payload.stage === "warning"
          ? "kyc_warning_email_sent_at"
          : "kyc_deadline_email_sent_at";
    await admin
      .from("shops")
      .update({ [column]: new Date().toISOString() })
      .eq("id", payload.shop_id);
  }
}
