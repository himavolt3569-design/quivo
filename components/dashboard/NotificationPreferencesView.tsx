"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, ChevronLeft, Mail, MessageSquare, Save, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  setNotificationPreferences,
  type ChannelPrefs,
  type NotificationPrefs,
} from "@/app/actions/notifications";

interface Props {
  backHref: string;
  initialPrefs: NotificationPrefs;
}

interface KindRow {
  id: string;
  label: string;
  description: string;
  /** Channels that are not yet wired up. They're rendered greyed out. */
  unsupported?: Array<keyof ChannelPrefs>;
}

const KINDS: KindRow[] = [
  { id: "transaction.completed", label: "POS sale closed",        description: "Each completed sale at the till." },
  { id: "order.placed",          label: "New storefront order",   description: "Someone placed an online order with your shop." },
  { id: "order.status_changed",  label: "Order status updates",   description: "Customer-facing reminders as orders progress." },
  { id: "refund.completed",      label: "Refund processed",       description: "A refund was issued and stock restored." },
  { id: "low_stock.detected",    label: "Low-stock digest",       description: "Daily list of SKUs at/below their threshold." },
  { id: "kyc.stage_due",         label: "KYC compliance reminder", description: "Grace, warning, and deadline emails." },
];

const CHANNELS: Array<{ id: keyof ChannelPrefs; label: string; icon: typeof Bell }> = [
  { id: "in_app", label: "In-app",  icon: Bell },
  { id: "email",  label: "Email",   icon: Mail },
  { id: "push",   label: "Push",    icon: Smartphone },
  { id: "sms",    label: "SMS",     icon: MessageSquare },
];

// Push + SMS land in later phases. Disable the controls but leave the slot.
const DISABLED_CHANNELS: Set<keyof ChannelPrefs> = new Set(["push", "sms"]);

function isOn(prefs: NotificationPrefs, kind: string, channel: keyof ChannelPrefs): boolean {
  const k = prefs[kind];
  if (!k) return !DISABLED_CHANNELS.has(channel); // default on for wired channels
  if (k[channel] === false) return false;
  if (k[channel] === undefined) return !DISABLED_CHANNELS.has(channel);
  return Boolean(k[channel]);
}

export function NotificationPreferencesView({ backHref, initialPrefs }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);
  const [isPending, startTransition] = useTransition();

  const isDirty = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(initialPrefs), [prefs, initialPrefs]);

  const toggle = (kind: string, channel: keyof ChannelPrefs) => {
    if (DISABLED_CHANNELS.has(channel)) return;
    setPrefs((prev) => {
      const current = prev[kind] ?? {};
      const next = { ...current, [channel]: !isOn(prev, kind, channel) };
      return { ...prev, [kind]: next };
    });
  };

  const save = () => {
    startTransition(async () => {
      const res = await setNotificationPreferences(prefs);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Preferences saved");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-1 text-xs font-bold text-[#746E73] hover:text-[#27324A] mb-2">
            <ChevronLeft className="h-3 w-3" /> Back
          </Link>
          <h1 className="text-2xl font-black text-[#27324A]">Notifications</h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">
            Pick which kinds of updates land where. SMS &amp; Push come later phases.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!isDirty || isPending}
          className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm flex items-center gap-2 shadow-sm disabled:opacity-40"
        >
          <Save className="h-4 w-4" /> {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#2E3344]/8 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f8f8f7]">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#746E73] w-1/2">Kind</th>
                {CHANNELS.map((c) => (
                  <th key={c.id} className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[#746E73]">
                    <span className="inline-flex items-center gap-1">
                      <c.icon className="h-3.5 w-3.5" />
                      {c.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2E3344]/5">
              {KINDS.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#27324A]">{k.label}</p>
                    <p className="text-xs text-[#746E73] mt-0.5">{k.description}</p>
                  </td>
                  {CHANNELS.map((c) => {
                    const disabled = DISABLED_CHANNELS.has(c.id);
                    const checked = isOn(prefs, k.id, c.id);
                    return (
                      <td key={c.id} className="px-4 py-3 text-center align-middle">
                        <label className={`inline-flex items-center justify-center ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}>
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={checked && !disabled}
                            onChange={() => toggle(k.id, c.id)}
                            className="sr-only peer"
                          />
                          <span className={`relative w-10 h-5 rounded-full transition ${
                            checked && !disabled
                              ? "bg-[#27324A]"
                              : "bg-[#E8E3D1]"
                          }`}>
                            <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                              checked && !disabled ? "translate-x-5" : ""
                            }`} />
                          </span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
