import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/events/emit";
import {
  getKycCompliancePolicy,
  getKycNotificationStage,
  type VerificationStatus,
} from "@/lib/kyc-compliance";
import type { CronJobDefinition } from "@/lib/cron/registry";
import { log } from "@/lib/log";

/**
 * Daily KYC compliance reminder. Walks every shop, computes the policy,
 * and for any shop whose owner hasn't yet received the current stage
 * email, emits a `kyc.stage_due` event. The dispatcher sends the email
 * and stamps `kyc_<stage>_email_sent_at` on the shop.
 *
 * Idempotency: keyed by `kyc:<shop_id>:<stage>`. The stamp on the shop
 * row also prevents the same stage firing twice across runs.
 */
export const kycDeadlineJob: CronJobDefinition = {
  name: "kyc-deadline",
  description:
    "Daily KYC compliance reminder. Emits kyc.stage_due per shop needing the next stage email.",
  timeoutMs: 120_000,
  handler: async () => {
    const admin = createAdminClient();
    const { data: shops, error } = await admin
      .from("shops")
      .select(
        "id, name, owner_id, created_at, verification_status, kyc_submitted_at, kyc_grace_email_sent_at, kyc_warning_email_sent_at, kyc_deadline_email_sent_at",
      )
      .neq("verification_status", "verified");

    if (error) {
      log.error("kyc-deadline: shop query failed", {
        code: error.code,
        message: error.message,
      });
      throw new Error(`kyc shop query failed: ${error.message}`);
    }

    let emitted = 0;
    for (const s of shops ?? []) {
      const policy = getKycCompliancePolicy({
        verificationStatus:
          (s.verification_status as VerificationStatus) ?? "unverified",
        createdAt: s.created_at as string,
        kycSubmittedAt: (s.kyc_submitted_at as string | null) ?? null,
      });
      const stage = getKycNotificationStage(policy, {
        grace: (s.kyc_grace_email_sent_at as string | null) ?? null,
        warning: (s.kyc_warning_email_sent_at as string | null) ?? null,
        deadline: (s.kyc_deadline_email_sent_at as string | null) ?? null,
      });
      if (!stage) continue;

      // Owner email — look up profiles.email by owner_id.
      const { data: owner } = await admin
        .from("profiles")
        .select("email")
        .eq("id", s.owner_id as string)
        .maybeSingle();
      if (!owner?.email) continue;

      const res = await emit({
        name: "kyc.stage_due",
        shopId: s.id as string,
        payload: {
          shop_id: s.id,
          stage,
          to: owner.email,
          grace_ends_at: policy.graceEndsAt,
          days_remaining: policy.daysRemaining,
        },
        idempotencyKey: `kyc:${s.id}:${stage}`,
      });
      if (res.ok || res.skipped) emitted += 1;
    }

    return { shops_scanned: shops?.length ?? 0, events_emitted: emitted };
  },
};
