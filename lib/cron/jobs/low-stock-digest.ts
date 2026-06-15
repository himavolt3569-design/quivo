import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/events/emit";
import type { CronJobDefinition } from "@/lib/cron/registry";
import { log } from "@/lib/log";

/**
 * Scans every active shop for products at or below their low-stock threshold,
 * groups by shop, and emits one `low_stock.detected` event per shop. The
 * dispatcher fans the event out into email + in-app notifications.
 *
 * Idempotency: a daily-ish cadence is the natural rate-limit here. We also
 * stamp an idempotency key keyed by shop + UTC date so two runs in the same
 * day collapse to one event row.
 */
export const lowStockDigestJob: CronJobDefinition = {
  name: "low-stock-digest",
  description: "Daily low-stock digest. Emits low_stock.detected per shop.",
  timeoutMs: 120_000,
  handler: async () => {
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    // PostgREST can't express `stock <= low_stock_threshold` directly, so we
    // fetch all active products with a threshold set and filter in JS. With
    // ~1000 SKUs per shop and ≤ a few hundred shops, this is fine daily.
    const { data: candidates, error: candidatesErr } = await admin
      .from("products")
      .select("id, shop_id, name, unit, stock, low_stock_threshold")
      .eq("status", "active")
      .not("low_stock_threshold", "is", null);

    if (candidatesErr) {
      log.error("low-stock-digest: candidates query failed", {
        code: candidatesErr.code,
        message: candidatesErr.message,
      });
      throw new Error(
        `low-stock candidate query failed: ${candidatesErr.message}`,
      );
    }

    const byShop = new Map<
      string,
      {
        name: string;
        current: number;
        threshold: number;
        unit: string | null;
      }[]
    >();

    for (const p of candidates ?? []) {
      const stock = Number(p.stock ?? 0);
      const threshold = Number(p.low_stock_threshold ?? 0);
      if (threshold <= 0) continue;
      if (stock > threshold) continue;
      const list = byShop.get(p.shop_id as string) ?? [];
      list.push({
        name: p.name as string,
        current: stock,
        threshold,
        unit: (p.unit as string | null) ?? null,
      });
      byShop.set(p.shop_id as string, list);
    }

    let emitted = 0;
    for (const [shopId, items] of byShop) {
      if (items.length === 0) continue;
      const res = await emit({
        name: "low_stock.detected",
        shopId,
        payload: { shop_id: shopId, items },
        idempotencyKey: `low_stock:${shopId}:${today}`,
      });
      if (res.ok || res.skipped) emitted += 1;
    }

    return {
      shops_scanned: byShop.size,
      events_emitted: emitted,
      product_count: (candidates ?? []).length,
    };
  },
};
