"use client";

/**
 * Shared CSV export. One implementation so every report page produces the
 * same RFC-4180 output with a UTF-8 BOM (so Excel/LibreOffice detect
 * encoding correctly).
 */

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(rows: (string | number | null | undefined)[][]): string {
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  return "﻿" + body; // BOM
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/** Slugify a shop name into a safe filename stem. */
export function fileStem(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "report";
}
