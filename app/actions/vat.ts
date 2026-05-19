"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const ShopIdSchema = z.string().uuid();

export interface VatReportRow {
  source: "pos" | "online";
  invoice_no: string;
  date_iso: string;
  customer_pan: string | null;
  taxable_amount: number;
  tax_amount: number;
  total: number;
}

export interface VatReportSummary {
  rows: VatReportRow[];
  totals: {
    taxable: number;
    tax: number;
    total: number;
  };
  shop: {
    name: string;
    pan_number: string | null;
    vat_rate: number;
    vat_registered: boolean;
  };
  period: { from: string; to: string; year: number; month: number };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build a Nepal IRD VAT-3 style report for the given shop / month. Pulls
 * positive `sale` transactions from shop_transactions (POS) and `paid`
 * orders from the orders table (storefront), each contributing one invoice
 * line.
 */
export async function getVatReport(
  shopId: string,
  year: number,
  month: number // 1-12
): Promise<{ error?: string; report?: VatReportSummary }> {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };
  if (year < 2020 || year > 2100) return { error: "Invalid year" };
  if (month < 1 || month > 12) return { error: "Invalid month" };

  const startIso = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const endIso = new Date(Date.UTC(year, month, 1)).toISOString();

  try {
    const supabase = await createClient();

    const [{ data: shop, error: shopErr }, { data: posRows, error: posErr }, { data: orderRows, error: orderErr }] = await Promise.all([
      supabase
        .from("shops")
        .select("name, pan_number, vat_rate, vat_registered")
        .eq("id", idParse.data)
        .maybeSingle(),
      supabase
        .from("shop_transactions")
        .select("id, created_at, subtotal, tax_amount, amount, payment_method, type, description")
        .eq("shop_id", idParse.data)
        .eq("type", "sale")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: true }),
      supabase
        .from("orders")
        .select("id, order_number, created_at, subtotal, tax_amount, total_amount, payment_status, customer_email")
        .eq("shop_id", idParse.data)
        .in("payment_status", ["payment_verified", "cod_pending", "paid_pending_receipt_upload", "receipt_uploaded", "paid"])
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: true }),
    ]);

    if (shopErr) {
      log.error("getVatReport: shop lookup failed", { code: shopErr.code, message: shopErr.message });
      return { error: shopErr.message };
    }
    if (!shop) return { error: "Shop not found" };
    if (posErr) {
      log.error("getVatReport: pos query failed", { code: posErr.code, message: posErr.message });
      return { error: posErr.message };
    }
    if (orderErr) {
      log.error("getVatReport: order query failed", { code: orderErr.code, message: orderErr.message });
      return { error: orderErr.message };
    }

    const rows: VatReportRow[] = [];

    for (const r of posRows ?? []) {
      const taxable = round2(Number(r.subtotal ?? 0));
      const tax = round2(Number(r.tax_amount ?? 0));
      const total = round2(Number(r.amount ?? 0));
      rows.push({
        source: "pos",
        invoice_no: `POS-${(r.id as string).slice(0, 8).toUpperCase()}`,
        date_iso: r.created_at as string,
        customer_pan: null,
        taxable_amount: taxable,
        tax_amount: tax,
        total,
      });
    }

    for (const r of orderRows ?? []) {
      const taxable = round2(Number(r.subtotal ?? 0));
      const tax = round2(Number(r.tax_amount ?? 0));
      const total = round2(Number(r.total_amount ?? 0));
      rows.push({
        source: "online",
        invoice_no: (r.order_number as string) ?? `ORD-${(r.id as string).slice(0, 8).toUpperCase()}`,
        date_iso: r.created_at as string,
        customer_pan: null,
        taxable_amount: taxable,
        tax_amount: tax,
        total,
      });
    }

    rows.sort((a, b) => a.date_iso.localeCompare(b.date_iso));

    const totals = rows.reduce(
      (acc, row) => ({
        taxable: round2(acc.taxable + row.taxable_amount),
        tax: round2(acc.tax + row.tax_amount),
        total: round2(acc.total + row.total),
      }),
      { taxable: 0, tax: 0, total: 0 }
    );

    return {
      report: {
        rows,
        totals,
        shop: {
          name: shop.name as string,
          pan_number: (shop.pan_number as string | null) ?? null,
          vat_rate: Number(shop.vat_rate ?? 0),
          vat_registered: Boolean(shop.vat_registered),
        },
        period: { from: startIso, to: endIso, year, month },
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
