import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

/**
 * Web Push sender wrapper.
 *
 * Activated when `web-push` is installed AND `VAPID_PUBLIC_KEY` +
 * `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` env are set. Until then it's a
 * structured-log no-op so the rest of the notification pipeline runs.
 *
 * Activation steps (operator):
 *   1. `pnpm add web-push @types/web-push -D`
 *   2. Generate keys: `npx web-push generate-vapid-keys --json`
 *   3. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
 *      VAPID_SUBJECT=mailto:ops@quivo.app
 *   4. Apply migration 20260516000026_push_subscriptions.sql.
 */

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

interface WebPushModule {
  setVapidDetails: (
    subject: string,
    publicKey: string,
    privateKey: string,
  ) => void;
  sendNotification: (
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
  ) => Promise<unknown>;
}

let cachedSdk: WebPushModule | null = null;
let attempted = false;

async function loadSdk(): Promise<WebPushModule | null> {
  if (attempted) return cachedSdk;
  attempted = true;
  const subject = process.env.VAPID_SUBJECT;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pub || !priv) {
    return null;
  }
  try {
    const moduleName = "web-push";
    const dyn = Function("m", "return import(m)") as (
      m: string,
    ) => Promise<unknown>;
    const mod = (await dyn(moduleName)) as {
      default?: WebPushModule;
    } & Partial<WebPushModule>;
    const sdk = (mod.default ?? mod) as WebPushModule;
    sdk.setVapidDetails(subject, pub, priv);
    cachedSdk = sdk;
    return sdk;
  } catch {
    return null;
  }
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; skipped?: true }> {
  const sdk = await loadSdk();
  if (!sdk) {
    log.info("sendPushToUser skipped (web-push not active)", {
      userId,
      title: payload.title,
    });
    return { sent: 0, failed: 0, skipped: true };
  }

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) {
    log.error("sendPushToUser: subs query failed", {
      code: error.code,
      message: error.message,
    });
    return { sent: 0, failed: 0 };
  }
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await sdk.sendNotification(
          {
            endpoint: s.endpoint as string,
            keys: { p256dh: s.p256dh as string, auth: s.auth as string },
          },
          body,
        );
        sent += 1;
      } catch (err) {
        const e = err as {
          statusCode?: number;
          body?: string;
          message?: string;
        };
        if (e.statusCode === 404 || e.statusCode === 410) {
          stale.push(s.id as string);
        } else {
          log.warn("sendPushToUser: delivery failed", {
            userId,
            endpoint: (s.endpoint as string).slice(0, 32) + "…",
            status: e.statusCode,
            message: e.message,
          });
        }
        failed += 1;
      }
    }),
  );

  if (stale.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", stale);
  }
  return { sent, failed };
}
