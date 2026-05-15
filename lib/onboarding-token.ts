/**
 * Short-lived HMAC-signed token gating /onboarding/owner for owners who
 * already have at least one shop.
 *
 * Why:
 *   First-time owners (0 shops) reach /onboarding/owner naturally via
 *   /dashboard → no token required.  But once an owner has a shop, they
 *   should not be able to URL-bypass into the shop-creation flow — they
 *   must explicitly click "Add New Shop" in the shop switcher.  That CTA
 *   triggers a server action which issues this token and sets it as an
 *   HttpOnly, SameSite=Strict, Secure cookie.
 *
 *   The token is stateless: payload + signature only.  No DB roundtrip.
 *
 * Format:
 *   <userId>.<expiryUnixMs>.<base64url(hmac-sha256)>
 *
 * Secret:
 *   SUPABASE_SERVICE_ROLE_KEY (server-only env var). If absent, signing
 *   throws — tokens cannot be issued or verified in misconfigured envs.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ONBOARDING_COOKIE_NAME = "qv_onboarding_intent";
export const ONBOARDING_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 min

function getSecret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Onboarding token: SUPABASE_SERVICE_ROLE_KEY is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function issueOnboardingToken(userId: string): string {
  const exp = Date.now() + ONBOARDING_TOKEN_TTL_MS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the user-id the token was issued for, or null if invalid/expired. */
export function verifyOnboardingToken(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  if (!userId || !expStr || !sig) return null;

  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;

  let expected: Buffer;
  let provided: Buffer;
  try {
    expected = Buffer.from(sign(`${userId}.${expStr}`), "base64url");
    provided = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;
  return userId;
}
