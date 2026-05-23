"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, BellOff, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * One-tap toggle that opts the current device into push notifications.
 *
 * Requires:
 *   - browser support (Notification API + Service Worker + PushManager)
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY in env at build time
 *   - the service worker (public/sw.js) registered (handled by ServiceWorkerRegister)
 *
 * If any prerequisite is missing, the button renders a disabled hint
 * explaining why so operators can debug without console-spelunking.
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const padded = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

interface State {
  supported: boolean;
  permission: NotificationPermission | "unknown";
  subscribed: boolean;
  endpoint?: string;
  reason?: string;
}

export function PushSubscribeButton() {
  const [state, setState] = useState<State>({
    supported: false,
    permission: "unknown",
    subscribed: false,
  });
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setState((s) => ({ ...s, supported: false, reason: "Browser doesn't support web push." }));
        return;
      }
      if (!VAPID_PUBLIC) {
        if (!cancelled) setState((s) => ({ ...s, supported: false, reason: "Operator hasn't set NEXT_PUBLIC_VAPID_PUBLIC_KEY." }));
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setState({
          supported: true,
          permission: Notification.permission,
          subscribed: !!existing,
          endpoint: existing?.endpoint,
        });
      } catch (err) {
        if (!cancelled) setState((s) => ({
          ...s,
          supported: false,
          reason: err instanceof Error ? err.message : "Service worker not ready.",
        }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const enable = () => {
    startBusy(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Permission denied for notifications.");
          setState((s) => ({ ...s, permission }));
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as unknown as BufferSource,
        });
        const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        setState({ supported: true, permission: "granted", subscribed: true, endpoint: sub.endpoint });
        toast.success("Push notifications enabled for this device.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not enable push.");
      }
    });
  };

  const disable = () => {
    startBusy(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          setState((s) => ({ ...s, subscribed: false, endpoint: undefined }));
          return;
        }
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, { method: "DELETE" });
        setState({ supported: true, permission: Notification.permission, subscribed: false });
        toast.success("Push notifications disabled on this device.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not disable push.");
      }
    });
  };

  if (!state.supported) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs">
        <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-amber-900">Push notifications unavailable on this device</p>
          <p className="text-amber-800 mt-1">{state.reason ?? "—"}</p>
        </div>
      </div>
    );
  }

  if (state.subscribed) {
    return (
      <button
        type="button"
        onClick={disable}
        disabled={busy}
        className="h-11 px-4 rounded-xl border border-[#27324A]/15 text-[#27324A] font-bold text-sm flex items-center gap-2 hover:bg-[#f8f8f7] disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
        Disable push on this device
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={enable}
      disabled={busy}
      className="h-11 px-4 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
      Enable push notifications
    </button>
  );
}
