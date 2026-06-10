"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { log } from "@/lib/log";

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link_url: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

interface NotificationBellProps {
  initial: Notification[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function NotificationBell({ initial }: NotificationBellProps) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notification[]>(initial);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Realtime subscription to new rows for the current user.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const channelInstanceId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      channel = supabase
        .channel(`notifications:${user.id}:${channelInstanceId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new as Notification;
            setItems((prev) => {
              if (prev.some((n) => n.id === row.id)) return prev;
              return [row, ...prev].slice(0, 50);
            });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel).catch((err) => {
          log.warn("NotificationBell: removeChannel failed", {
            err: err instanceof Error ? err.message : String(err),
          });
        });
      }
    };
  }, [supabase]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter((n) => !n.read_at);

  const markOneRead = async (id: string) => {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
      ),
    );
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Could not mark as read");
  };

  const markAllRead = () => {
    startTransition(async () => {
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? now })),
      );
      const { error } = await supabase.rpc("mark_all_notifications_read");
      if (error) toast.error("Could not mark all as read");
    });
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 rounded-xl flex items-center justify-center text-[#27324A] hover:bg-[#27324A]/5 transition"
        aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-[#A7653A] text-white text-[10px] font-black flex items-center justify-center">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl border border-[#2E3344]/10 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#2E3344]/8 bg-[#f8f8f7]/50">
            <p className="text-xs font-black uppercase tracking-widest text-[#27324A]">
              Notifications
            </p>
            <div className="flex items-center gap-2">
              {unread.length > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={isPending}
                  className="text-[10px] font-bold text-[#A7653A] hover:underline disabled:opacity-50 flex items-center gap-1"
                >
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="h-6 w-6 rounded-lg hover:bg-[#27324A]/5 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5 text-[#746E73]" />
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-[#746E73] opacity-30 mx-auto mb-2" />
                <p className="text-xs text-[#746E73] font-bold">
                  No notifications yet.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#2E3344]/5">
                {items.map((n) => (
                  <li key={n.id}>
                    <NotificationRow
                      n={n}
                      onMarkRead={() => markOneRead(n.id)}
                      onNavigate={() => {
                        setOpen(false);
                        if (!n.read_at) void markOneRead(n.id);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  n,
  onMarkRead,
  onNavigate,
}: {
  n: Notification;
  onMarkRead: () => void;
  onNavigate: () => void;
}) {
  const inner = (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition ${!n.read_at ? "bg-[#F7F0E6]/40" : "hover:bg-[#f8f8f7]/50"}`}
    >
      <span
        className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!n.read_at ? "bg-[#A7653A]" : "bg-[#27324A]/20"}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#27324A]">{n.title}</p>
        {n.body && (
          <p className="text-xs text-[#746E73] mt-0.5 line-clamp-2">{n.body}</p>
        )}
        <p className="text-[10px] text-[#a4a09a] mt-1">
          {timeAgo(n.created_at)} ago
        </p>
      </div>
      {!n.read_at && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onMarkRead();
          }}
          className="text-[10px] font-bold text-[#A7653A] hover:underline shrink-0"
        >
          Read
        </button>
      )}
    </div>
  );

  if (n.link_url) {
    return (
      <Link href={n.link_url} onClick={onNavigate} className="block">
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onNavigate}
      className="block w-full text-left"
    >
      {inner}
    </button>
  );
}
