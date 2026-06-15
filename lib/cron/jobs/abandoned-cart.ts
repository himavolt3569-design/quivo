import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/events/emit";
import type { CronJobDefinition } from "@/lib/cron/registry";
import { log } from "@/lib/log";

/**
 * Scans for carts that haven't been touched in 24h and still have items
 * and have not yet been emailed about. Emits cart.abandoned per row; the
 * dispatcher (Phase 2) fans into email + in-app notification. Sets
 * abandoned_email_sent_at on success so we never email the same idle
 * cart twice.
 */
export const abandonedCartJob: CronJobDefinition = {
  name: "abandoned-cart",
  description: "Hourly: notify customers whose cart has been idle ≥ 24h.",
  timeoutMs: 120_000,
  handler: async () => {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Pull recently-eligible carts. JSONB length check is cheap in SQL.
    const { data: rows, error } = await admin
      .from("carts")
      .select("id, customer_id, shop_id, items, updated_at")
      .lt("updated_at", cutoff)
      .is("abandoned_email_sent_at", null);
    if (error) {
      log.error("abandoned-cart: query failed", {
        code: error.code,
        message: error.message,
      });
      throw new Error(`abandoned-cart query failed: ${error.message}`);
    }

    let emitted = 0;
    let cleared = 0;
    for (const row of rows ?? []) {
      const items =
        (row.items as unknown as Array<{ id: string; qty: number }> | null) ??
        [];
      if (!Array.isArray(items) || items.length === 0) {
        // Empty cart — mark as processed so we don't re-scan.
        await admin
          .from("carts")
          .update({ abandoned_email_sent_at: new Date().toISOString() })
          .eq("id", row.id as string);
        cleared += 1;
        continue;
      }
      const res = await emit({
        name: "cart.abandoned",
        shopId: row.shop_id as string,
        userId: row.customer_id as string,
        payload: {
          customer_id: row.customer_id,
          shop_id: row.shop_id,
          item_count: items.length,
          updated_at: row.updated_at,
        },
        idempotencyKey: `cart_abandoned:${row.id}:${row.updated_at}`,
      });
      if (res.ok || res.skipped) {
        await admin
          .from("carts")
          .update({ abandoned_email_sent_at: new Date().toISOString() })
          .eq("id", row.id as string);
        emitted += 1;
      }
    }

    return {
      rows_scanned: (rows ?? []).length,
      events_emitted: emitted,
      empty_cleared: cleared,
    };
  },
};
