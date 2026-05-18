import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

/**
 * Domain event emitter.
 *
 * Server actions and RPCs call `emit('transaction.completed', payload)` after
 * a business outcome lands. The row is durable; a Phase 2 cron consumer fans
 * the side-effects out (emails, notifications, push). Failures here MUST NOT
 * roll back the originating action — we log and move on so the user-facing
 * write stays consistent.
 */

export type DomainEventName =
  | "transaction.completed"
  | "transaction.voided"
  | "refund.requested"
  | "refund.completed"
  | "order.placed"
  | "order.status_changed"
  | "order.cancelled"
  | "low_stock.detected"
  | "kyc.stage_due"
  | "test.event";

export interface EmitInput<TPayload = Record<string, unknown>> {
  name: DomainEventName | (string & {});
  payload: TPayload;
  shopId?: string | null;
  userId?: string | null;
  aggregateId?: string | null;
  idempotencyKey?: string | null;
}

export interface EmitResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

export async function emit<TPayload = Record<string, unknown>>(
  input: EmitInput<TPayload>
): Promise<EmitResult> {
  if (!input.name || typeof input.name !== "string") {
    return { ok: false, error: "emit: event name is required" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn("emit: admin client unavailable, event dropped", {
      name: input.name,
      reason: message,
    });
    return { ok: false, skipped: true, reason: message };
  }

  const row = {
    name: input.name,
    payload: (input.payload ?? {}) as unknown as Record<string, unknown>,
    aggregate_id: input.aggregateId ?? null,
    shop_id: input.shopId ?? null,
    user_id: input.userId ?? null,
    idempotency_key: input.idempotencyKey ?? null,
  };

  // If the caller provided an idempotency key we use upsert on the unique index
  // so a retry collapses to one row; otherwise plain insert.
  const query = input.idempotencyKey
    ? admin
        .from("domain_events")
        .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true })
        .select("id")
        .maybeSingle()
    : admin.from("domain_events").insert(row).select("id").maybeSingle();

  const { data, error } = await query;
  if (error) {
    log.error("emit: insert failed", {
      name: input.name,
      shopId: input.shopId,
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: error.message };
  }

  log.debug("emit ok", { name: input.name, id: data?.id, shopId: input.shopId });
  return { ok: true, id: data?.id };
}

/**
 * Helper for the common "fire-and-forget after a write" pattern. The caller
 * doesn't await — useful inside a server action where the user-visible
 * response shouldn't wait for event-bus latency.
 *
 *   void emitBackground({ name: "transaction.completed", payload, shopId });
 */
export function emitBackground<T>(input: EmitInput<T>): void {
  void emit(input).catch((err) => {
    log.error("emitBackground: unhandled", {
      name: input.name,
      err: err instanceof Error ? err.message : String(err),
    });
  });
}
