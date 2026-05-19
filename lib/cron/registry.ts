import "server-only";

import { log } from "@/lib/log";

/**
 * Cron job registry.
 *
 * Every scheduled job is one function registered here keyed by an URL-safe
 * slug. The dispatcher at `/api/cron/[job]` looks the slug up, enforces a
 * per-job timeout and returns a structured result. New jobs only ever land
 * in this file — never as ad-hoc route handlers.
 */

export interface CronJobContext {
  /** The request ID propagated from middleware. */
  requestId: string;
  /** Seconds the dispatcher will allow before aborting the job. */
  timeoutMs: number;
  /** AbortSignal that fires when the per-job timeout elapses. */
  signal: AbortSignal;
}

export type CronJobResult = Record<string, unknown> | void;

export interface CronJobDefinition {
  /** URL slug — kebab case, no spaces. */
  name: string;
  /** One-line description shown in dev logs and the cron index. */
  description: string;
  /** Maximum wall time before the dispatcher aborts (defaults to 30s). */
  timeoutMs?: number;
  handler: (ctx: CronJobContext) => Promise<CronJobResult>;
}

const registry = new Map<string, CronJobDefinition>();

export function registerCronJob(def: CronJobDefinition): void {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(def.name)) {
    throw new Error(`Invalid cron job slug: ${def.name}`);
  }
  if (registry.has(def.name)) {
    throw new Error(`Cron job already registered: ${def.name}`);
  }
  registry.set(def.name, def);
}

export function getCronJob(name: string): CronJobDefinition | undefined {
  return registry.get(name);
}

export function listCronJobs(): CronJobDefinition[] {
  return [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Built-in jobs ───────────────────────────────────────────────────────────
// Each later phase registers its own jobs here as a side effect of importing
// this module. Keeping registrations co-located keeps the source of truth one
// file.

registerCronJob({
  name: "noop",
  description: "Wiring-check job. Always returns { ok: true } in O(1) time.",
  timeoutMs: 5_000,
  handler: async ({ requestId }) => {
    log.debug("cron noop", { requestId });
    return { ok: true };
  },
});
