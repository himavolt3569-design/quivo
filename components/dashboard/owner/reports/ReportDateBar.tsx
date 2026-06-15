"use client";

import { Input } from "@/components/ui/input";
import { presetRange } from "@/lib/reports/range";

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** Extra controls rendered on the right (toggles, export button). */
  right?: React.ReactNode;
}

const PRESETS: { id: Parameters<typeof presetRange>[0]; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
];

export function ReportDateBar({ from, to, onChange, right }: Props) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-[#2E3344]/8 shadow-sm flex flex-wrap items-end gap-3">
      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-[#746E73] mb-1 block">
          From
        </label>
        <Input
          type="date"
          value={from}
          max={to}
          onChange={(e) => onChange(e.target.value, to)}
          className="h-11 rounded-xl"
        />
      </div>
      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-[#746E73] mb-1 block">
          To
        </label>
        <Input
          type="date"
          value={to}
          min={from}
          onChange={(e) => onChange(from, e.target.value)}
          className="h-11 rounded-xl"
        />
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              const r = presetRange(p.id);
              onChange(r.from, r.to);
            }}
            className="h-9 px-3 rounded-lg text-xs font-bold bg-[#f8f8f7] text-[#27324A] hover:bg-[#F7F0E6] transition"
          >
            {p.label}
          </button>
        ))}
      </div>
      {right && <div className="ml-auto flex items-end gap-2">{right}</div>}
    </div>
  );
}
