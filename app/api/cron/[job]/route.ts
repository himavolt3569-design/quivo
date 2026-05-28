import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

import { getCronJob, listCronJobs } from "@/lib/cron/registry";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_TIMEOUT_MS = 30_000;
const REQUEST_ID_HEADER = "x-request-id";
const CRON_SECRET_HEADER = "x-cron-secret";

interface RouteParams {
  params: Promise<{ job: string }>;
}

async function authorize(): Promise<{ ok: true } | { ok: false; status: number; reason: string }> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Locked down by default. A missing CRON_SECRET means the operator has not
    // wired up authentication yet — refuse rather than silently allow.
    return { ok: false, status: 503, reason: "CRON_SECRET is not configured" };
  }
  const h = await headers();
  const provided = h.get(CRON_SECRET_HEADER);
  // Vercel cron sends `Authorization: Bearer <secret>`; accept that as a
  // fallback so the same endpoint works for Vercel deployments and manual
  // curl invocations.
  const bearer = h.get("authorization")?.replace(/^Bearer\s+/i, "");
  const candidate = provided ?? bearer;
  if (!candidate) {
    return { ok: false, status: 401, reason: "missing cron secret" };
  }
  // Compare SHA-256 digests so length-based timing leaks are eliminated and
  // every code path through authorize() takes constant time.
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) {
    return { ok: false, status: 401, reason: "invalid cron secret" };
  }
  return { ok: true };
}

export async function GET(request: Request, { params }: RouteParams) {
  const startedAt = Date.now();
  const { job: jobName } = await params;
  const h = await headers();
  const requestId = h.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();

  const auth = await authorize();
  if (!auth.ok) {
    log.warn("cron: rejecting", { requestId, jobName, reason: auth.reason });
    return NextResponse.json(
      { ok: false, error: auth.reason },
      { status: auth.status, headers: { [REQUEST_ID_HEADER]: requestId } }
    );
  }

  // Surface a discovery aid: GET /api/cron/_list returns the registry.
  if (jobName === "_list") {
    return NextResponse.json(
      {
        ok: true,
        jobs: listCronJobs().map((j) => ({
          name: j.name,
          description: j.description,
          timeoutMs: j.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        })),
      },
      { headers: { [REQUEST_ID_HEADER]: requestId } }
    );
  }

  const job = getCronJob(jobName);
  if (!job) {
    log.warn("cron: unknown job", { requestId, jobName });
    return NextResponse.json(
      { ok: false, error: `Unknown job: ${jobName}` },
      { status: 404, headers: { [REQUEST_ID_HEADER]: requestId } }
    );
  }

  const timeoutMs = job.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  log.info("cron: starting", { requestId, jobName, timeoutMs });

  try {
    const result = await Promise.race([
      job.handler({ requestId, timeoutMs, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(`cron job ${jobName} exceeded ${timeoutMs}ms timeout`));
        });
      }),
    ]);
    const durationMs = Date.now() - startedAt;
    log.info("cron: completed", { requestId, jobName, durationMs });
    return NextResponse.json(
      {
        ok: true,
        job: jobName,
        ranAt: new Date(startedAt).toISOString(),
        durationMs,
        result: result ?? null,
      },
      { headers: { [REQUEST_ID_HEADER]: requestId } }
    );
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    log.error("cron: failed", { requestId, jobName, durationMs, error: message });
    return NextResponse.json(
      {
        ok: false,
        job: jobName,
        ranAt: new Date(startedAt).toISOString(),
        durationMs,
        error: message,
      },
      { status: 500, headers: { [REQUEST_ID_HEADER]: requestId } }
    );
  } finally {
    clearTimeout(timer);
  }
}

// Vercel cron always POSTs starting in some configurations; accept both verbs
// to make manual curl smoke tests and the platform happy.
export const POST = GET;
