import "server-only";

import { log } from "@/lib/log";

/**
 * Generic transactional email sender (Resend).
 *
 * Pass either `html` (the canonical interface used by every template module)
 * or a React element via `react` — the latter is resolved lazily through
 * `@react-email/render` if the dep is installed. If `RESEND_API_KEY` is
 * absent (dev/CI) we log the would-be send and return a `skipped` result;
 * callers must not branch on errors in the dev path.
 *
 * Wrap every domain email (KYC, order confirmation, low-stock digest…)
 * around this. Never call the Resend HTTP API directly elsewhere.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  /**
   * Optional React element — rendered to HTML via @react-email/render at call
   * time. Resolved with a dynamic import so the dep is not required.
   */
  react?: unknown;
  from?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; error: string; status?: number };

function defaultFrom(): string {
  return (
    process.env.EMAIL_FROM ??
    process.env.KYC_EMAIL_FROM ??
    "Quivo <onboarding@quivo.app>"
  );
}

async function renderReactToHtml(element: unknown): Promise<string> {
  try {
    // String variable hides the module from static analysis so the dep stays
    // truly optional. Templates that bring their own HTML skip this path.
    const moduleName = "@react-email/render";
    const dyn = Function("m", "return import(m)") as (
      m: string,
    ) => Promise<unknown>;
    const mod = (await dyn(moduleName).catch(() => null)) as {
      render: (
        el: unknown,
        opts?: { pretty?: boolean },
      ) => Promise<string> | string;
    } | null;
    if (!mod) {
      throw new Error("@react-email/render is not installed");
    }
    return await Promise.resolve(mod.render(element, { pretty: false }));
  } catch (err) {
    throw new Error(
      `Failed to render React email: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function toArray(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = input.from ?? defaultFrom();
  const to = toArray(input.to);

  if (!to || to.length === 0) {
    return { ok: false, error: "sendEmail: missing recipient" };
  }

  let html = input.html;
  if (!html && input.react !== undefined) {
    try {
      html = await renderReactToHtml(input.react);
    } catch (err) {
      log.error("sendEmail: react render failed", {
        err: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, error: "Failed to render email body" };
    }
  }
  if (!html && !input.text) {
    return {
      ok: false,
      error: "sendEmail: at least one of html/text/react is required",
    };
  }

  if (!apiKey) {
    log.info("sendEmail skipped: RESEND_API_KEY not configured", {
      to,
      subject: input.subject,
      from,
    });
    return {
      ok: false,
      skipped: true,
      reason: "RESEND_API_KEY not configured",
    };
  }

  const payload: Record<string, unknown> = {
    from,
    to,
    subject: input.subject,
    html,
    text: input.text,
  };
  const replyTo = toArray(input.replyTo);
  if (replyTo) payload.reply_to = replyTo;
  const cc = toArray(input.cc);
  if (cc) payload.cc = cc;
  const bcc = toArray(input.bcc);
  if (bcc) payload.bcc = bcc;
  if (input.tags && input.tags.length > 0) payload.tags = input.tags;
  if (input.headers) payload.headers = input.headers;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      log.error("sendEmail: provider rejected", {
        status: response.status,
        body,
        subject: input.subject,
      });
      return {
        ok: false,
        status: response.status,
        error: body || `Provider returned ${response.status}`,
      };
    }

    const data = (await response.json().catch(() => null)) as {
      id?: string;
    } | null;
    log.info("sendEmail delivered", {
      subject: input.subject,
      to,
      providerId: data?.id,
    });
    return { ok: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("sendEmail: network error", {
      error: message,
      subject: input.subject,
    });
    return { ok: false, error: message };
  }
}
