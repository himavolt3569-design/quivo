"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  CloudOff,
  Cloud,
  RefreshCcw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { completePOSSale } from "@/app/actions/owner";
import {
  list as listQueue,
  replayQueue,
  onQueueChanged,
  notifyQueueChanged,
  type QueuedSale,
} from "@/lib/offline/pos-queue";

/**
 * Mounted by POSView. Watches `online` / `offline` events, shows the queue
 * size, and offers a manual "Sync now" trigger. On reconnect we auto-flush.
 */
export function OfflineSync() {
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [open, setOpen] = useState(false);
  const [syncing, startSync] = useTransition();
  const flushRef = useRef<() => void>(() => {});

  const flush = useCallback(() => {
    startSync(async () => {
      const res = await replayQueue(async (input) => {
        const r = await completePOSSale(input);
        return { success: r.success ? true : undefined, error: r.error };
      });
      notifyQueueChanged();
      setQueue(await listQueue());
      if (res.flushed > 0)
        toast.success(
          `Synced ${res.flushed} queued sale${res.flushed === 1 ? "" : "s"}`,
        );
      if (res.failed > 0)
        toast.error(
          `${res.failed} sale${res.failed === 1 ? "" : "s"} could not be replayed; check the sync tray.`,
        );
    });
  }, []);

  // Keep the latest flush in a ref so the always-installed listener can call
  // it without re-binding when flush's identity changes.
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Browser online state + queue subscription.
  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnline(false);
    }

    const onOnline = () => {
      setOnline(true);
      flushRef.current?.();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const refresh = async () => setQueue(await listQueue());
    const unsub = onQueueChanged(refresh);
    void refresh();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsub();
    };
  }, []);

  const queued = queue.length;
  const failed = queue.filter((q) => (q.lastError ?? "").length > 0).length;

  if (online && queued === 0) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-6 left-4 z-40">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`h-11 px-4 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg transition ${
          !online
            ? "bg-amber-500 hover:bg-amber-600 text-white"
            : failed > 0
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-[#27324A] hover:bg-[#1b2333] text-white"
        }`}
      >
        {!online ? (
          <CloudOff className="h-4 w-4" />
        ) : (
          <Cloud className="h-4 w-4" />
        )}
        {!online ? "Offline" : "Online"}
        {queued > 0 && (
          <span className="bg-white/20 text-white text-[11px] font-black rounded-full px-2 py-0.5">
            {queued}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-14 left-0 w-80 bg-white rounded-2xl border border-[#2E3344]/10 shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-[#2E3344]/8 flex items-center gap-2">
            <p className="text-xs font-black uppercase tracking-widest text-[#27324A]">
              Offline sync
            </p>
            <span className="ml-auto text-[11px] text-[#746E73] font-bold">
              {queued} pending · {failed} errors
            </span>
          </div>
          <div className="p-4 max-h-72 overflow-y-auto space-y-2">
            {queue.length === 0 ? (
              <p className="text-xs text-[#746E73] font-bold">
                No queued sales.
              </p>
            ) : (
              queue.map((q) => (
                <div
                  key={q.id}
                  className={`p-3 rounded-xl text-xs ${q.lastError ? "bg-red-50 border border-red-200" : "bg-[#f8f8f7]"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#27324A]">
                      Rs. {q.input.total.toFixed(2)} · {q.input.items.length}{" "}
                      item{q.input.items.length === 1 ? "" : "s"}
                    </span>
                    <span className="text-[10px] text-[#746E73]">
                      {new Date(q.queuedAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {q.lastError && (
                    <p className="mt-1 text-[11px] text-red-700 flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                      {q.lastError}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-[#2E3344]/8 flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 h-10 rounded-xl border border-[#2E3344]/10 text-[#27324A] font-bold text-xs"
            >
              Close
            </button>
            <button
              onClick={flush}
              disabled={syncing || !online || queue.length === 0}
              className="flex-1 h-10 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-40"
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="h-3.5 w-3.5" />
              )}
              Sync now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
