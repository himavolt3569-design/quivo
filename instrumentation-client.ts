// Turbopack dev-mode workaround.
//
// In development, Next.js/Turbopack serialises server component render-timing
// marks (e.g. "​DashboardPage") from the Node.js process and replays them in
// the browser via performance.mark(). Because the server's timeOrigin differs
// from the browser page's timeOrigin, the replayed timestamps can land before
// the browser's timeOrigin, producing a negative relative time. A subsequent
// performance.measure() call rejects negative timestamps with a TypeError.
//
// This file runs before any other client-side code (Next.js 15+ feature) and
// patches performance.measure / performance.mark to silently swallow those
// errors so they don't surface as uncaught exceptions in the console.

if (typeof performance !== "undefined") {
  const _mark = performance.mark.bind(performance);
  performance.mark = function mark(
    ...args: Parameters<typeof performance.mark>
  ): PerformanceMark {
    try {
      return _mark(...args);
    } catch {
      // Return a minimal stand-in so callers that capture the return value
      // don't crash. The mark itself is non-critical (dev profiling only).
      return { name: String(args[0]), startTime: 0, duration: 0, entryType: "mark", detail: null, toJSON: () => ({}) } as PerformanceMark;
    }
  };

  const _measure = performance.measure.bind(performance);
  performance.measure = function measure(
    ...args: Parameters<typeof performance.measure>
  ): PerformanceMeasure {
    try {
      return _measure(...args);
    } catch {
      return { name: String(args[0]), startTime: 0, duration: 0, entryType: "measure", detail: null, toJSON: () => ({}) } as PerformanceMeasure;
    }
  };
}

// ─── Sentry browser init ─────────────────────────────────────────────────────
// Activated only when both @sentry/nextjs is installed and NEXT_PUBLIC_SENTRY_DSN
// is set. The dynamic import is hidden from static analysis so the bundle
// builds without the dep being present.
type SentryBrowserLike = {
  init(opts: Record<string, unknown>): void;
};

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  const moduleName = "@sentry/nextjs";
  const dyn = Function("m", "return import(m)") as (m: string) => Promise<unknown>;
  dyn(moduleName)
    .then((mod) => {
      const sdk = mod as SentryBrowserLike;
      sdk.init({
        dsn: sentryDsn,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
        release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? undefined,
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0.05,
        replaysOnErrorSampleRate: 1.0,
      });
    })
    .catch(() => {
      // @sentry/nextjs not installed yet — silent no-op.
    });
}
