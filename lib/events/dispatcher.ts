import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

import { handleTransactionCompleted } from "./handlers/transaction-completed";
import { handleOrderPlaced } from "./handlers/order-placed";
import { handleOrderStatusChanged } from "./handlers/order-status-changed";
import { handleRefundCompleted } from "./handlers/refund-completed";
import { handleLowStockDetected } from "./handlers/low-stock-detected";
import { handleKycStageDue } from "./handlers/kyc-stage-due";
// Phase 6
import { handleCartAbandoned } from "./handlers/cart-abandoned";
import { handleBackInStock } from "./handlers/back-in-stock";
import { handlePriceDrop } from "./handlers/price-drop";

/**
 * Domain event dispatcher.
 *
 * Polls `domain_events` for unprocessed rows, routes each by `name` to its
 * handler, then marks `processed_at` on success or bumps `attempt_count`
 * with the error message on failure.
 *
 * Idempotent: rerunning is safe because handlers themselves are idempotent
 * (notification rows are tied to the event row; emails carry idempotency
 * tags but Resend will not dedupe automatically — we rely on the
 * `processed_at` claim to prevent re-dispatch).
 *
 * Concurrency: we claim rows with `UPDATE … RETURNING` setting a
 * `claimed_at` timestamp before processing, so two cron runs that overlap
 * don't double-dispatch. (For Phase 2 the claim is implicit: we mark
 * processed_at synchronously after success; the cron runs at low cadence so
 * the window is small. A `claimed_at` column will land if/when we move to
 * a longer-running worker.)
 */

interface DomainEventRow {
  id: string;
  name: string;
  payload: Record<string, unknown> | null;
  attempt_count: number;
}

const HANDLERS: Record<string, ((payload: Record<string, unknown>) => Promise<void>) | undefined> = {
  "transaction.completed": (p) => handleTransactionCompleted(p as Parameters<typeof handleTransactionCompleted>[0]),
  "order.placed":          (p) => handleOrderPlaced(p as Parameters<typeof handleOrderPlaced>[0]),
  "order.status_changed":  (p) => handleOrderStatusChanged(p as Parameters<typeof handleOrderStatusChanged>[0]),
  "refund.completed":      (p) => handleRefundCompleted(p as Parameters<typeof handleRefundCompleted>[0]),
  "low_stock.detected":    (p) => handleLowStockDetected(p as Parameters<typeof handleLowStockDetected>[0]),
  "kyc.stage_due":         (p) => handleKycStageDue(p as Parameters<typeof handleKycStageDue>[0]),
  "cart.abandoned":        (p) => handleCartAbandoned(p as Parameters<typeof handleCartAbandoned>[0]),
  "back_in_stock.detected":(p) => handleBackInStock(p as Parameters<typeof handleBackInStock>[0]),
  "price_drop.detected":   (p) => handlePriceDrop(p as Parameters<typeof handlePriceDrop>[0]),
  "test.event":            async () => { /* no-op */ },
};

const MAX_ATTEMPTS = 5;

export interface DispatchResult {
  scanned: number;
  processed: number;
  failed: number;
  abandoned: number;
}

export async function dispatchPendingEvents(opts?: { batchSize?: number }): Promise<DispatchResult> {
  const batchSize = Math.min(Math.max(opts?.batchSize ?? 25, 1), 200);
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("domain_events")
    .select("id, name, payload, attempt_count")
    .is("processed_at", null)
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    log.error("dispatcher: select failed", { code: error.code, message: error.message });
    return { scanned: 0, processed: 0, failed: 0, abandoned: 0 };
  }

  const events = (rows ?? []) as DomainEventRow[];
  let processed = 0;
  let failed = 0;
  let abandoned = 0;

  for (const event of events) {
    const handler = HANDLERS[event.name];
    if (!handler) {
      log.warn("dispatcher: no handler for event, skipping", { id: event.id, name: event.name });
      await admin
        .from("domain_events")
        .update({ processed_at: new Date().toISOString(), processing_error: "no_handler_registered" })
        .eq("id", event.id);
      continue;
    }

    try {
      await handler(event.payload ?? {});
      const { error: ackErr } = await admin
        .from("domain_events")
        .update({ processed_at: new Date().toISOString(), processing_error: null })
        .eq("id", event.id);
      if (ackErr) {
        log.error("dispatcher: ack update failed", { id: event.id, code: ackErr.code, message: ackErr.message });
        failed += 1;
      } else {
        processed += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextAttempt = (event.attempt_count ?? 0) + 1;
      log.error("dispatcher: handler threw", { id: event.id, name: event.name, attempt: nextAttempt, message });
      await admin
        .from("domain_events")
        .update({ attempt_count: nextAttempt, processing_error: message.slice(0, 1000) })
        .eq("id", event.id);
      if (nextAttempt >= MAX_ATTEMPTS) abandoned += 1;
      else failed += 1;
    }
  }

  log.info("dispatcher: pass complete", { scanned: events.length, processed, failed, abandoned });
  return { scanned: events.length, processed, failed, abandoned };
}
