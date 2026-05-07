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

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function checkRateLimit(actionName: string): Promise<{ success: boolean; error?: string }> {
  const headersList = await headers();
  // Attempt to get client IP, fallback to 'unknown'
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] || "unknown_ip";
  const identifier = `${actionName}_${ip}`;
  
  const now = Date.now();
  const record = store[identifier];

  if (!record) {
    store[identifier] = {
      count: 1,
      resetTime: now + WINDOW_MS,
    };
    return { success: true };
  }

  // If window has passed, reset
  if (now > record.resetTime) {
    store[identifier] = {
      count: 1,
      resetTime: now + WINDOW_MS,
    };
    return { success: true };
  }

  // If within window, increment count
  record.count += 1;

  if (record.count > MAX_ATTEMPTS) {
    const minutesLeft = Math.ceil((record.resetTime - now) / 60000);
    return { 
      success: false, 
      error: `Too many requests. Please try again in ${minutesLeft} minute(s).` 
    };
  }

  return { success: true };
}
