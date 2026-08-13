"use client";

import { useMemo, useState, useTransition } from "react";
import { Clock, Plus, Trash2, Repeat, CalendarPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  upsertShiftTemplate,
  deleteShiftTemplate,
  generateShiftsFromTemplates,
} from "@/app/actions/shifts";

export interface ShiftTemplateRow {
  id: string;
  staff_id: string;
  staff_name: string | null;
  day_of_week: number;
  start_time: string; // HH:MM:SS
  end_time: string;
  notes: string | null;
  active: boolean;
}

interface StaffOption {
  id: string;
  name: string;
  status: string;
}

interface Props {
  shopId: string;
  staffOptions: StaffOption[];
  initialTemplates: ShiftTemplateRow[];
  onGenerated?: (created: number) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // index 0..6 matches DOW

function trimSeconds(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  const diff = (day + 6) % 7; // Monday first
  out.setDate(out.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function ShiftTemplatesTab({
  shopId,
  staffOptions,
  initialTemplates,
  onGenerated,
}: Props) {
  const [templates, setTemplates] =
    useState<ShiftTemplateRow[]>(initialTemplates);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShiftTemplateRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [generating, startGenerating] = useTransition();

  const activeStaff = useMemo(
    () => staffOptions.filter((s) => s.status === "active"),
    [staffOptions],
  );

  const [form, setForm] = useState({
    staffId: activeStaff[0]?.id ?? "",
    dayOfWeek: "1", // Monday default (as string for Select)
    startTime: "09:00",
    endTime: "17:00",
    notes: "",
    active: true,
  });

  const [genWeek, setGenWeek] = useState<string>(() =>
    toDateInput(startOfWeek(new Date())),
  );
  const [genDays, setGenDays] = useState<number>(7);

  const openCreate = () => {
    setEditing(null);
    setForm({
      staffId: activeStaff[0]?.id ?? "",
      dayOfWeek: "1",
      startTime: "09:00",
      endTime: "17:00",
      notes: "",
      active: true,
    });
    setShowForm(true);
  };

  const openEdit = (t: ShiftTemplateRow) => {
    setEditing(t);
    setForm({
      staffId: t.staff_id,
      dayOfWeek: String(t.day_of_week),
      startTime: trimSeconds(t.start_time),
      endTime: trimSeconds(t.end_time),
      notes: t.notes ?? "",
      active: t.active,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.staffId) {
      toast.error("Pick a staff member");
      return;
    }
    if (form.startTime === form.endTime) {
      toast.error("Start and end can't be equal");
      return;
    }

    startTransition(async () => {
      const res = await upsertShiftTemplate({
        id: editing?.id ?? null,
        shopId,
        staffId: form.staffId,
        dayOfWeek: Number(form.dayOfWeek),
        startTime: form.startTime,
        endTime: form.endTime,
        notes: form.notes.trim() || null,
        active: form.active,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Template updated" : "Template added");
      const staffName =
        activeStaff.find((s) => s.id === form.staffId)?.name ?? null;
      const newRow: ShiftTemplateRow = {
        id: res.id!,
        staff_id: form.staffId,
        staff_name: staffName,
        day_of_week: Number(form.dayOfWeek),
        start_time: form.startTime + ":00",
        end_time: form.endTime + ":00",
        notes: form.notes.trim() || null,
        active: form.active,
      };
      setTemplates((prev) => {
        const without = prev.filter((t) => t.id !== newRow.id);
        return [...without, newRow].sort(sortTemplates);
      });
      setShowForm(false);
      setEditing(null);
    });
  };

  const handleDelete = (id: string) => {
    if (
      !confirm("Delete this template? Shifts already generated stay in place.")
    )
      return;
    startTransition(async () => {
      const res = await deleteShiftTemplate(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    });
  };

  const handleGenerate = () => {
    if (!genWeek) {
      toast.error("Pick a start date");
      return;
    }
    const start = new Date(genWeek + "T00:00:00");
    const end = addDays(start, Math.max(genDays - 1, 0));
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    startGenerating(async () => {
      const res = await generateShiftsFromTemplates({
        shopId,
        startDate: toDateInput(start),
        endDate: toDateInput(end),
        timezone: tz,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const n = res.created ?? 0;
      if (n === 0) toast.info("All shifts already exist for this range");
      else toast.success(`${n} shift${n === 1 ? "" : "s"} generated`);
      onGenerated?.(n);
    });
  };

  // Group by staff for display
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { staff_id: string; staff_name: string | null; items: ShiftTemplateRow[] }
    >();
    for (const t of templates) {
      const entry = map.get(t.staff_id) ?? {
        staff_id: t.staff_id,
        staff_name: t.staff_name,
        items: [],
      };
      entry.items.push(t);
      map.set(t.staff_id, entry);
    }
    return Array.from(map.values())
      .map((g) => ({ ...g, items: g.items.sort(sortTemplates) }))
      .sort((a, b) => (a.staff_name ?? "").localeCompare(b.staff_name ?? ""));
  }, [templates]);

  return (
    <div className="p-5 sm:p-6 space-y-6">
      {/* Generator */}
      <div className="bg-[#F7F0E6]/40 border border-[#A7653A]/15 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <CalendarPlus className="h-4 w-4 text-[#A7653A]" />
          <h3 className="text-sm font-black text-[#27324A]">
            Generate shifts from templates
          </h3>
        </div>
        <p className="text-xs text-[#746E73] mb-4">
          Materialises real shifts from your active templates over the chosen
          range. Re-running is safe — existing shifts are skipped.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              Week starting
            </Label>
            <Input
              type="date"
              value={genWeek}
              onChange={(e) => setGenWeek(e.target.value)}
              className="mt-1 h-10 rounded-xl w-44 bg-white"
            />
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              For
            </Label>
            <Select
              value={String(genDays)}
              onValueChange={(v) => setGenDays(Number(v))}
            >
              <SelectTrigger className="mt-1 h-10 rounded-xl w-36 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">1 week</SelectItem>
                <SelectItem value="14">2 weeks</SelectItem>
                <SelectItem value="28">4 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={
              generating || templates.filter((t) => t.active).length === 0
            }
            className="h-10 rounded-xl bg-[#A7653A] hover:bg-[#8D5132] text-white font-bold"
          >
            <Repeat
              className={`h-4 w-4 mr-2 ${generating ? "hidden" : ""}`}
            />
            {generating ? "Generating…" : "Generate"}
          </Button>
        </div>
      </div>

      {/* Template list + add */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-[#8D5132]">
          Recurring templates
        </h3>
        <Button
          onClick={() => (showForm ? setShowForm(false) : openCreate())}
          disabled={activeStaff.length === 0}
          className="h-10 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white text-xs font-bold"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span className="ml-1.5">{showForm ? "Close" : "Add template"}</span>
        </Button>
      </div>

      {showForm && activeStaff.length > 0 && (
        <form
          onSubmit={handleSubmit}
          className="grid sm:grid-cols-2 gap-3 p-4 bg-[#F7F0E6]/30 rounded-2xl border border-[#2E3344]/8"
        >
          <div className="sm:col-span-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              Staff member
            </Label>
            <Select
              value={form.staffId}
              onValueChange={(v) => setForm((f) => ({ ...f, staffId: v }))}
            >
              <SelectTrigger className="mt-1 h-11 rounded-xl bg-white">
                <SelectValue placeholder="Pick staff" />
              </SelectTrigger>
              <SelectContent>
                {activeStaff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              Day of week
            </Label>
            <Select
              value={form.dayOfWeek}
              onValueChange={(v) => setForm((f) => ({ ...f, dayOfWeek: v }))}
            >
              <SelectTrigger className="mt-1 h-11 rounded-xl bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day, idx) => (
                  <SelectItem key={day} value={String(idx)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-xs font-bold text-[#27324A]">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
                className="h-4 w-4 rounded border-[#2E3344]/30"
              />
              Active
            </label>
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              Start
            </Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, startTime: e.target.value }))
              }
              required
              className="mt-1 h-11 rounded-xl bg-white"
            />
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              End
            </Label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, endTime: e.target.value }))
              }
              required
              className="mt-1 h-11 rounded-xl bg-white"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
              Notes (optional)
            </Label>
            <Input
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="e.g. weekend rush"
              className="mt-1 h-11 rounded-xl bg-white"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              type="submit"
              disabled={isPending}
              className="h-11 px-6 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold"
            >
              {isPending
                ? "Saving…"
                : editing
                  ? "Update template"
                  : "Add template"}
            </Button>
          </div>
        </form>
      )}

      {grouped.length === 0 ? (
        <p className="text-sm text-[#746E73] py-8 text-center font-medium border border-dashed border-[#2E3344]/10 rounded-2xl">
          No templates yet. Add one to start generating recurring shifts.
        </p>
      ) : (
        <ul className="space-y-4">
          {grouped.map((g) => (
            <li key={g.staff_id}>
              <p className="text-xs font-black uppercase tracking-wider text-[#27324A] ml-1 mb-2">
                {g.staff_name ?? "Unknown"}
              </p>
              <ul className="space-y-1.5">
                {g.items.map((t) => (
                  <li
                    key={t.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      t.active
                        ? "border-[#2E3344]/8 bg-[#f8f8f7]"
                        : "border-[#2E3344]/5 bg-white opacity-60"
                    }`}
                  >
                    <div className="h-10 w-12 rounded-lg bg-[#F7F0E6] flex flex-col items-center justify-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#A7653A]">
                        {DAYS[t.day_of_week]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#27324A] flex items-center gap-1">
                        <Clock className="h-3 w-3" />{" "}
                        {trimSeconds(t.start_time)} – {trimSeconds(t.end_time)}
                        {!t.active && (
                          <span className="text-[10px] font-bold text-[#746E73] ml-2">
                            (inactive)
                          </span>
                        )}
                      </p>
                      {t.notes && (
                        <p className="text-[11px] text-[#746E73] italic truncate">
                          &ldquo;{t.notes}&rdquo;
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      className="h-8 px-2.5 rounded-lg text-[11px] font-bold text-[#27324A] hover:bg-white transition"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      disabled={isPending}
                      className="h-8 w-8 rounded-lg text-[#746E73] hover:bg-red-50 hover:text-red-500 transition flex items-center justify-center disabled:opacity-40"
                      aria-label="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function sortTemplates(a: ShiftTemplateRow, b: ShiftTemplateRow): number {
  if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
  return a.start_time.localeCompare(b.start_time);
}
