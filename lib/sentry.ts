import "server-only";

import { log } from "@/lib/log";

/**
 * Sentry runtime wrapper.
 *
 * Lazy-loads `@sentry/nextjs` if the dep is installed and `SENTRY_DSN` /
 * `NEXT_PUBLIC_SENTRY_DSN` is set; otherwise every call is a structured-log
 * no-op so the app builds and runs even before Sentry is provisioned.
 *
 * Activation checklist (operator):
 *   1. `pnpm add @sentry/nextjs`
 *   2. Set `NEXT_PUBLIC_SENTRY_DSN` (browser) and `SENTRY_DSN` (server) in env.
 *   3. Optionally set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` for
 *      source-map uploads via `withSentryConfig` in next.config.ts.
 *   4. Restart the app — `initSentry()` becomes a real init the next time
 *      instrumentation runs.
 */

type SentryRuntime = "nodejs" | "edge" | "browser";

type SentryLike = {
  init(opts: Record<string, unknown>): void;
  captureException(err: unknown, context?: Record<string, unknown>): void;
  captureMessage(msg: string, level?: string): void;
  setUser?(user: { id?: string; email?: string } | null): void;
  setTag?(key: string, value: string): void;
  flush?(timeoutMs?: number): Promise<boolean>;
};

let cached: SentryLike | null = null;
let cacheAttempted = false;

async function loadSdk(): Promise<SentryLike | null> {
  if (cacheAttempted) return cached;
  cacheAttempted = true;
  try {
    const moduleName = "@sentry/nextjs";
    const dyn = Function("m", "return import(m)") as (m: string) => Promise<unknown>;
    const mod = (await dyn(moduleName)) as SentryLike;
    cached = mod;
    return mod;
  } catch {
    return null;
  }
}

function getDsn(runtime: SentryRuntime): string | undefined {
  if (runtime === "browser") return process.env.NEXT_PUBLIC_SENTRY_DSN;
  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
}

export async function initSentry(runtime: SentryRuntime): Promise<void> {
  const dsn = getDsn(runtime);
  if (!dsn) {
    log.debug("Sentry init skipped: no DSN set", { runtime });
    return;
  }
  const sdk = await loadSdk();
  if (!sdk) {
    log.warn("Sentry init skipped: @sentry/nextjs not installed", { runtime });
    return;
  }
  sdk.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? undefined,
    tracesSampleRate: runtime === "browser" ? 0.1 : 0.2,
    replaysSessionSampleRate: runtime === "browser" ? 0.05 : 0,
    replaysOnErrorSampleRate: runtime === "browser" ? 1.0 : 0,
  });
  log.info("Sentry initialised", { runtime, env: process.env.NODE_ENV });
}

export async function captureException(
  err: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const sdk = await loadSdk();
  if (!sdk) {
    log.error("captureException (Sentry inactive)", {
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      ...context,
    });
    return;
  }
  try {
    sdk.captureException(err, context);
  } catch (sentryErr) {
    log.error("captureException failed", {
      original: err instanceof Error ? err.message : String(err),
      sentryError: sentryErr instanceof Error ? sentryErr.message : String(sentryErr),
    });
  }
}

export async function captureMessage(msg: string, level: "info" | "warning" | "error" = "info"): Promise<void> {
  const sdk = await loadSdk();
  if (!sdk) {
    log.info("captureMessage (Sentry inactive)", { msg, level });
    return;
  }
  try {
    sdk.captureMessage(msg, level);
  } catch (err) {
    log.error("captureMessage failed", {
      msg,
      level,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function setSentryUser(user: { id?: string; email?: string } | null): Promise<void> {
  const sdk = await loadSdk();
  sdk?.setUser?.(user);
}

export async function flushSentry(timeoutMs = 2_000): Promise<void> {
  const sdk = await loadSdk();
  await sdk?.flush?.(timeoutMs);
}
