"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Clock, LogIn, LogOut, Calendar, CheckCircle2, Store } from "lucide-react";
import { toast } from "sonner";
import { clockInShift, clockOutShift } from "@/app/actions/shifts";
import { createClient } from "@/lib/supabase/client";

export interface StaffShiftRow {
  id: string;
  shop_id: string;
  shop_name: string | null;
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
  initialShifts: StaffShiftRow[];
  userName: string;
  staffIds: string[];
}

function fmtDateLine(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function fmtHours(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3600000;
  if (hours <= 0) return null;
  return `${hours.toFixed(1)}h`;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "Clocked in",
  completed: "Completed",
  no_show: "No show",
  cancelled: "Cancelled",
};

export function StaffShiftsView({ initialShifts, userName, staffIds }: Props) {
  const [shifts, setShifts] = useState<StaffShiftRow[]>(initialShifts);
  const [isPending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);

  // Realtime: subscribe to shifts for each linked staff record. New shifts
  // scheduled by the owner appear without refresh; cancellations and updates
  // (e.g. owner edits the time) also flow in.
  useEffect(() => {
    if (staffIds.length === 0) return;
    const channels = staffIds.map((staffId) =>
      supabase
        .channel(`staff-shifts:${staffId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "shifts", filter: `staff_id=eq.${staffId}` },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const old = payload.old as { id?: string };
              if (old?.id) setShifts((prev) => prev.filter((s) => s.id !== old.id));
              return;
            }
            const row = payload.new as Partial<StaffShiftRow> & { id?: string };
            if (!row?.id) return;
            setShifts((prev) => {
              const idx = prev.findIndex((s) => s.id === row.id);
              if (idx === -1) {
                // We don't have shop_name from the payload; fall back to "Shop"
                const inserted: StaffShiftRow = {
                  id: row.id!,
                  shop_id: row.shop_id ?? "",
                  shop_name: row.shop_name ?? null,
                  staff_id: row.staff_id ?? staffId,
                  staff_name: row.staff_name ?? null,
                  scheduled_start: row.scheduled_start ?? new Date().toISOString(),
                  scheduled_end: row.scheduled_end ?? new Date().toISOString(),
                  clocked_in_at: row.clocked_in_at ?? null,
                  clocked_out_at: row.clocked_out_at ?? null,
                  status: row.status ?? "scheduled",
                  notes: row.notes ?? null,
                };
                return [...prev, inserted].sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
              }
              const next = prev.slice();
              next[idx] = { ...prev[idx], ...row, id: prev[idx].id };
              return next;
            });
          }
        )
        .subscribe()
    );
    return () => { channels.forEach((ch) => supabase.removeChannel(ch)); };
  }, [supabase, staffIds]);

  // Reading the wall clock each render is intentional — the "today" / "upcoming"
  // / "completed" partition must reflect now-at-paint, not now-at-mount.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const partitions = useMemo(() => {
    const active = shifts.find((s) => s.status === "in_progress");
    const today = shifts.filter((s) => {
      if (s.status === "cancelled" || s.status === "completed") return false;
      if (s.id === active?.id) return false;
      const start = new Date(s.scheduled_start);
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
      return start >= startOfToday && start <= endOfToday;
    });
    const upcoming = shifts.filter((s) => {
      if (s.status === "cancelled" || s.status === "completed" || s.status === "in_progress") return false;
      return new Date(s.scheduled_start).getTime() > now && !today.includes(s);
    });
    const completed = shifts.filter((s) => s.status === "completed" || s.status === "cancelled")
      .slice(-10).reverse();
    return { active, today, upcoming, completed };
  }, [shifts, now]);

  const handleClockIn = (shiftId: string) => {
    startTransition(async () => {
      const res = await clockInShift(shiftId);
      if (res.error) { toast.error(res.error); return; }
      setShifts((prev) => prev.map((s) => s.id === shiftId
        ? { ...s, clocked_in_at: res.at ?? new Date().toISOString(), status: "in_progress" }
        : s));
      toast.success("Clocked in");
    });
  };

  const handleClockOut = (shiftId: string) => {
    startTransition(async () => {
      const res = await clockOutShift(shiftId);
      if (res.error) { toast.error(res.error); return; }
      setShifts((prev) => prev.map((s) => s.id === shiftId
        ? { ...s, clocked_out_at: res.at ?? new Date().toISOString(), status: "completed" }
        : s));
      toast.success("Clocked out");
    });
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 animate-in fade-in duration-500">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#8D5132]">Staff dashboard</p>
        <h1 className="text-2xl font-black text-[#27324A] mt-1">Hi {userName.split(" ")[0] || "there"} 👋</h1>
        <p className="text-sm text-[#746E73] mt-1">Clock in and out of your shifts here.</p>
      </header>

      {/* Active shift card */}
      {partitions.active ? (
        <section className="rounded-[2rem] p-6 bg-gradient-to-br from-[#41A560] to-[#2c8b48] text-white shadow-xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest opacity-80">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> On the clock
          </div>
          <p className="mt-3 text-sm font-medium opacity-90 flex items-center gap-2">
            <Store className="h-4 w-4" /> {partitions.active.shop_name ?? "Shop"}
          </p>
          <p className="text-3xl font-black mt-1">{fmtTime(partitions.active.scheduled_start)} – {fmtTime(partitions.active.scheduled_end)}</p>
          <p className="text-xs opacity-80 mt-1">{fmtDateLine(partitions.active.scheduled_start)}</p>
          {partitions.active.clocked_in_at && (
            <p className="text-[11px] mt-2 opacity-75">Clocked in at {fmtTime(partitions.active.clocked_in_at)}</p>
          )}
          {partitions.active.notes && <p className="text-xs mt-3 italic opacity-85">&ldquo;{partitions.active.notes}&rdquo;</p>}
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleClockOut(partitions.active!.id)}
            className="mt-5 w-full h-12 rounded-2xl bg-white text-[#27324A] font-black flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" /> {isPending ? "Clocking out…" : "Clock out"}
          </button>
        </section>
      ) : (
        <section className="rounded-[2rem] p-6 bg-white border border-[#2E3344]/8 text-center">
          <Clock className="h-10 w-10 text-[#746E73]/30 mx-auto mb-2" />
          <p className="text-sm font-bold text-[#27324A]">Not on a shift right now.</p>
          <p className="text-xs text-[#746E73] mt-1">
            {partitions.today.length > 0 ? "You have a shift scheduled for today." : "Check back when your next shift starts."}
          </p>
        </section>
      )}

      {/* Today */}
      {partitions.today.length > 0 && (
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-[#8D5132] mb-3 ml-1">Today</h2>
          <ul className="space-y-2">
            {partitions.today.map((s) => (
              <li key={s.id} className="bg-white rounded-2xl p-4 border border-[#2E3344]/8 flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-[#F7F0E6] flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-[#A7653A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#27324A] truncate">{s.shop_name ?? "Shop"}</p>
                  <p className="text-xs text-[#746E73] font-medium">
                    {fmtTime(s.scheduled_start)} – {fmtTime(s.scheduled_end)}
                  </p>
                  {s.notes && <p className="text-[11px] text-[#746E73] italic truncate mt-0.5">&ldquo;{s.notes}&rdquo;</p>}
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleClockIn(s.id)}
                  className="h-10 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white text-xs font-black flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60"
                >
                  <LogIn className="h-3.5 w-3.5" /> Clock in
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Upcoming */}
      {partitions.upcoming.length > 0 && (
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-[#8D5132] mb-3 ml-1">Upcoming</h2>
          <ul className="space-y-2">
            {partitions.upcoming.map((s) => (
              <li key={s.id} className="bg-white rounded-2xl p-4 border border-[#2E3344]/8 flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-[#f8f8f7] flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-[#746E73]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#27324A] truncate">{s.shop_name ?? "Shop"}</p>
                  <p className="text-xs text-[#746E73] font-medium">
                    {fmtDateLine(s.scheduled_start)} · {fmtTime(s.scheduled_start)} – {fmtTime(s.scheduled_end)}
                  </p>
                  {s.notes && <p className="text-[11px] text-[#746E73] italic truncate mt-0.5">&ldquo;{s.notes}&rdquo;</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent */}
      {partitions.completed.length > 0 && (
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-[#8D5132] mb-3 ml-1">Recent</h2>
          <ul className="space-y-2">
            {partitions.completed.map((s) => {
              const hours = fmtHours(s.clocked_in_at, s.clocked_out_at);
              return (
                <li key={s.id} className="bg-white/60 rounded-2xl p-4 border border-[#2E3344]/5 flex items-center gap-3">
                  <CheckCircle2 className={`h-5 w-5 ${s.status === "completed" ? "text-[#41A560]" : "text-[#746E73]/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#27324A] truncate">{s.shop_name ?? "Shop"} · {STATUS_LABEL[s.status] ?? s.status}</p>
                    <p className="text-[11px] text-[#746E73]">
                      {fmtDateLine(s.scheduled_start)} · {fmtTime(s.scheduled_start)} – {fmtTime(s.scheduled_end)}
                      {hours && <span className="text-[#A7653A] ml-2">· {hours} worked</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {shifts.length === 0 && (
        <p className="text-center text-sm text-[#746E73] py-12">
          No shifts assigned yet. Ask your shop owner to schedule you.
        </p>
      )}
    </div>
  );
}
