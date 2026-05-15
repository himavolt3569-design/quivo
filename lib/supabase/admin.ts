/**
 * Service-role Supabase client. Bypasses RLS — use sparingly and ONLY from
 * server actions / route handlers. Never import this from client components.
 *
 * Used for:
 *   - Reading payment gateway secrets (shop_payment_configs.esewa/khalti_secret_key)
 *   - Idempotent gateway callback updates (eSewa / Khalti redirect-back)
 *   - Any operation that must not be subject to caller RLS
 */
import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) is not configured."
    );
  }

  cached = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
