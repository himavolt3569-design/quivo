import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, type SendEmailInput } from "@/lib/email/send";
import { sendPushToUser, type PushPayload } from "@/lib/push/send";
import { log } from "@/lib/log";

/**
 * Channel-aware notification fan-out.
 *
 * Reads the user's notification_preferences once, then writes any of the
 * channels (email / in-app / push / sms) that aren't explicitly opted out
 * for the given kind. Missing prefs = opted in.
 *
 * Both channels respect their own gating: in-app writes a `notifications`
 * row even when email is off, and vice versa, so the owner always has at
 * least the bell to fall back on.
 */

export type NotificationKind =
  | "transaction.completed"
  | "order.placed"
  | "order.status_changed"
  | "refund.completed"
  | "low_stock.detected"
  | "kyc.stage_due"
  | "cart_abandoned"
  | "back_in_stock"
  | "price_drop"
  | "system";

type Channel = "email" | "in_app" | "push" | "sms";

export interface NotifyInput {
  userId: string;
  kind: NotificationKind;
  shopId?: string | null;
  inApp?: {
    title: string;
    body?: string;
    linkUrl?: string;
    data?: Record<string, unknown>;
  };
  email?: SendEmailInput;
  /** Optional override for the push notification body; otherwise inApp.* is reused. */
  push?: PushPayload;
}

interface PrefDoc {
  [kind: string]: Partial<Record<Channel, boolean>> | undefined;
}

async function loadPrefs(userId: string): Promise<PrefDoc> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_preferences")
    .select("prefs")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    log.warn("notify.loadPrefs failed", { userId, code: error.code, message: error.message });
    return {};
  }
  return (data?.prefs as PrefDoc | undefined) ?? {};
}

function isOptedIn(prefs: PrefDoc, kind: NotificationKind, channel: Channel): boolean {
  const k = prefs[kind];
  if (!k) return true;
  if (k[channel] === false) return false;
  return true;
}

export async function notifyUser(input: NotifyInput): Promise<{ inAppId?: string; emailOk?: boolean; emailSkipped?: boolean; }> {
  const prefs = await loadPrefs(input.userId);
  const result: { inAppId?: string; emailOk?: boolean; emailSkipped?: boolean } = {};

  // ─── In-app row ───────────────────────────────────────────────────────────
  if (input.inApp && isOptedIn(prefs, input.kind, "in_app")) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("notifications")
      .insert({
        user_id: input.userId,
        shop_id: input.shopId ?? null,
        kind: input.kind,
        title: input.inApp.title,
        body: input.inApp.body ?? null,
        link_url: input.inApp.linkUrl ?? null,
        data: input.inApp.data ?? {},
      })
      .select("id")
      .single();
    if (error) {
      log.error("notify: in_app insert failed", { userId: input.userId, kind: input.kind, code: error.code, message: error.message });
    } else {
      result.inAppId = data.id as string;
    }
  }

  // ─── Email ────────────────────────────────────────────────────────────────
  if (input.email && isOptedIn(prefs, input.kind, "email")) {
    const send = await sendEmail(input.email);
    if (send.ok) {
      result.emailOk = true;
    } else if ("skipped" in send && send.skipped) {
      result.emailSkipped = true;
    } else {
      log.error("notify: email failed", {
        userId: input.userId,
        kind: input.kind,
        error: "error" in send ? send.error : "unknown",
      });
    }
  }

  // ─── Web push ─────────────────────────────────────────────────────────────
  // Defaults from inApp so handlers don't have to repeat the message twice.
  const pushPayload: PushPayload | null =
    input.push ??
    (input.inApp
      ? { title: input.inApp.title, body: input.inApp.body, url: input.inApp.linkUrl, data: input.inApp.data }
      : null);
  if (pushPayload && isOptedIn(prefs, input.kind, "push")) {
    try {
      await sendPushToUser(input.userId, pushPayload);
    } catch (err) {
      log.warn("notify: push delivery failed", {
        userId: input.userId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
