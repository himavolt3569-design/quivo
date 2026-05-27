"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const ShopIdSchema = z.string().uuid("Invalid shop ID");
const IsoSchema = z.string().datetime({ offset: true }).or(z.string().datetime());

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase };
}

export interface ProfitabilityRow {
  product_id: string;
  name: string;
  units: number;
  revenue: number;
  cogs: number;
  gross_margin: number;
  margin_pct: number;
  current_price: number;
}

export async function getProductProfitability(shopId: string, startIso: string, endIso: string) {
  if (!ShopIdSchema.safeParse(shopId).success) return { error: "Invalid shop ID" };
  if (!IsoSchema.safeParse(startIso).success || !IsoSchema.safeParse(endIso).success) return { error: "Invalid date range" };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase.rpc("get_product_profitability", {
      p_shop_id: shopId, p_start: startIso, p_end: endIso,
    });
    if (error) { log.error("getProductProfitability failed", { code: error.code, message: error.message }); return { error: error.message }; }
    return { rows: (data ?? []) as ProfitabilityRow[] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export interface TopProductRow {
  product_id: string;
  name: string;
  units: number;
  revenue: number;
}

export async function getTopProducts(shopId: string, startIso: string, endIso: string, by: "revenue" | "units", limit = 20) {
  if (!ShopIdSchema.safeParse(shopId).success) return { error: "Invalid shop ID" };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase.rpc("get_top_products", {
      p_shop_id: shopId, p_start: startIso, p_end: endIso, p_by: by, p_limit: limit,
    });
    if (error) { log.error("getTopProducts failed", { code: error.code, message: error.message }); return { error: error.message }; }
    return { rows: (data ?? []) as TopProductRow[] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export interface TopCustomerRow {
  id: string;
  name: string;
  phone: string | null;
  total_spent: number;
  order_count: number;
  udhar_balance: number;
}

/** Top customers come straight from shop_customers (already aggregated). */
export async function getTopCustomers(shopId: string, by: "spent" | "orders", limit = 20) {
  if (!ShopIdSchema.safeParse(shopId).success) return { error: "Invalid shop ID" };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase
      .from("shop_customers")
      .select("id, name, phone, total_spent, order_count, udhar_balance")
      .eq("shop_id", shopId)
      .order(by === "orders" ? "order_count" : "total_spent", { ascending: false })
      .limit(Math.max(1, Math.min(limit, 200)));
    if (error) { log.error("getTopCustomers failed", { code: error.code, message: error.message }); return { error: error.message }; }
    return { rows: (data ?? []) as TopCustomerRow[] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export interface SalesByStaffRow {
  staff_id: string;
  staff_name: string;
  user_id: string | null;
  sales_count: number;
  gross_sales: number;
  hours_worked: number;
  sales_per_hour: number;
}

export async function getSalesByStaff(shopId: string, startIso: string, endIso: string) {
  if (!ShopIdSchema.safeParse(shopId).success) return { error: "Invalid shop ID" };
  try {
    const { supabase } = await authed();
    const { data, error } = await supabase.rpc("get_sales_by_staff", {
      p_shop_id: shopId, p_start: startIso, p_end: endIso,
    });
    if (error) { log.error("getSalesByStaff failed", { code: error.code, message: error.message }); return { error: error.message }; }
    return { rows: (data ?? []) as SalesByStaffRow[] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
