"use client";

import { useMemo, useState } from "react";
import { Calendar as CalendarUi } from "@/components/ui/calendar";
import { Ban, Clock, UserCheck } from "lucide-react";
import type { ShiftRow } from "./ShiftsPanel";

interface Props {
  shifts: ShiftRow[];
  onCancel: (shiftId: string) => void;
  isPending: boolean;
}

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

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ShiftCalendarTab({ shifts, onCancel, isPending }: Props) {
  const [selected, setSelected] = useState<Date>(() => new Date());

  // Build a Set of date strings (YYYY-MM-DD in local tz) that have shifts
  const shiftDays = useMemo(() => {
    const set = new Set<string>();
    for (const s of shifts) {
      if (s.status === "cancelled") continue;
      const d = new Date(s.scheduled_start);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return set;
  }, [shifts]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const selectedShifts = useMemo(() => {
    return shifts
      .filter((s) => isSameLocalDay(new Date(s.scheduled_start), selected))
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  }, [shifts, selected]);

  return (
    <div className="grid lg:grid-cols-2 gap-6 p-5 sm:p-6">
      <div className="flex justify-center">
        <CalendarUi
          mode="single"
          selected={selected}
          onSelect={(d) => d && setSelected(d)}
          showOutsideDays
          captionLayout="dropdown"
          modifiers={{ hasShift: (date) => shiftDays.has(dayKey(date)) }}
          modifiersClassNames={{
            hasShift: "relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-[#A7653A]",
          }}
          className="rounded-2xl border border-[#2E3344]/8 bg-[#fcfbfa] p-3"
        />
      </div>

      <div>
        <h3 className="text-[11px] font-black uppercase tracking-widest text-[#8D5132] mb-3">
          {selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </h3>
        {selectedShifts.length === 0 ? (
          <p className="text-xs text-[#746E73] py-8 text-center font-medium border border-dashed border-[#2E3344]/10 rounded-2xl">
            No shifts on this day.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedShifts.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#2E3344]/5 bg-[#f8f8f7]">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${STATUS_STYLES[s.status] ?? "bg-[#f8f8f7]"}`}>
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#27324A] truncate">{s.staff_name ?? "Unknown"}</p>
                  <p className="text-[11px] text-[#746E73] font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {fmtTime(s.scheduled_start)} – {fmtTime(s.scheduled_end)}
                  </p>
                  {s.notes && <p className="text-[11px] text-[#746E73] italic truncate mt-0.5">&ldquo;{s.notes}&rdquo;</p>}
                </div>
                <span className={`text-[10px] font-black px-2 py-1 rounded-md ${STATUS_STYLES[s.status]}`}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
                {s.status === "scheduled" && (
                  <button
                    type="button"
                    onClick={() => onCancel(s.id)}
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
    </div>
  );
}
