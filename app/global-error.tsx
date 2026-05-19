"use client";

import { useEffect } from "react";
import { log } from "@/lib/log";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    log.fatal(error.message, { err: error, digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#F7F0E6",
            color: "#27324A",
            fontFamily:
              "Poppins, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "448px",
              borderRadius: "24px",
              border: "1px solid rgba(46, 51, 68, 0.1)",
              background: "#ffffff",
              padding: "32px",
              textAlign: "center",
              boxShadow: "0 1px 8px rgba(39, 50, 74, 0.08)",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>Application error</h1>
            <p style={{ margin: "12px 0 0", color: "#746E73", fontSize: "14px", lineHeight: 1.6 }}>
              Quivo could not render this page. Retry the request after the app refreshes.
            </p>
            {error.digest && (
              <p
                style={{
                  margin: "16px 0 0",
                  borderRadius: "12px",
                  background: "#f8f8f7",
                  padding: "10px 12px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "11px",
                  color: "#746E73",
                }}
              >
                {error.digest}
              </p>
            )}
            <button
              onClick={() => unstable_retry()}
              style={{
                marginTop: "24px",
                height: "44px",
                width: "100%",
                border: 0,
                borderRadius: "12px",
                background: "#27324A",
                color: "#ffffff",
                fontWeight: 800,
              }}
            >
              Retry
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
