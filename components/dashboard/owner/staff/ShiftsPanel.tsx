"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Calendar, Clock, Plus, X, UserCheck, Ban, List, CalendarDays, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { scheduleShift, cancelShift } from "@/app/actions/shifts";
import { createClient } from "@/lib/supabase/client";
import { ShiftCalendarTab } from "./ShiftCalendarTab";
import { ShiftTemplatesTab, type ShiftTemplateRow } from "./ShiftTemplatesTab";

interface StaffOption {
  id: string;
  name: string;
  status: string;
}

export interface ShiftRow {
  id: string;
  staff_id: string;
  staff_name: string | null;
  scheduled_start: string;
  scheduled_end: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  status: string;
  notes: string | null;
}

interface Props {
  shopId: string;
  staffOptions: StaffOption[];
  initialShifts: ShiftRow[];
  initialTemplates: ShiftTemplateRow[];
}

type TabId = "list" | "calendar" | "templates";

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-[#F7F0E6] text-[#A7653A]",
  in_progress: "bg-[#41A560]/10 text-[#41A560]",
  completed: "bg-[#27324A]/10 text-[#27324A]",
  no_show: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "Clocked in",
  completed: "Completed",
  no_show: "No show",
  cancelled: "Cancelled",
};

function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtShiftWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  const dateOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (sameDay) {
    return `${start.toLocaleDateString(undefined, dateOpts)} · ${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}`;
  }
  return `${start.toLocaleString(undefined, { ...dateOpts, ...opts })} → ${end.toLocaleString(undefined, { ...dateOpts, ...opts })}`;
}

function fmtHours(startIso: string | null, endIso: string | null): string | null {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms <= 0) return null;
  const hours = ms / (1000 * 60 * 60);
  return `${hours.toFixed(1)}h`;
}

export function ShiftsPanel({ shopId, staffOptions, initialShifts, initialTemplates }: Props) {
  const [shifts, setShifts] = useState<ShiftRow[]>(initialShifts);
  const [tab, setTab] = useState<TabId>("list");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const supabase = useMemo(() => createClient(), []);
  const staffNameLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of staffOptions) m.set(s.id, s.name);
    return m;
  }, [staffOptions]);

  const tomorrow9am = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
    return toDateTimeLocal(d);
  }, []);
  const tomorrow5pm = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(17, 0, 0, 0);
    return toDateTimeLocal(d);
  }, []);

  const [form, setForm] = useState({
    staffId: staffOptions[0]?.id ?? "",
    start: tomorrow9am,
    end: tomorrow5pm,
    notes: "",
  });

  const activeStaff = staffOptions.filter((s) => s.status === "active");

  // ─── Realtime: subscribe to shifts for this shop ────────────────────────────
  // Reconciles INSERT (also covers shifts created by other admins or by the
  // template generator), UPDATE (clock in/out from staff dashboard), DELETE.
  useEffect(() => {
    const channel = supabase
      .channel(`owner-shifts:${shopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts", filter: `shop_id=eq.${shopId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old?.id) setShifts((prev) => prev.filter((s) => s.id !== old.id));
            return;
          }
          const row = payload.new as Omit<ShiftRow, "staff_name"> & { staff_id: string };
          if (!row?.id) return;
          const enriched: ShiftRow = {
            id: row.id,
            staff_id: row.staff_id,
            staff_name: staffNameLookup.get(row.staff_id) ?? null,
            scheduled_start: row.scheduled_start,
            scheduled_end: row.scheduled_end,
            clocked_in_at: row.clocked_in_at,
            clocked_out_at: row.clocked_out_at,
            status: row.status,
            notes: row.notes,
          };
          setShifts((prev) => {
            const idx = prev.findIndex((s) => s.id === enriched.id);
            if (idx === -1) {
              return [...prev, enriched].sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
            }
            const next = prev.slice();
            // Preserve any staff_name we already had if the realtime payload doesn't have one
            next[idx] = { ...enriched, staff_name: enriched.staff_name ?? prev[idx].staff_name };
            return next;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, shopId, staffNameLookup]);

  const handleSchedule = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!form.staffId) { toast.error("Pick a staff member."); return; }
    if (!form.start || !form.end) { toast.error("Pick start and end times."); return; }

    startTransition(async () => {
      const startIso = new Date(form.start).toISOString();
      const endIso = new Date(form.end).toISOString();
      const res = await scheduleShift({
        shopId,
        staffId: form.staffId,
        start: startIso,
        end: endIso,
        notes: form.notes.trim() || null,
      });
      if (res.error) { toast.error(res.error); return; }
      // Realtime will deliver the row; nothing else to do client-side.
      toast.success("Shift scheduled");
      setShowForm(false);
      setForm((f) => ({ ...f, notes: "" }));
    });
  }, [shopId, form]);

  const handleCancel = useCallback((shiftId: string) => {
    startTransition(async () => {
      const res = await cancelShift(shiftId);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Shift cancelled");
    });
  }, []);

  const now = Date.now();
  const upcoming = shifts.filter((s) => s.status !== "cancelled" && new Date(s.scheduled_end).getTime() >= now);
  const past = shifts.filter((s) => s.status === "cancelled" || new Date(s.scheduled_end).getTime() < now)
    .slice(-10).reverse();

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "list", label: "List", icon: <List className="h-3.5 w-3.5" /> },
    { id: "calendar", label: "Calendar", icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { id: "templates", label: "Templates", icon: <Repeat className="h-3.5 w-3.5" /> },
  ];

  return (
    <section className="bg-white rounded-[2rem] border border-[#2E3344]/8 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-[#2E3344]/8 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-black text-[#27324A] text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#A7653A]" /> Shifts
          </h2>
          <p className="text-xs text-[#746E73] mt-0.5">Schedule shifts, track who&apos;s on the clock, and build recurring patterns.</p>
        </div>
        {tab === "list" && (
          <Button
            onClick={() => setShowForm((s) => !s)}
            disabled={activeStaff.length === 0}
            className="h-10 rounded-xl bg-[#A7653A] hover:bg-[#8D5132] text-white text-xs font-bold"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1.5">{showForm ? "Close" : "Schedule"}</span>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-5 sm:px-6 pt-4 border-b border-[#2E3344]/5 flex gap-1">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 h-9 rounded-t-lg text-xs font-black transition ${
                isActive ? "bg-[#27324A] text-white" : "text-[#746E73] hover:bg-[#f8f8f7]"
              }`}
            >
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>

      {activeStaff.length === 0 && (
        <div className="px-6 py-5 text-xs text-[#746E73] bg-[#F7F0E6]/40 border-b border-[#2E3344]/8">
          Add an active staff member above before scheduling shifts.
        </div>
      )}

      {/* ── LIST TAB ────────────────────────────────────────────────────────── */}
      {tab === "list" && (
        <>
          {showForm && activeStaff.length > 0 && (
            <form onSubmit={handleSchedule} className="p-5 sm:p-6 grid gap-3 sm:grid-cols-2 border-b border-[#2E3344]/8 bg-[#F7F0E6]/30">
              <div className="sm:col-span-2">
                <Label className="text-[11px] font-bold text-[#746E73] uppercase tracking-wider">Staff member</Label>
                <Select value={form.staffId} onValueChange={(v) => setForm((f) => ({ ...f, staffId: v }))}>
                  <SelectTrigger className="mt-1.5 h-11 rounded-xl bg-white">
                    <SelectValue placeholder="Pick a staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-bold text-[#746E73] uppercase tracking-wider">Start</Label>
                <Input type="datetime-local" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} className="mt-1.5 h-11 rounded-xl bg-white" required />
              </div>
              <div>
                <Label className="text-[11px] font-bold text-[#746E73] uppercase tracking-wider">End</Label>
                <Input type="datetime-local" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} className="mt-1.5 h-11 rounded-xl bg-white" required />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[11px] font-bold text-[#746E73] uppercase tracking-wider">Notes (optional)</Label>
                <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. cover the lunch rush" className="mt-1.5 h-11 rounded-xl bg-white" />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={isPending} className="h-11 px-6 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold">
                  {isPending ? "Scheduling…" : "Schedule shift"}
                </Button>
              </div>
            </form>
          )}

          <div className="p-5 sm:p-6 space-y-6">
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-[#8D5132] mb-3">Upcoming &amp; in progress</h3>
              {upcoming.length === 0 ? (
                <p className="text-xs text-[#746E73] py-4 text-center font-medium">No upcoming shifts.</p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#2E3344]/5 bg-[#f8f8f7]">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${STATUS_STYLES[s.status] ?? "bg-[#f8f8f7]"}`}>
                        <UserCheck className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#27324A] truncate">{s.staff_name ?? "Unknown"}</p>
                        <p className="text-[11px] text-[#746E73] font-medium flex items-center gap-1 truncate">
                          <Clock className="h-3 w-3" /> {fmtShiftWindow(s.scheduled_start, s.scheduled_end)}
                        </p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-md ${STATUS_STYLES[s.status]}`}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                      {s.status === "scheduled" && (
                        <button
                          type="button"
                          onClick={() => handleCancel(s.id)}
                          disabled={isPending}
                          className="h-8 w-8 rounded-lg text-[#746E73] hover:bg-red-50 hover:text-red-500 transition flex items-center justify-center disabled:opacity-40"
                          aria-label="Cancel shift"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {past.length > 0 && (
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-[#8D5132] mb-3">Recent</h3>
                <ul className="space-y-2">
                  {past.map((s) => {
                    const hours = fmtHours(s.clocked_in_at, s.clocked_out_at);
                    return (
                      <li key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f8f8f7]/60">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#27324A] truncate">{s.staff_name ?? "Unknown"}</p>
                          <p className="text-[11px] text-[#746E73] font-medium truncate">
                            {fmtShiftWindow(s.scheduled_start, s.scheduled_end)}
                            {hours && <span className="ml-2 text-[#A7653A]">· {hours} worked</span>}
                          </p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-md ${STATUS_STYLES[s.status]}`}>
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CALENDAR TAB ────────────────────────────────────────────────────── */}
      {tab === "calendar" && (
        <ShiftCalendarTab shifts={shifts} onCancel={handleCancel} isPending={isPending} />
      )}

      {/* ── TEMPLATES TAB ───────────────────────────────────────────────────── */}
      {tab === "templates" && (
        <ShiftTemplatesTab
          shopId={shopId}
          staffOptions={staffOptions}
          initialTemplates={initialTemplates}
        />
      )}
    </section>
  );
}
