"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const ShopIdSchema = z.string().uuid("Invalid shop ID");

const RowSchema = z.object({
  name: z.string().trim().min(2).max(160),
  brand: z.string().trim().max(80).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  unit: z.string().trim().max(40).optional().nullable(),
  variant: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  price: z.coerce.number().min(0).max(10_000_000),
  cost_price: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  stock: z.coerce.number().min(0).max(1_000_000).default(0),
  low_stock_threshold: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
  barcode: z.string().trim().max(40).optional().nullable(),
});

const BulkSchema = z.object({
  shopId: ShopIdSchema,
  /** When true, existing products matched on barcode are UPDATED in place. */
  upsertByBarcode: z.boolean().default(true),
  rows: z.array(RowSchema).min(1).max(2000),
});

export type ImportRow = z.infer<typeof RowSchema>;

export interface ImportReport {
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
}

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function bulkImportProducts(input: z.infer<typeof BulkSchema>): Promise<{ report?: ImportReport; error?: string }> {
  const parse = BulkSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Invalid input" };
  const data = parse.data;

  try {
    const { supabase } = await authed();
    const report: ImportReport = { inserted: 0, updated: 0, skipped: 0, errors: [] };

    // Build the list of barcodes present in the import so we can pre-fetch
    // existing rows to know which are updates vs inserts.
    const barcodes = data.rows
      .map((r) => r.barcode?.trim())
      .filter((b): b is string => !!b);

    let existingByBarcode = new Map<string, string>();
    if (data.upsertByBarcode && barcodes.length > 0) {
      const { data: existing } = await supabase
        .from("products")
        .select("id, barcode")
        .eq("shop_id", data.shopId)
        .in("barcode", barcodes);
      for (const row of existing ?? []) {
        if (row.barcode) existingByBarcode.set(row.barcode as string, row.id as string);
      }
    } else {
      existingByBarcode = new Map();
    }

    // Insert in batches of 100 to keep request size sane.
    const toInsert: Array<Record<string, unknown>> = [];
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

    data.rows.forEach((r, idx) => {
      const base = {
        shop_id: data.shopId,
        name: r.name,
        brand: r.brand ?? null,
        category: r.category ?? null,
        unit: r.unit ?? null,
        variant: r.variant ?? null,
        description: r.description ?? null,
        price: r.price,
        cost_price: r.cost_price ?? null,
        stock: r.stock ?? 0,
        low_stock_threshold: r.low_stock_threshold ?? null,
        barcode: r.barcode ?? null,
        status: "active" as const,
      };
      const existingId = r.barcode ? existingByBarcode.get(r.barcode) : undefined;
      if (existingId && data.upsertByBarcode) {
        updates.push({ id: existingId, patch: base });
      } else {
        toInsert.push(base);
      }
      void idx;
    });

    // Inserts in chunks.
    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100);
      const { error } = await supabase.from("products").insert(chunk);
      if (error) {
        log.error("bulkImportProducts: insert chunk failed", {
          chunkStart: i, code: error.code, message: error.message,
        });
        report.errors.push({ index: i, message: error.message });
        report.skipped += chunk.length;
      } else {
        report.inserted += chunk.length;
      }
    }

    // Updates one-by-one (still bounded; 2000 max rows).
    for (const u of updates) {
      const { error } = await supabase
        .from("products")
        .update(u.patch)
        .eq("id", u.id)
        .eq("shop_id", data.shopId);
      if (error) {
        report.errors.push({ index: -1, message: `${error.code}: ${error.message}` });
        report.skipped += 1;
      } else {
        report.updated += 1;
      }
    }

    revalidatePath("/dashboard/owner/products");
    return { report };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Returns a string the client can validate per-row before submitting.
 * Centralises the schema so the UI and the action agree on what's valid.
 */
export async function validateImportRow(row: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = RowSchema.safeParse(row);
  if (r.success) return { ok: true };
  return { ok: false, error: r.error.issues[0]?.message ?? "Invalid row" };
}
