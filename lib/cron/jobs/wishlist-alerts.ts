import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/events/emit";
import type { CronJobDefinition } from "@/lib/cron/registry";
import { log } from "@/lib/log";

/**
 * Scans saved_products for two transitions and emits one event per match:
 *
 *   back_in_stock.detected — the saved product's stock has gone from 0 to
 *   a positive number since we last alerted. Detection state lives on
 *   saved_products.back_in_stock_alerted_at (NULL means "we owe an alert
 *   if stock>0").
 *
 *   price_drop.detected — current price is at least 5% below the price we
 *   recorded at save time (price_at_save). We re-arm by bumping
 *   price_at_save once the alert fires.
 *
 * Idempotency: per-row alerted_at columns + per-emit idempotency keys.
 */

const PRICE_DROP_THRESHOLD = 0.05; // 5%

export const wishlistAlertsJob: CronJobDefinition = {
  name: "wishlist-alerts",
  description:
    "Sweep saved_products for back-in-stock + price-drop transitions.",
  timeoutMs: 120_000,
  handler: async () => {
    const admin = createAdminClient();

    // Pull the typed-FK saved rows joined with current product state.
    const { data, error } = await admin
      .from("saved_products")
      .select(
        `
        id, customer_id, product_uuid, shop_uuid, price_at_save,
        back_in_stock_alerted_at, price_drop_alerted_at,
        products!saved_products_product_uuid_fkey ( id, name, price, stock, status, barcode ),
        shops!saved_products_shop_uuid_fkey ( slug, status )
      `,
      )
      .not("product_uuid", "is", null)
      .limit(2000);
    if (error) {
      log.error("wishlist-alerts: query failed", {
        code: error.code,
        message: error.message,
      });
      throw new Error(`wishlist-alerts query failed: ${error.message}`);
    }

    let bisEmitted = 0;
    let pdEmitted = 0;
    let stockResets = 0;

    for (const row of (data ?? []) as unknown as Array<{
      id: string;
      customer_id: string;
      product_uuid: string;
      shop_uuid: string;
      price_at_save: number | null;
      back_in_stock_alerted_at: string | null;
      price_drop_alerted_at: string | null;
      products: {
        id: string;
        name: string;
        price: number;
        stock: number;
        status: string;
        barcode: string | null;
      } | null;
      shops: { slug: string; status: string } | null;
    }>) {
      const p = row.products;
      const s = row.shops;
      if (!p || !s || p.status !== "active" || s.status !== "active") continue;

      const stock = Number(p.stock ?? 0);
      const price = Number(p.price ?? 0);

      // ─── Back in stock ───────────────────────────────────────────────────
      if (stock > 0 && row.back_in_stock_alerted_at == null) {
        const res = await emit({
          name: "back_in_stock.detected",
          shopId: row.shop_uuid,
          userId: row.customer_id,
          payload: {
            product_id: p.id,
            customer_id: row.customer_id,
            product_name: p.name,
            shop_slug: s.slug,
            barcode: p.barcode,
          },
          idempotencyKey: `bis:${row.id}:${stock}`,
        });
        if (res.ok || res.skipped) {
          await admin
            .from("saved_products")
            .update({ back_in_stock_alerted_at: new Date().toISOString() })
            .eq("id", row.id);
          bisEmitted += 1;
        }
      } else if (stock <= 0 && row.back_in_stock_alerted_at != null) {
        // Re-arm so the next restock triggers another alert.
        await admin
          .from("saved_products")
          .update({ back_in_stock_alerted_at: null })
          .eq("id", row.id);
        stockResets += 1;
      }

      // ─── Price drop ──────────────────────────────────────────────────────
      if (row.price_at_save != null && price > 0) {
        const baseline = Number(row.price_at_save);
        if (baseline > 0 && price <= baseline * (1 - PRICE_DROP_THRESHOLD)) {
          const dropPct =
            Math.round(((baseline - price) / baseline) * 1000) / 10;
          const res = await emit({
            name: "price_drop.detected",
            shopId: row.shop_uuid,
            userId: row.customer_id,
            payload: {
              product_id: p.id,
              customer_id: row.customer_id,
              product_name: p.name,
              shop_slug: s.slug,
              barcode: p.barcode,
              old_price: baseline,
              new_price: price,
              drop_pct: dropPct,
            },
            idempotencyKey: `pdrop:${row.id}:${price}`,
          });
          if (res.ok || res.skipped) {
            // Rebaseline so we don't email again until another drop.
            await admin
              .from("saved_products")
              .update({
                price_at_save: price,
                price_drop_alerted_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            pdEmitted += 1;
          }
        }
      }
    }

    return {
      rows_scanned: (data ?? []).length,
      back_in_stock_emitted: bisEmitted,
      price_drop_emitted: pdEmitted,
      stock_resets: stockResets,
    };
  },
};
