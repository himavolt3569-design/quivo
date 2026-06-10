"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  EmailSchema,
  MoneyAmountSchema,
  CurrencyCodeSchema,
  TimeOfDaySchema,
  OptionalShortText,
} from "@/lib/validation";

const IdSchema = z.string().uuid("Invalid ID");

const ScheduleShiftSchema = z.object({
  shopId: IdSchema,
  staffId: IdSchema,
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function scheduleShift(input: {
  shopId: string;
  staffId: string;
  start: string;
  end: string;
  notes?: string | null;
}): Promise<{ error?: string; id?: string }> {
  const parse = ScheduleShiftSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("schedule_shift", {
    p_shop_id: parse.data.shopId,
    p_staff_id: parse.data.staffId,
    p_scheduled_start: parse.data.start,
    p_scheduled_end: parse.data.end,
    p_notes: parse.data.notes ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/staff");
  revalidatePath("/dashboard/staff");
  return { id: data as string };
}

export async function cancelShift(
  shiftId: string,
): Promise<{ error?: string }> {
  const parse = IdSchema.safeParse(shiftId);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_shift", {
    p_shift_id: parse.data,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/staff");
  revalidatePath("/dashboard/staff");
  return {};
}

export async function clockInShift(
  shiftId: string,
): Promise<{ error?: string; at?: string }> {
  const parse = IdSchema.safeParse(shiftId);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clock_in_shift", {
    p_shift_id: parse.data,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/owner/staff");
  return { at: data as string };
}

export async function clockOutShift(
  shiftId: string,
): Promise<{ error?: string; at?: string }> {
  const parse = IdSchema.safeParse(shiftId);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clock_out_shift", {
    p_shift_id: parse.data,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/owner/staff");
  return { at: data as string };
}

export async function linkStaffToUser(
  staffId: string,
  email: string,
): Promise<{ error?: string; userId?: string }> {
  const idParse = IdSchema.safeParse(staffId);
  const emailParse = EmailSchema.safeParse(email);
  if (!idParse.success) return { error: idParse.error.issues[0].message };
  if (!emailParse.success) return { error: emailParse.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("link_staff_to_user", {
    p_staff_id: idParse.data,
    p_email: emailParse.data,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/staff");
  return { userId: data as string };
}

export async function unlinkStaffUser(
  staffId: string,
): Promise<{ error?: string }> {
  const parse = IdSchema.safeParse(staffId);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unlink_staff_user", {
    p_staff_id: parse.data,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/staff");
  return {};
}

// ─── Payroll: staff rates ─────────────────────────────────────────────────────

const SetRateSchema = z.object({
  shopId: IdSchema,
  staffId: IdSchema,
  hourlyRate: MoneyAmountSchema.refine(
    (n) => n <= 1_000_000,
    "Rate is too high",
  ),
  effectiveFrom: z.string().datetime({ offset: true }).optional().nullable(),
  currency: CurrencyCodeSchema.default("NPR"),
  note: OptionalShortText(200, "Note"),
});

export async function setStaffRate(input: {
  shopId: string;
  staffId: string;
  hourlyRate: number;
  effectiveFrom?: string | null;
  currency?: string;
  note?: string | null;
}): Promise<{ error?: string; id?: string }> {
  const parse = SetRateSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_staff_rate", {
    p_shop_id: parse.data.shopId,
    p_staff_id: parse.data.staffId,
    p_hourly_rate: parse.data.hourlyRate,
    p_effective_from: parse.data.effectiveFrom ?? null,
    p_currency: parse.data.currency.toUpperCase(),
    p_note: parse.data.note ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/payroll");
  revalidatePath("/dashboard/owner/staff");
  return { id: data as string };
}

export async function deleteStaffRate(
  rateId: string,
): Promise<{ error?: string }> {
  const parse = IdSchema.safeParse(rateId);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_staff_rate", {
    p_rate_id: parse.data,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/payroll");
  return {};
}

// ─── Payroll: summary + lines ─────────────────────────────────────────────────

export interface PayrollSummaryRow {
  staff_id: string;
  staff_name: string;
  shifts_count: number;
  worked_seconds: number;
  worked_hours: number;
  scheduled_hours: number;
  total_pay: number;
  currency: string;
  current_rate: number | null;
}

export interface PayrollLine {
  shift_id: string;
  staff_id: string;
  staff_name: string;
  scheduled_start: string;
  scheduled_end: string;
  clocked_in_at: string;
  clocked_out_at: string;
  worked_hours: number;
  rate: number;
  pay: number;
  currency: string;
}

const RangeSchema = z.object({
  shopId: IdSchema,
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
});

export async function getPayrollSummary(input: {
  shopId: string;
  start: string;
  end: string;
}): Promise<{ error?: string; rows?: PayrollSummaryRow[] }> {
  const parse = RangeSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_payroll_summary", {
    p_shop_id: parse.data.shopId,
    p_start: parse.data.start,
    p_end: parse.data.end,
  });
  if (error) return { error: error.message };
  return { rows: (data ?? []) as PayrollSummaryRow[] };
}

export async function getPayrollLines(input: {
  shopId: string;
  start: string;
  end: string;
}): Promise<{ error?: string; lines?: PayrollLine[] }> {
  const parse = RangeSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_payroll_lines", {
    p_shop_id: parse.data.shopId,
    p_start: parse.data.start,
    p_end: parse.data.end,
  });
  if (error) return { error: error.message };
  return { lines: (data ?? []) as PayrollLine[] };
}

// ─── Shift templates ──────────────────────────────────────────────────────────

const UpsertTemplateSchema = z.object({
  id: IdSchema.optional().nullable(),
  shopId: IdSchema,
  staffId: IdSchema,
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: TimeOfDaySchema,
  endTime: TimeOfDaySchema,
  notes: OptionalShortText(200, "Notes"),
  active: z.boolean().default(true),
});

export async function upsertShiftTemplate(input: {
  id?: string | null;
  shopId: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  notes?: string | null;
  active?: boolean;
}): Promise<{ error?: string; id?: string }> {
  const parse = UpsertTemplateSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0].message };
  if (parse.data.startTime === parse.data.endTime) {
    return { error: "Start and end time cannot be equal" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_shift_template", {
    p_id: parse.data.id ?? null,
    p_shop_id: parse.data.shopId,
    p_staff_id: parse.data.staffId,
    p_day_of_week: parse.data.dayOfWeek,
    p_start_time: parse.data.startTime,
    p_end_time: parse.data.endTime,
    p_notes: parse.data.notes ?? null,
    p_active: parse.data.active,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/staff");
  return { id: data as string };
}

export async function deleteShiftTemplate(
  templateId: string,
): Promise<{ error?: string }> {
  const parse = IdSchema.safeParse(templateId);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_shift_template", {
    p_template_id: parse.data,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/staff");
  return {};
}

const GenerateSchema = z.object({
  shopId: IdSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  timezone: z.string().min(1).max(80).default("UTC"),
});

export async function generateShiftsFromTemplates(input: {
  shopId: string;
  startDate: string;
  endDate: string;
  timezone: string;
}): Promise<{ error?: string; created?: number }> {
  const parse = GenerateSchema.safeParse(input);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_shifts_from_templates", {
    p_shop_id: parse.data.shopId,
    p_start_date: parse.data.startDate,
    p_end_date: parse.data.endDate,
    p_timezone: parse.data.timezone,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/staff");
  revalidatePath("/dashboard/staff");
  return { created: Number(data ?? 0) };
}
