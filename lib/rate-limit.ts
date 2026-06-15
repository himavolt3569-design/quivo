import { headers } from "next/headers";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (Note: In a serverless environment like Vercel, this resets per instance/cold start.
// For production scale across multiple edge nodes, Redis like Upstash is recommended).
const store: RateLimitStore = {};

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitOptions {
  maxAttempts?: number;
  windowMs?: number;
}

function fallbackRateLimit(
  identifier: string,
  maxAttempts: number,
  windowMs: number,
): { success: boolean; error?: string } {
  const now = Date.now();
  const record = store[identifier];

  if (!record || now > record.resetTime) {
    store[identifier] = {
      count: 1,
      resetTime: now + windowMs,
    };
    return { success: true };
  }

  record.count += 1;

  if (record.count > maxAttempts) {
    const minutesLeft = Math.ceil((record.resetTime - now) / 60000);
    return {
      success: false,
      error: `Too many requests. Please try again in ${minutesLeft} minute(s).`,
    };
  }

  return { success: true };
}

async function checkUpstashRateLimit(
  identifier: string,
  maxAttempts: number,
  windowMs: number,
): Promise<{ success: boolean; error?: string } | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const key = `rate:${identifier}`;
    const increment = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!increment.ok) return null;

    const incrementJson = await increment.json();
    const count = Number(incrementJson.result);

    if (count === 1) {
      await fetch(`${url}/pexpire/${encodeURIComponent(key)}/${windowMs}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    }

    if (count > maxAttempts) {
      const ttl = await fetch(`${url}/pttl/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const ttlJson = ttl.ok ? await ttl.json() : { result: windowMs };
      const minutesLeft = Math.max(
        1,
        Math.ceil(Number(ttlJson.result ?? windowMs) / 60000),
      );
      return {
        success: false,
        error: `Too many requests. Please try again in ${minutesLeft} minute(s).`,
      };
    }

    return { success: true };
  } catch {
    return null;
  }
}

export async function checkRateLimit(
  actionName: string,
  options: RateLimitOptions = {},
): Promise<{ success: boolean; error?: string }> {
  const maxAttempts = Math.max(
    1,
    Math.min(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 500),
  );
  const windowMs = Math.max(
    10_000,
    Math.min(options.windowMs ?? DEFAULT_WINDOW_MS, 24 * 60 * 60 * 1000),
  );
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headersList.get("x-real-ip")?.trim();
  const ip = forwarded || realIp || "unknown_ip";
  const identifier = `${actionName}:${windowMs}:${maxAttempts}:${ip}`;

  const shared = await checkUpstashRateLimit(identifier, maxAttempts, windowMs);
  return shared ?? fallbackRateLimit(identifier, maxAttempts, windowMs);
}
