"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

const ShopIdSchema = z.string().uuid("Invalid shop ID");
const RowIdSchema = z.string().uuid("Invalid day-end ID");

export interface DayEndRow {
  id: string;
  shop_id: string;
  opened_at: string;
  opened_by: string | null;
  opening_cash: number;
  closed_at: string | null;
  closed_by: string | null;
  expected_cash: number | null;
  counted_cash: number | null;
  variance: number | null;
  notes: string | null;
}

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function getCurrentDay(shopId: string): Promise<{ row?: DayEndRow | null; error?: string }> {
  const parse = ShopIdSchema.safeParse(shopId);
  if (!parse.success) return { error: "Invalid shop ID" };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase
      .from("day_end_closes")
      .select("*")
      .eq("shop_id", parse.data)
      .is("closed_at", null)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { error: error.message };
    return { row: (data as DayEndRow | null) ?? null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function openDay(shopId: string, openingCash: number, notes?: string) {
  const parse = ShopIdSchema.safeParse(shopId);
  if (!parse.success) return { error: "Invalid shop ID" };
  if (!Number.isFinite(openingCash) || openingCash < 0) return { error: "Opening cash must be ≥ 0" };

  try {
    const { supabase, user } = await authed();
    const { data, error } = await supabase
      .from("day_end_closes")
      .insert({
        shop_id: parse.data,
        opening_cash: openingCash,
        opened_by: user.id,
        notes: notes ?? null,
      })
      .select("*")
      .single();
    if (error) {
      log.error("openDay failed", { code: error.code, message: error.message });
      if (error.code === "23505") return { error: "A day is already open for this shop." };
      return { error: error.message };
    }
    revalidatePath("/dashboard/owner/finances/day-end");
    return { row: data as DayEndRow };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function closeDay(rowId: string, countedCash: number, notes?: string) {
  const parse = RowIdSchema.safeParse(rowId);
  if (!parse.success) return { error: "Invalid day-end ID" };
  if (!Number.isFinite(countedCash) || countedCash < 0) return { error: "Counted cash must be ≥ 0" };

  try {
    const { supabase } = await authed();
    const { data, error } = await supabase.rpc("close_day_end", {
      p_id: parse.data,
      p_counted_cash: countedCash,
      p_notes: notes ?? null,
    });
    if (error) {
      log.error("closeDay failed", { code: error.code, message: error.message });
      return { error: error.message };
    }
    revalidatePath("/dashboard/owner/finances/day-end");
    return { row: data as DayEndRow };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listClosedDays(shopId: string) {
  const parse = ShopIdSchema.safeParse(shopId);
  if (!parse.success) return { error: "Invalid shop ID" };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase
      .from("day_end_closes")
      .select("*")
      .eq("shop_id", parse.data)
      .not("closed_at", "is", null)
      .order("opened_at", { ascending: false })
      .limit(60);
    if (error) return { error: error.message };
    return { rows: (data as DayEndRow[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Z-report ────────────────────────────────────────────────────────────────

export interface ZReport {
  shop: { id: string; name: string; pan_number: string | null };
  day: DayEndRow;
  totals: {
    gross_sales: number;
    tax_collected: number;
    discounts: number;
    refund_amount: number;
    net_sales: number;
    cash: number;
    card: number;
    qr: number;
    online: number;
    udhar: number;
    wallet: number;
    split: number;
  };
  by_staff: Array<{ staff_name: string; sales_count: number; gross: number }>;
  receipts: number;
}

/**
 * Compute the Z-report for a given day. Uses admin to bypass shop_members RLS
 * on the joins (the caller's membership is verified separately).
 */
export async function getZReport(rowId: string): Promise<{ report?: ZReport; error?: string }> {
  const parse = RowIdSchema.safeParse(rowId);
  if (!parse.success) return { error: "Invalid day-end ID" };

  try {
    const { supabase } = await authed();
    const { data: day, error: dayErr } = await supabase
      .from("day_end_closes")
      .select("*")
      .eq("id", parse.data)
      .maybeSingle();
    if (dayErr) return { error: dayErr.message };
    if (!day) return { error: "Day-end row not found" };

    const admin = createAdminClient();
    const start = day.opened_at as string;
    const end = (day.closed_at as string | null) ?? new Date().toISOString();

    const { data: shopRow } = await admin
      .from("shops")
      .select("id, name, pan_number")
      .eq("id", day.shop_id as string)
      .maybeSingle();

    const { data: txns } = await admin
      .from("shop_transactions")
      .select("id, amount, subtotal, discount_amount, tax_amount, payment_method, type, created_by, created_at")
      .eq("shop_id", day.shop_id as string)
      .gte("created_at", start)
      .lt("created_at", end);

    const { data: splits } = await admin
      .from("transaction_splits")
      .select("transaction_id, payment_method, amount")
      .gte("created_at", start)
      .lt("created_at", end);

    type TxRow = {
      id: string;
      amount: number;
      subtotal: number;
      discount_amount: number;
      tax_amount: number;
      payment_method: string;
      type: string;
      created_by: string | null;
    };

    const txList = ((txns ?? []) as unknown as TxRow[]);

    let gross_sales = 0;
    let tax_collected = 0;
    let discounts = 0;
    let refund_amount = 0;
    const byMethod: Record<string, number> = { cash: 0, card: 0, qr: 0, online: 0, udhar: 0, wallet: 0, split: 0 };
    const staffMap = new Map<string, { sales_count: number; gross: number }>();

    for (const t of txList) {
      if (t.type === "sale") {
        gross_sales += Number(t.amount ?? 0);
        tax_collected += Number(t.tax_amount ?? 0);
        discounts += Number(t.discount_amount ?? 0);
        const m = t.payment_method ?? "cash";
        if (m in byMethod) byMethod[m] += Number(t.amount ?? 0);
        const key = t.created_by ?? "unknown";
        const existing = staffMap.get(key) ?? { sales_count: 0, gross: 0 };
        staffMap.set(key, {
          sales_count: existing.sales_count + 1,
          gross: existing.gross + Number(t.amount ?? 0),
        });
      } else if (t.type === "expense" && Number(t.amount) < 0) {
        // Refunds are written as negative-amount expense rows in Phase 1.
        refund_amount += -Number(t.amount);
      }
    }

    // Split rows are already counted under the parent transaction's 'split'
    // bucket above, but for the per-method totals we want them attributed to
    // the underlying methods.
    if (splits && splits.length > 0) {
      const splitParentIds = new Set(splits.map((s) => s.transaction_id as string));
      // Subtract the 'split' totals we accumulated for transactions that have
      // matching split rows, then add the per-method components.
      for (const t of txList) {
        if (t.payment_method === "split" && splitParentIds.has(t.id)) {
          byMethod.split -= Number(t.amount ?? 0);
        }
      }
      for (const s of splits) {
        const m = (s.payment_method as string) ?? "cash";
        if (m in byMethod) byMethod[m] += Number(s.amount ?? 0);
      }
    }

    const net_sales = Math.round((gross_sales - tax_collected) * 100) / 100;

    const staffIds = [...staffMap.keys()].filter((k) => k !== "unknown");
    const { data: profiles } = staffIds.length > 0
      ? await admin.from("profiles").select("id, full_name").in("id", staffIds)
      : { data: [] };
    const nameById = new Map<string, string>();
    for (const p of profiles ?? []) nameById.set(p.id as string, (p.full_name as string) ?? "");

    const by_staff = [...staffMap.entries()].map(([id, v]) => ({
      staff_name: id === "unknown" ? "Unknown" : nameById.get(id) || id.slice(0, 8),
      sales_count: v.sales_count,
      gross: Math.round(v.gross * 100) / 100,
    }));

    return {
      report: {
        shop: {
          id: (shopRow?.id as string) ?? (day.shop_id as string),
          name: (shopRow?.name as string) ?? "Shop",
          pan_number: (shopRow?.pan_number as string | null) ?? null,
        },
        day: day as DayEndRow,
        totals: {
          gross_sales: Math.round(gross_sales * 100) / 100,
          tax_collected: Math.round(tax_collected * 100) / 100,
          discounts: Math.round(discounts * 100) / 100,
          refund_amount: Math.round(refund_amount * 100) / 100,
          net_sales,
          cash: Math.round(byMethod.cash * 100) / 100,
          card: Math.round(byMethod.card * 100) / 100,
          qr: Math.round(byMethod.qr * 100) / 100,
          online: Math.round(byMethod.online * 100) / 100,
          udhar: Math.round(byMethod.udhar * 100) / 100,
          wallet: Math.round(byMethod.wallet * 100) / 100,
          split: Math.round(byMethod.split * 100) / 100,
        },
        by_staff,
        receipts: txList.filter((t) => t.type === "sale").length,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
