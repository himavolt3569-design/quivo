import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { StaffList } from "@/components/dashboard/owner/staff/StaffList";
import {
  ShiftsPanel,
  type ShiftRow,
} from "@/components/dashboard/owner/staff/ShiftsPanel";
import type { ShiftTemplateRow } from "@/components/dashboard/owner/staff/ShiftTemplatesTab";
import Link from "next/link";

interface RawShift {
  id: string;
  staff_id: string;
  scheduled_start: string;
  scheduled_end: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  status: string;
  notes: string | null;
  shop_staff: { name: string } | { name: string }[] | null;
}

interface RawTemplate {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  notes: string | null;
  active: boolean;
  shop_staff: { name: string } | { name: string }[] | null;
}

export default async function StaffPage() {
  const ctx = await getOwnerContext();
  const shopId = ctx.activeShop?.id ?? null;

  if (!shopId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-lg font-bold text-[#27324A]">No shop selected.</p>
        <Link
          href="/onboarding/owner"
          className="text-sm text-[#A7653A] hover:underline font-bold"
        >
          Create your first shop →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  // Server component: each request computes its own "two-weeks-ago" snapshot.
  // eslint-disable-next-line react-hooks/purity
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: staff }, { data: rawShifts }, { data: rawTemplates }] =
    await Promise.all([
      supabase
        .from("shop_staff")
        .select(
          "id, name, role, phone, email, notes, status, image_url, linked_user_id, created_at",
        )
        .eq("shop_id", shopId)
        .order("created_at", { ascending: true }),
      supabase
        .from("shifts")
        .select(
          "id, staff_id, scheduled_start, scheduled_end, clocked_in_at, clocked_out_at, status, notes, shop_staff(name)",
        )
        .eq("shop_id", shopId)
        .gte("scheduled_end", fourteenDaysAgo)
        .order("scheduled_start", { ascending: true }),
      supabase
        .from("shift_templates")
        .select(
          "id, staff_id, day_of_week, start_time, end_time, notes, active, shop_staff(name)",
        )
        .eq("shop_id", shopId)
        .order("day_of_week", { ascending: true }),
    ]);

  const shifts: ShiftRow[] = ((rawShifts ?? []) as RawShift[]).map((s) => {
    const staffRel = Array.isArray(s.shop_staff)
      ? s.shop_staff[0]
      : s.shop_staff;
    return {
      id: s.id,
      staff_id: s.staff_id,
      staff_name: staffRel?.name ?? null,
      scheduled_start: s.scheduled_start,
      scheduled_end: s.scheduled_end,
      clocked_in_at: s.clocked_in_at,
      clocked_out_at: s.clocked_out_at,
      status: s.status,
      notes: s.notes,
    };
  });

  const templates: ShiftTemplateRow[] = (
    (rawTemplates ?? []) as RawTemplate[]
  ).map((t) => {
    const rel = Array.isArray(t.shop_staff) ? t.shop_staff[0] : t.shop_staff;
    return {
      id: t.id,
      staff_id: t.staff_id,
      staff_name: rel?.name ?? null,
      day_of_week: t.day_of_week,
      start_time: t.start_time,
      end_time: t.end_time,
      notes: t.notes,
      active: t.active,
    };
  });

  const staffOptions = (staff ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    status: m.status,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end max-w-6xl mx-auto px-1">
        <Link
          href="/dashboard/owner/staff/sales"
          className="h-9 px-3 rounded-xl bg-white border border-[#2E3344]/10 text-xs font-bold text-[#27324A] hover:bg-[#F7F0E6] inline-flex items-center gap-1"
        >
          Sales by staff →
        </Link>
      </div>
      <StaffList shopId={shopId} initialStaff={staff ?? []} />
      <ShiftsPanel
        shopId={shopId}
        staffOptions={staffOptions}
        initialShifts={shifts}
        initialTemplates={templates}
      />
    </div>
  );
}
