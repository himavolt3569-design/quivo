/**
 * Shared reporting date-range helpers.
 *
 * Report pages accept ?from=YYYY-MM-DD&to=YYYY-MM-DD&compare=prev_period.
 * `getRangeFromParams` normalises that into UTC ISO bounds (half-open
 * [start, end)) and, when comparison is on, an equal-length preceding window.
 */

export type CompareMode = "none" | "prev_period";

export interface ReportRange {
  start: string; // inclusive, ISO
  end: string; // exclusive, ISO
  compareStart?: string;
  compareEnd?: string;
  label: string; // human label e.g. "1 May – 31 May 2026"
}

function startOfDayUtc(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

function parseDateInput(v: string | undefined | null): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface RangeQuery {
  from?: string | string[];
  to?: string | string[];
  compare?: string | string[];
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function getRangeFromParams(
  q: RangeQuery,
  now = new Date(),
): ReportRange {
  const today = startOfDayUtc(now);
  // Default window: trailing 30 days through end of today.
  const defaultStart = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  const defaultEndExclusive = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const fromD = parseDateInput(first(q.from)) ?? defaultStart;
  const toD = parseDateInput(first(q.to));
  // `to` is inclusive in the UI, exclusive internally → +1 day.
  const endExclusive = toD
    ? new Date(toD.getTime() + 24 * 60 * 60 * 1000)
    : defaultEndExclusive;

  // Guard against inverted ranges.
  const start =
    fromD <= endExclusive
      ? fromD
      : new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000);

  const compare: CompareMode =
    first(q.compare) === "prev_period" ? "prev_period" : "none";

  const range: ReportRange = {
    start: start.toISOString(),
    end: endExclusive.toISOString(),
    label: formatRangeLabel(start, new Date(endExclusive.getTime() - 1)),
  };

  if (compare === "prev_period") {
    const ms = endExclusive.getTime() - start.getTime();
    range.compareStart = new Date(start.getTime() - ms).toISOString();
    range.compareEnd = start.toISOString();
  }

  return range;
}

export function formatRangeLabel(start: Date, endInclusive: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(start)} – ${fmt(endInclusive)}`;
}

/** Convenience presets for the date-range picker UI. */
export function presetRange(
  kind: "today" | "7d" | "30d" | "this_month" | "last_month",
  now = new Date(),
): { from: string; to: string } {
  const today = startOfDayUtc(now);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  switch (kind) {
    case "today":
      return { from: toIso(today), to: toIso(today) };
    case "7d":
      return {
        from: toIso(new Date(today.getTime() - 6 * 864e5)),
        to: toIso(today),
      };
    case "30d":
      return {
        from: toIso(new Date(today.getTime() - 29 * 864e5)),
        to: toIso(today),
      };
    case "this_month": {
      const s = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
      );
      return { from: toIso(s), to: toIso(today) };
    }
    case "last_month": {
      const s = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
      );
      const e = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0),
      );
      return { from: toIso(s), to: toIso(e) };
    }
  }
}

/** Percentage delta helper for "vs last period" KPIs. Returns null when the
 *  base is zero (avoids divide-by-zero / infinite growth). */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}
