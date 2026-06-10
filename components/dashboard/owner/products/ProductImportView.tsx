"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Upload,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  bulkImportProducts,
  type ImportReport,
} from "@/app/actions/product-import";

interface Props {
  shopId: string;
}

// ─── CSV parsing (RFC 4180-ish, supports quoted fields with commas/newlines)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

// ─── Column normaliser
const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  brand: "Brand",
  category: "Category",
  unit: "Unit",
  variant: "Variant",
  description: "Description",
  price: "Price (Rs.)",
  cost_price: "Cost price (Rs.)",
  stock: "Stock",
  low_stock_threshold: "Low-stock threshold",
  barcode: "Barcode",
};
const FIELD_IDS = Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>;

const AUTO_MAP: Record<string, keyof typeof FIELD_LABELS> = {
  name: "name",
  product: "name",
  "product name": "name",
  item: "name",
  brand: "brand",
  category: "category",
  cat: "category",
  unit: "unit",
  variant: "variant",
  size: "variant",
  description: "description",
  desc: "description",
  details: "description",
  price: "price",
  sell: "price",
  "selling price": "price",
  mrp: "price",
  cost: "cost_price",
  "cost price": "cost_price",
  buy: "cost_price",
  stock: "stock",
  qty: "stock",
  quantity: "stock",
  "on hand": "stock",
  threshold: "low_stock_threshold",
  "low stock": "low_stock_threshold",
  "low stock threshold": "low_stock_threshold",
  reorder: "low_stock_threshold",
  barcode: "barcode",
  ean: "barcode",
  upc: "barcode",
  sku: "barcode",
};

function autoMapHeader(header: string): keyof typeof FIELD_LABELS | "" {
  const key = header.trim().toLowerCase();
  if (key in AUTO_MAP) return AUTO_MAP[key];
  // Looser: contains the keyword.
  for (const [needle, field] of Object.entries(AUTO_MAP)) {
    if (key.includes(needle)) return field;
  }
  // Direct match against field ids.
  if (FIELD_IDS.includes(key as keyof typeof FIELD_LABELS))
    return key as keyof typeof FIELD_LABELS;
  return "";
}

function downloadTemplate() {
  const header = [
    "name",
    "brand",
    "category",
    "unit",
    "variant",
    "description",
    "price",
    "cost_price",
    "stock",
    "low_stock_threshold",
    "barcode",
  ];
  const sample = [
    "Wai Wai Noodles",
    "Wai Wai",
    "Snacks",
    "30 g",
    "Chicken",
    "Instant noodle pack",
    "20",
    "16",
    "50",
    "10",
    "8901764012345",
  ];
  const csv = "﻿" + [header.join(","), sample.join(",")].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

interface ParsedRow {
  raw: string[];
  mapped: Record<string, string>;
  error: string | null;
}

function validateRow(mapped: Record<string, string>): string | null {
  const name = (mapped.name ?? "").trim();
  if (name.length < 2) return "Name is required (≥ 2 chars)";
  const price = Number(mapped.price);
  if (!Number.isFinite(price) || price < 0)
    return "Price must be a non-negative number";
  if (mapped.cost_price && Number.isNaN(Number(mapped.cost_price)))
    return "Cost price is not a number";
  if (mapped.stock && Number.isNaN(Number(mapped.stock)))
    return "Stock is not a number";
  if (
    mapped.low_stock_threshold &&
    Number.isNaN(Number(mapped.low_stock_threshold))
  )
    return "Threshold is not a number";
  return null;
}

export function ProductImportView({ shopId }: Props) {
  const [rawCsv, setRawCsv] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<
    Record<number, keyof typeof FIELD_LABELS | "">
  >({});
  const [rows, setRows] = useState<string[][]>([]);
  const [upsertByBarcode, setUpsertByBarcode] = useState(true);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const parsedRows: ParsedRow[] = useMemo(() => {
    return rows.map((raw) => {
      const mapped: Record<string, string> = {};
      raw.forEach((value, i) => {
        const field = mapping[i];
        if (field && value) mapped[field] = value;
      });
      const err = validateRow(mapped);
      return { raw, mapped, error: err };
    });
  }, [rows, mapping]);

  const ingestCsv = (text: string) => {
    setRawCsv(text);
    setReport(null);
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setHeaders([]);
      setRows([]);
      setMapping({});
      return;
    }
    const [headerRow, ...bodyRows] = parsed;
    setHeaders(headerRow);
    setRows(bodyRows);
    const initialMap: Record<number, keyof typeof FIELD_LABELS | ""> = {};
    headerRow.forEach((h, i) => {
      initialMap[i] = autoMapHeader(h);
    });
    setMapping(initialMap);
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    ingestCsv(text);
  };

  const errorCount = parsedRows.filter((r) => r.error).length;
  const goodCount = parsedRows.length - errorCount;
  const nameAssigned = Object.values(mapping).includes("name");
  const priceAssigned = Object.values(mapping).includes("price");
  const canSubmit =
    parsedRows.length > 0 &&
    nameAssigned &&
    priceAssigned &&
    goodCount > 0 &&
    !isPending;

  const submit = () => {
    const goodRows = parsedRows
      .filter((r) => !r.error)
      .map((r) => ({
        name: r.mapped.name?.trim(),
        brand: r.mapped.brand?.trim() || null,
        category: r.mapped.category?.trim() || null,
        unit: r.mapped.unit?.trim() || null,
        variant: r.mapped.variant?.trim() || null,
        description: r.mapped.description?.trim() || null,
        price: Number(r.mapped.price),
        cost_price: r.mapped.cost_price ? Number(r.mapped.cost_price) : null,
        stock: r.mapped.stock ? Number(r.mapped.stock) : 0,
        low_stock_threshold: r.mapped.low_stock_threshold
          ? Number(r.mapped.low_stock_threshold)
          : null,
        barcode: r.mapped.barcode?.trim() || null,
      }));

    startTransition(async () => {
      const res = await bulkImportProducts({
        shopId,
        upsertByBarcode,
        rows: goodRows as Parameters<typeof bulkImportProducts>[0]["rows"],
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.report) {
        setReport(res.report);
        toast.success(
          `Imported ${res.report.inserted} new, updated ${res.report.updated}.`,
        );
      }
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <Link
          href="/dashboard/owner/products"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2"
        >
          <ChevronLeft className="h-3 w-3" /> Back to Products
        </Link>
        <h1 className="text-2xl font-black text-[#27324A] flex items-center gap-2">
          <Upload className="h-6 w-6 text-[#A7653A]" /> Bulk import
        </h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">
          Paste or upload a CSV. We auto-detect columns; you can review the
          mapping before committing. Rows with a matching barcode update in
          place (toggle below to switch).
        </p>
      </div>

      {/* Step 1 — input */}
      <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73]">
            1. Source
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="h-9 px-3 rounded-xl border border-[#27324A]/15 text-[#27324A] text-xs font-bold flex items-center gap-1 hover:bg-[#f8f8f7]"
            >
              <Download className="h-3.5 w-3.5" /> Template
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-9 px-3 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white text-xs font-bold flex items-center gap-1"
            >
              <FileText className="h-3.5 w-3.5" /> Upload CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <textarea
          value={rawCsv}
          onChange={(e) => ingestCsv(e.target.value)}
          placeholder="Or paste CSV here (first row should be headers)…"
          rows={6}
          className="w-full px-3 py-2 text-sm font-mono border border-[#2E3344]/10 rounded-xl resize-y outline-none focus:border-[#27324A]"
        />
        <label className="flex items-center gap-2 text-xs font-bold text-[#27324A]">
          <input
            type="checkbox"
            checked={upsertByBarcode}
            onChange={(e) => setUpsertByBarcode(e.target.checked)}
            className="h-4 w-4 accent-[#27324A]"
          />
          Update existing products when barcode matches (otherwise duplicates
          are created)
        </label>
      </div>

      {/* Step 2 — column mapping */}
      {headers.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73]">
            2. Column mapping
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {headers.map((h, i) => (
              <div key={i}>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73] truncate">
                  {h || `(column ${i + 1})`}
                </p>
                <select
                  value={mapping[i] ?? ""}
                  onChange={(e) =>
                    setMapping((prev) => ({
                      ...prev,
                      [i]: e.target.value as keyof typeof FIELD_LABELS | "",
                    }))
                  }
                  className="h-10 px-2 rounded-lg border border-[#2E3344]/15 bg-white text-sm font-bold w-full mt-1"
                >
                  <option value="">— ignore —</option>
                  {FIELD_IDS.map((id) => (
                    <option key={id} value={id}>
                      {FIELD_LABELS[id]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {(!nameAssigned || !priceAssigned) && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[11px] font-bold text-red-700 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Both <em>Name</em> and <em>Price</em> mappings are required.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — preview */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#2E3344]/8 flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73]">
              3. Preview
            </h2>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {goodCount} OK
            </span>
            {errorCount > 0 && (
              <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                {errorCount} with issues
              </span>
            )}
          </div>
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-xs">
              <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73] font-black sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-left">Barcode</th>
                  <th className="px-3 py-2 text-left">Brand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E3344]/5">
                {parsedRows.slice(0, 500).map((r, idx) => (
                  <tr
                    key={idx}
                    className={
                      r.error ? "bg-red-50/40" : "hover:bg-[#f8f8f7]/50"
                    }
                  >
                    <td className="px-3 py-2 text-[#746E73]">{idx + 1}</td>
                    <td className="px-3 py-2">
                      {r.error ? (
                        <span className="text-red-700 inline-flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {r.error}
                        </span>
                      ) : (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-bold text-[#27324A]">
                      {r.mapped.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.mapped.price ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.mapped.stock ?? "0"}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {r.mapped.barcode ?? "—"}
                    </td>
                    <td className="px-3 py-2">{r.mapped.brand ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 500 && (
              <div className="p-3 text-[11px] font-bold text-[#746E73] text-center">
                Showing first 500 rows. All {parsedRows.length} rows will be
                submitted.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 4 — submit */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#746E73] font-bold">
            Ready to import <span className="text-[#27324A]">{goodCount}</span>{" "}
            row{goodCount === 1 ? "" : "s"}
            {errorCount > 0 && ` (skipping ${errorCount} with errors)`}.
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Commit import
          </button>
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 space-y-2">
          <h2 className="text-sm font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Done
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-3xl font-black text-emerald-700">
                {report.inserted}
              </p>
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#746E73] mt-1">
                Inserted
              </p>
            </div>
            <div>
              <p className="text-3xl font-black text-[#27324A]">
                {report.updated}
              </p>
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#746E73] mt-1">
                Updated
              </p>
            </div>
            <div>
              <p className="text-3xl font-black text-red-600">
                {report.skipped}
              </p>
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#746E73] mt-1">
                Skipped
              </p>
            </div>
          </div>
          {report.errors.length > 0 && (
            <details className="mt-3 text-xs font-bold text-red-600">
              <summary className="cursor-pointer">
                {report.errors.length} error
                {report.errors.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-2 space-y-1">
                {report.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>
                    row {e.index}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <Link
            href="/dashboard/owner/products"
            className="inline-block mt-3 h-10 px-3 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-xs"
          >
            ← Back to Products
          </Link>
        </div>
      )}
    </div>
  );
}
