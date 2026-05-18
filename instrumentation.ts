/**
 * Next.js instrumentation hook — runs once when the server boots.
 *
 * Activates Sentry on either the nodejs or edge runtime depending on
 * NEXT_RUNTIME. The actual SDK is lazy-loaded so installs lag behind
 * deployments without crashing the boot.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("@/lib/sentry");
    await initSentry("nodejs");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    const { initSentry } = await import("@/lib/sentry");
    await initSentry("edge");
  }
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: "Pages Router" | "App Router"; routePath: string; routeType: string }
): Promise<void> {
  const { captureException } = await import("@/lib/sentry");
  await captureException(error, {
    extra: {
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
    },
  });
}
