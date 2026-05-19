"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Shield, CreditCard, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

type Tab = "payments" | "security";

interface PaymentRow {
  id: string;
  payment_id: string;
  shop_id: string;
  action: string;
  actor_type: string;
  from_status: string | null;
  to_status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_full_name: string | null;
  actor_email: string | null;
}

interface SecurityRow {
  id: number;
  event_type: string;
  metadata: Record<string, unknown> | null;
  ip_hash: string | null;
  created_at: string;
}

interface AuditViewProps {
  shopId: string;
  shopName: string;
  paymentRows: PaymentRow[];
  securityRows: SecurityRow[];
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (/[,"\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function inRange(iso: string, fromISO: string, toISO: string): boolean {
  const t = new Date(iso).getTime();
  return t >= new Date(fromISO + "T00:00:00").getTime() && t <= new Date(toISO + "T23:59:59.999").getTime();
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AuditView({ shopName, paymentRows, securityRows }: AuditViewProps) {
  const [tab, setTab] = useState<Tab>("payments");
  const today = useMemo(() => new Date(), []);
  const monthAgo = useMemo(() => new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), [today]);
  const [from, setFrom] = useState<string>(toDateInput(monthAgo));
  const [to, setTo] = useState<string>(toDateInput(today));
  const [search, setSearch] = useState("");

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return paymentRows.filter((r) => {
      if (!inRange(r.created_at, from, to)) return false;
      if (!q) return true;
      return (
        r.action.toLowerCase().includes(q) ||
        r.payment_id.toLowerCase().includes(q) ||
        (r.actor_full_name ?? "").toLowerCase().includes(q) ||
        (r.actor_email ?? "").toLowerCase().includes(q) ||
        (r.to_status ?? "").toLowerCase().includes(q) ||
        (r.from_status ?? "").toLowerCase().includes(q)
      );
    });
  }, [paymentRows, from, to, search]);

  const filteredSecurity = useMemo(() => {
    const q = search.trim().toLowerCase();
    return securityRows.filter((r) => {
      if (!inRange(r.created_at, from, to)) return false;
      if (!q) return true;
      return r.event_type.toLowerCase().includes(q);
    });
  }, [securityRows, from, to, search]);

  const exportPayments = () => {
    const rows: string[][] = [
      ["When", "Action", "Actor", "Email", "Actor type", "From → To", "Payment ID", "Metadata"],
      ...filteredPayments.map((r) => [
        new Date(r.created_at).toISOString(),
        r.action,
        r.actor_full_name ?? "",
        r.actor_email ?? "",
        r.actor_type,
        `${r.from_status ?? ""} → ${r.to_status ?? ""}`,
        r.payment_id,
        JSON.stringify(r.metadata ?? {}),
      ]),
    ];
    downloadCsv(`${shopName.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}-payment-audit-${from}-to-${to}.csv`, rows);
  };

  const exportSecurity = () => {
    const rows: string[][] = [
      ["When", "Event", "IP hash", "Metadata"],
      ...filteredSecurity.map((r) => [
        new Date(r.created_at).toISOString(),
        r.event_type,
        r.ip_hash ?? "",
        JSON.stringify(r.metadata ?? {}),
      ]),
    ];
    downloadCsv(`security-events-${from}-to-${to}.csv`, rows);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/dashboard/owner/settings"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2"
          >
            <ChevronLeft className="h-3 w-3" /> Back to Settings
          </Link>
          <h1 className="text-2xl font-black text-[#27324A]">Audit log</h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">
            Payment lifecycle events for this shop and security events tied to your account.
          </p>
        </div>
        <button
          onClick={tab === "payments" ? exportPayments : exportSecurity}
          className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm flex items-center gap-2 shadow-sm"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-1 rounded-2xl border border-[#2E3344]/8 w-full sm:w-fit">
        <button
          onClick={() => setTab("payments")}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition ${
            tab === "payments" ? "bg-[#27324A] text-white" : "text-[#746E73] hover:text-[#27324A]"
          }`}
        >
          <CreditCard className="h-3.5 w-3.5" />
          Payment audit
          <span className="text-[10px] font-bold opacity-70">{paymentRows.length}</span>
        </button>
        <button
          onClick={() => setTab("security")}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition ${
            tab === "security" ? "bg-[#27324A] text-white" : "text-[#746E73] hover:text-[#27324A]"
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          Security events
          <span className="text-[10px] font-bold opacity-70">{securityRows.length}</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#2E3344]/8 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-[#746E73] mb-1 block">From</label>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-[#746E73] mb-1 block">To</label>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-[#746E73] mb-1 block flex items-center gap-1">
            <Filter className="h-3 w-3" /> Search
          </label>
          <Input
            placeholder={tab === "payments" ? "action, status, actor…" : "event type…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
        {tab === "payments" ? (
          filteredPayments.length === 0 ? (
            <EmptyState label="No payment events in range." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73] font-black">
                  <tr>
                    <Th>When</Th>
                    <Th>Action</Th>
                    <Th>Status</Th>
                    <Th>Actor</Th>
                    <Th>Payment</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E3344]/5">
                  {filteredPayments.map((r) => (
                    <tr key={r.id} className="hover:bg-[#f8f8f7]/50">
                      <Td>
                        <span className="text-xs text-[#746E73]">
                          {new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-bold text-[#27324A]">{r.action}</span>
                      </Td>
                      <Td>
                        <span className="text-xs text-[#27324A]">
                          {r.from_status ?? "—"} <span className="text-[#A7653A] font-black">→</span> {r.to_status ?? "—"}
                        </span>
                      </Td>
                      <Td>
                        <div className="text-xs">
                          <div className="font-bold text-[#27324A]">{r.actor_full_name ?? r.actor_type}</div>
                          {r.actor_email && <div className="text-[#746E73]">{r.actor_email}</div>}
                        </div>
                      </Td>
                      <Td>
                        <span className="font-mono text-[10px] text-[#746E73]">{r.payment_id.slice(0, 8)}…</span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredSecurity.length === 0 ? (
            <EmptyState label="No security events in range." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f8f8f7] text-[10px] uppercase tracking-widest text-[#746E73] font-black">
                  <tr>
                    <Th>When</Th>
                    <Th>Event</Th>
                    <Th>IP hash</Th>
                    <Th>Metadata</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E3344]/5">
                  {filteredSecurity.map((r) => (
                    <tr key={r.id} className="hover:bg-[#f8f8f7]/50">
                      <Td>
                        <span className="text-xs text-[#746E73]">
                          {new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-bold text-[#27324A]">{r.event_type}</span>
                      </Td>
                      <Td>
                        <span className="font-mono text-[10px] text-[#746E73]">{r.ip_hash ?? "—"}</span>
                      </Td>
                      <Td>
                        <pre className="text-[10px] text-[#746E73] whitespace-pre-wrap max-w-md">
                          {r.metadata && Object.keys(r.metadata).length > 0 ? JSON.stringify(r.metadata) : "—"}
                        </pre>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 whitespace-nowrap">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm font-bold text-[#746E73]">{label}</p>
    </div>
  );
}
