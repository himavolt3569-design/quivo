import "server-only";

import { dispatchPendingEvents } from "@/lib/events/dispatcher";
import type { CronJobDefinition } from "@/lib/cron/registry";

/**
 * Drains the `domain_events` queue in a single pass. Vercel cron should run
 * this every minute. Each pass processes up to 25 events; long backlogs
 * catch up over consecutive runs.
 */
export const notificationsDispatchJob: CronJobDefinition = {
  name: "notifications-dispatch",
  description:
    "Drain the domain_events queue (transactions, orders, refunds, low stock, KYC).",
  timeoutMs: 60_000,
  handler: async () => {
    const result = await dispatchPendingEvents({ batchSize: 25 });
    return { ...result };
  },
};
