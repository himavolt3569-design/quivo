import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VERSION =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  "dev";

const STARTED_AT = Date.now();

type ServiceStatus = "ok" | "down" | "disabled";

interface HealthBody {
  status: "ok" | "degraded";
  uptime_seconds: number;
  version: string;
  checked_at: string;
  services: {
    db: ServiceStatus;
    resend: ServiceStatus;
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | { __timeout: true }> {
  return Promise.race([
    promise,
    new Promise<{ __timeout: true }>((resolve) => setTimeout(() => resolve({ __timeout: true }), ms)),
  ]);
}

async function checkDb(): Promise<ServiceStatus> {
  try {
    const admin = createAdminClient();
    // PostgrestFilterBuilder is thenable but not a Promise; wrap it.
    const query = Promise.resolve(
      admin.from("shops").select("id", { count: "exact", head: true }).limit(1)
    );
    const res = await withTimeout(query, 1000);
    if (res && typeof res === "object" && "__timeout" in res) return "down";
    const r = res as { error?: { message: string } | null };
    return r.error ? "down" : "ok";
  } catch {
    return "down";
  }
}

async function checkResend(): Promise<ServiceStatus> {
  if (!process.env.RESEND_API_KEY) return "disabled";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    const res = await fetch("https://api.resend.com/", {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timer);
    // 404 on the bare root is fine — it just means the host is reachable.
    if (!res) return "down";
    return res.status >= 500 ? "down" : "ok";
  } catch {
    return "down";
  }
}

export async function GET() {
  const [db, resend] = await Promise.all([checkDb(), checkResend()]);
  const degraded = db === "down" || resend === "down";
  const body: HealthBody = {
    status: degraded ? "degraded" : "ok",
    uptime_seconds: Math.round((Date.now() - STARTED_AT) / 1000),
    version: VERSION,
    checked_at: new Date().toISOString(),
    services: { db, resend },
  };
  return NextResponse.json(body, {
    status: degraded ? 503 : 200,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
