/**
 * eSewa ePay v2 provider.
 *
 * Flow:
 *   1. Server builds a form-POST to ESEWA_FORM_URL with signed_field_names
 *      and a Base64(HMAC-SHA256(secret, "key=val,key=val,key=val")) signature.
 *   2. Customer is redirected to eSewa, completes payment.
 *   3. eSewa redirects back to our success_url with `?data=<base64-encoded-JSON>`.
 *      The decoded JSON contains: { transaction_code, status, total_amount,
 *      transaction_uuid, product_code, signed_field_names, signature }.
 *   4. We verify the returned signature, then call the transaction/status API
 *      to authoritatively confirm the payment server-side.
 */
import crypto from "node:crypto";
import type {
  InitiateContext, InitiateResult, VerifyContext, VerifyResult, PaymentSecrets,
} from "../types";

const ESEWA_ENDPOINTS = {
  sandbox: {
    form:   "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
    status: "https://rc.esewa.com.np/api/epay/transaction/status/",
  },
  production: {
    form:   "https://epay.esewa.com.np/api/epay/main/v2/form",
    status: "https://epay.esewa.com.np/api/epay/transaction/status/",
  },
};

function esewaSign(message: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(message);
  return hmac.digest("base64");
}

export async function initiateEsewa(
  ctx: InitiateContext,
  secrets: PaymentSecrets
): Promise<InitiateResult> {
  if (!secrets.esewa_merchant_code || !secrets.esewa_secret_key) {
    throw new Error("ESEWA_NOT_CONFIGURED");
  }

  const env = secrets.esewa_environment;
  const endpoint = ESEWA_ENDPOINTS[env].form;
  const totalAmount = ctx.amount.toFixed(2);
  const productCode = secrets.esewa_merchant_code;
  const transactionUuid = ctx.transactionReference;

  const signedFieldNames = "total_amount,transaction_uuid,product_code";
  const signatureSource =
    `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const signature = esewaSign(signatureSource, secrets.esewa_secret_key);

  const successUrl = `${ctx.baseUrl}/api/payments/esewa/callback` +
    `?payment_id=${encodeURIComponent(ctx.paymentId)}&result=success`;
  const failureUrl = `${ctx.baseUrl}/api/payments/esewa/callback` +
    `?payment_id=${encodeURIComponent(ctx.paymentId)}&result=failure`;

  return {
    redirectUrl: endpoint,
    redirectMethod: "POST",
    formFields: {
      amount: totalAmount,
      tax_amount: "0",
      total_amount: totalAmount,
      transaction_uuid: transactionUuid,
      product_code: productCode,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: successUrl,
      failure_url: failureUrl,
      signed_field_names: signedFieldNames,
      signature,
    },
    metadata: { environment: env, signed_fields: signedFieldNames },
  };
}

/** Decode the `data` query param eSewa appends to the success redirect. */
export function decodeEsewaCallback(rawData: string): Record<string, string> | null {
  try {
    const json = Buffer.from(rawData, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

export async function verifyEsewa(ctx: VerifyContext): Promise<VerifyResult> {
  const { secrets, gatewayPayload, transactionReference, amount } = ctx;
  if (!secrets.esewa_merchant_code || !secrets.esewa_secret_key) {
    return { ok: false, reason: "ESEWA_NOT_CONFIGURED" };
  }

  // 1. Decode `data` parameter from query string
  const rawData = gatewayPayload.data;
  if (!rawData) return { ok: false, reason: "MISSING_CALLBACK_DATA" };

  const decoded = decodeEsewaCallback(rawData);
  if (!decoded) return { ok: false, reason: "INVALID_CALLBACK_DATA" };

  if (decoded.status !== "COMPLETE") {
    return { ok: false, reason: `GATEWAY_STATUS:${decoded.status}`, rawResponse: decoded };
  }
  if (decoded.transaction_uuid !== transactionReference) {
    return { ok: false, reason: "TXN_REF_MISMATCH", rawResponse: decoded };
  }
  if (parseFloat(decoded.total_amount.replace(/,/g, "")) !== amount) {
    return { ok: false, reason: "AMOUNT_MISMATCH", rawResponse: decoded };
  }

  // 2. Verify signature
  const signedFields = (decoded.signed_field_names ?? "").split(",");
  const signatureSource = signedFields
    .map((f) => `${f}=${decoded[f] ?? ""}`)
    .join(",");
  const expectedSig = esewaSign(signatureSource, secrets.esewa_secret_key);
  if (expectedSig !== decoded.signature) {
    return { ok: false, reason: "SIGNATURE_MISMATCH", rawResponse: decoded };
  }

  // 3. Authoritative status check against eSewa
  const env = secrets.esewa_environment;
  const statusUrl = `${ESEWA_ENDPOINTS[env].status}` +
    `?product_code=${encodeURIComponent(secrets.esewa_merchant_code)}` +
    `&total_amount=${encodeURIComponent(amount.toFixed(2))}` +
    `&transaction_uuid=${encodeURIComponent(transactionReference)}`;

  try {
    const res = await fetch(statusUrl, { method: "GET" });
    const lookup = await res.json().catch(() => null);
    if (!res.ok || !lookup) {
      return { ok: false, reason: "STATUS_LOOKUP_FAILED", rawResponse: decoded };
    }
    if (lookup.status !== "COMPLETE") {
      return {
        ok: false,
        reason: `LOOKUP_STATUS:${lookup.status ?? "UNKNOWN"}`,
        rawResponse: { callback: decoded, lookup },
      };
    }
    return {
      ok: true,
      gatewayTransactionId: decoded.transaction_code ?? lookup.ref_id ?? null,
      rawResponse: { callback: decoded, lookup },
    };
  } catch {
    return { ok: false, reason: "STATUS_LOOKUP_NETWORK_ERROR", rawResponse: decoded };
  }
}
