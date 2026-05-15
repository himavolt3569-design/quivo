/**
 * Khalti KPG-2 (ePayment) provider.
 *
 * Flow:
 *   1. Server POSTs to /api/v2/epayment/initiate/ with Authorization: Key {SECRET}
 *      and { amount (paisa), purchase_order_id, return_url, ... }.
 *   2. Response includes a `pidx` (unique payment identifier) and `payment_url`.
 *   3. Customer is redirected to payment_url, completes payment.
 *   4. Khalti redirects back to return_url with ?pidx=...&status=...
 *   5. Server calls /api/v2/epayment/lookup/ with `pidx` to authoritatively
 *      confirm the payment status.
 *
 * Amount unit: Khalti uses PAISA (1 NPR = 100 paisa). Always integer.
 */
import type {
  InitiateContext, InitiateResult, VerifyContext, VerifyResult, PaymentSecrets,
} from "../types";

const KHALTI_ENDPOINTS = {
  sandbox: {
    initiate: "https://a.khalti.com/api/v2/epayment/initiate/",
    lookup:   "https://a.khalti.com/api/v2/epayment/lookup/",
  },
  production: {
    initiate: "https://khalti.com/api/v2/epayment/initiate/",
    lookup:   "https://khalti.com/api/v2/epayment/lookup/",
  },
};
const FETCH_TIMEOUT_MS = 10_000;
const PIDX_RE = /^[A-Za-z0-9_-]{4,128}$/;

function npRupeesToPaisa(amountNpr: number): number {
  return Math.round(amountNpr * 100);
}

export async function initiateKhalti(
  ctx: InitiateContext,
  secrets: PaymentSecrets
): Promise<InitiateResult> {
  if (!secrets.khalti_secret_key) {
    throw new Error("KHALTI_NOT_CONFIGURED");
  }
  const env = secrets.khalti_environment;
  const endpoint = KHALTI_ENDPOINTS[env].initiate;

  const returnUrl = `${ctx.baseUrl}/api/payments/khalti/callback` +
    `?payment_id=${encodeURIComponent(ctx.paymentId)}`;

  const body = {
    return_url: returnUrl,
    website_url: ctx.baseUrl,
    amount: npRupeesToPaisa(ctx.amount),
    purchase_order_id: ctx.transactionReference,
    purchase_order_name: `Order ${ctx.orderNumber} — ${ctx.shopName}`.slice(0, 64),
    customer_info: {
      name: ctx.customer.name || "Customer",
      email: ctx.customer.email ?? undefined,
      phone: ctx.customer.phone ?? undefined,
    },
  };

  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const res = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${secrets.khalti_secret_key}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.payment_url || !json?.pidx) {
    const detail = json?.detail ?? json?.error_key ?? JSON.stringify(json ?? {});
    throw new Error(`KHALTI_INITIATE_FAILED:${detail}`);
  }

  return {
    redirectUrl: json.payment_url,
    redirectMethod: "GET",
    gatewayReference: json.pidx,
    metadata: { environment: env, expires_at: json.expires_at ?? null },
  };
}

export async function verifyKhalti(ctx: VerifyContext): Promise<VerifyResult> {
  const { secrets, gatewayPayload, amount } = ctx;
  if (!secrets.khalti_secret_key) {
    return { ok: false, reason: "KHALTI_NOT_CONFIGURED" };
  }

  const pidx = gatewayPayload.pidx;
  if (!pidx) return { ok: false, reason: "MISSING_PIDX" };
  if (!PIDX_RE.test(pidx)) return { ok: false, reason: "INVALID_PIDX" };
  const expectedPidx = gatewayPayload.expected_pidx;
  if (expectedPidx && expectedPidx !== pidx) {
    return { ok: false, reason: "PIDX_MISMATCH" };
  }

  const env = secrets.khalti_environment;
  const endpoint = KHALTI_ENDPOINTS[env].lookup;

  try {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const res = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${secrets.khalti_secret_key}`,
      },
      body: JSON.stringify({ pidx }),
    });
    const lookup = await res.json().catch(() => null);
    if (!res.ok || !lookup) {
      return { ok: false, reason: "LOOKUP_FAILED", rawResponse: { lookup } };
    }

    if (lookup.status !== "Completed") {
      return {
        ok: false,
        reason: `GATEWAY_STATUS:${lookup.status ?? "UNKNOWN"}`,
        rawResponse: lookup,
      };
    }

    // Khalti returns total_amount in paisa.
    const lookupAmountNpr = (typeof lookup.total_amount === "number")
      ? lookup.total_amount / 100
      : NaN;
    if (Math.abs(lookupAmountNpr - amount) > 0.01) {
      return { ok: false, reason: "AMOUNT_MISMATCH", rawResponse: lookup };
    }
    if (lookup.purchase_order_id && lookup.purchase_order_id !== ctx.transactionReference) {
      return { ok: false, reason: "TXN_REF_MISMATCH", rawResponse: lookup };
    }

    return {
      ok: true,
      gatewayTransactionId: lookup.transaction_id ?? pidx,
      rawResponse: lookup,
    };
  } catch {
    return { ok: false, reason: "LOOKUP_NETWORK_ERROR" };
  }
}
