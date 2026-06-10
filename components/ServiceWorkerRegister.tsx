"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js once on mount. Kept tiny so it lives inside the root
 * layout and runs on every page. Production-only: in development the SW
 * caches aggressively and breaks the dev experience.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // When a new worker is waiting, prompt activation on the next user gesture.
        if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              installing.postMessage("SKIP_WAITING");
            }
          });
        });
      } catch {
        // Silent — SW is a progressive enhancement.
      }
    };

    // Wait for load so the SW install doesn't compete with first paint.
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
