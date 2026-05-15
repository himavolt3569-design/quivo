/**
 * eSewa ePay v2 callback handler.
 *
 * eSewa redirects the customer back here after payment with either:
 *   - success: ?payment_id=<uuid>&result=success&data=<base64-JSON>
 *   - failure: ?payment_id=<uuid>&result=failure
 *
 * Steps (always run server-side):
 *   1. Look up the payment row by our own payment_id (UUID).  This guarantees
 *      the caller didn't trick us into operating on someone else's payment.
 *   2. If the payment is already in a terminal state, no-op and redirect.
 *   3. Otherwise, call verifyEsewa() — which decodes `data`, validates
 *      signature, then hits eSewa's status API for authoritative confirmation.
 *   4. Update the payment + order rows + insert an audit log, all via the
 *      service-role admin client (route handlers run anonymously).
 *   5. Redirect the customer to /order/{order_number}.
 *
 * Idempotency: re-hitting the same callback URL after success is a no-op.
 * Amount and transaction_reference are re-checked against what's in our DB
 * — if anything diverges, we mark the payment as failed instead of verified.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyEsewa } from "@/lib/payments/providers/esewa";
import type { PaymentSecrets } from "@/lib/payments";

const TERMINAL_STATUSES = new Set([
  "payment_verified", "cod_paid", "refunded", "payment_rejected",
]);

interface PaymentRow {
  id: string;
  order_id: string;
  shop_id: string;
  amount: number;
  payment_status: string;
  transaction_reference: string;
}

interface OrderRow {
  order_number: string;
}

function failureRedirect(origin: string, orderNumber: string | null, reason: string) {
  const target = orderNumber
    ? `${origin}/order/${orderNumber}?payment=failed&reason=${encodeURIComponent(reason)}`
    : `${origin}/?payment=failed&reason=${encodeURIComponent(reason)}`;
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const paymentId = searchParams.get("payment_id");
  const result    = searchParams.get("result");
  const data      = searchParams.get("data");

  if (!paymentId) {
    return NextResponse.redirect(`${origin}/?payment=failed&reason=missing_payment_id`);
  }

  const admin = createAdminClient();

  const { data: payment, error: payErr } = await admin
    .from("payments")
    .select("id, order_id, shop_id, amount, payment_status, transaction_reference")
    .eq("id", paymentId)
    .maybeSingle<PaymentRow>();

  if (payErr || !payment) {
    return NextResponse.redirect(`${origin}/?payment=failed&reason=payment_not_found`);
  }

  const { data: order } = await admin
    .from("orders")
    .select("order_number")
    .eq("id", payment.order_id)
    .maybeSingle<OrderRow>();
  const orderNumber = order?.order_number ?? null;

  // Idempotent: already terminal → just bounce to tracking page.
  if (TERMINAL_STATUSES.has(payment.payment_status)) {
    return NextResponse.redirect(`${origin}/order/${orderNumber ?? ""}`);
  }

  // Customer cancelled / eSewa reported failure.
  if (result === "failure" || !data) {
    await admin
      .from("payments")
      .update({
        payment_status: "payment_failed",
        gateway_response: { result: result ?? "missing_data" },
      })
      .eq("id", payment.id);
    await admin.from("orders").update({ payment_status: "payment_failed" }).eq("id", payment.order_id);
    await admin.from("payment_audit_logs").insert({
      payment_id: payment.id, shop_id: payment.shop_id,
      action: "failed", actor_type: "gateway",
      from_status: payment.payment_status, to_status: "payment_failed",
      metadata: { result, reason: "no_data_or_failure" },
    });
    return failureRedirect(origin, orderNumber, "gateway_failure");
  }

  // Pull the shop's secrets via service-role.
  const { data: secrets, error: secretsErr } = await admin
    .rpc("get_shop_payment_secrets", { p_shop_id: payment.shop_id })
    .single<PaymentSecrets>();
  if (secretsErr || !secrets) {
    return failureRedirect(origin, orderNumber, "config_missing");
  }

  const verifyResult = await verifyEsewa({
    paymentId: payment.id,
    shopId: payment.shop_id,
    transactionReference: payment.transaction_reference,
    amount: Number(payment.amount),
    gatewayPayload: { data },
    secrets,
  });

  if (!verifyResult.ok) {
    await admin
      .from("payments")
      .update({
        payment_status: "payment_failed",
        gateway_response: verifyResult.rawResponse ?? { reason: verifyResult.reason },
      })
      .eq("id", payment.id)
      .eq("payment_status", payment.payment_status); // optimistic concurrency
    await admin.from("orders").update({ payment_status: "payment_failed" }).eq("id", payment.order_id);
    await admin.from("payment_audit_logs").insert({
      payment_id: payment.id, shop_id: payment.shop_id,
      action: "failed", actor_type: "gateway",
      from_status: payment.payment_status, to_status: "payment_failed",
      metadata: { reason: verifyResult.reason ?? "verification_failed" },
    });
    return failureRedirect(origin, orderNumber, verifyResult.reason ?? "verification_failed");
  }

  // Verified — transition to payment_verified.  Conditional UPDATE on
  // payment_status prevents a racing duplicate callback from double-applying.
  const { data: updated, error: updErr } = await admin
    .from("payments")
    .update({
      payment_status: "payment_verified",
      gateway_transaction_id: verifyResult.gatewayTransactionId ?? null,
      gateway_response: verifyResult.rawResponse ?? null,
      verified_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .not("payment_status", "in", "(payment_verified,cod_paid,refunded)")
    .select("id")
    .maybeSingle();

  if (updErr) {
    return failureRedirect(origin, orderNumber, "db_update_failed");
  }

  // updated === null means another concurrent callback already finalized this
  // payment — that's fine, treat as success.
  if (updated) {
    await admin
      .from("orders")
      .update({
        payment_status: "payment_verified",
        status: "confirmed",
      })
      .eq("id", payment.order_id)
      .eq("status", "placed");

    await admin.from("payment_audit_logs").insert({
      payment_id: payment.id, shop_id: payment.shop_id,
      action: "verified", actor_type: "gateway",
      from_status: payment.payment_status, to_status: "payment_verified",
      metadata: { gateway_transaction_id: verifyResult.gatewayTransactionId },
    });
  }

  return NextResponse.redirect(`${origin}/order/${orderNumber ?? ""}?payment=success`);
}

// eSewa sometimes uses POST to the success_url with `data` in the body.
export async function POST(request: Request) {
  let dataField: string | null = null;
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    dataField = form?.get("data")?.toString() ?? null;
  } else if (ct.includes("application/json")) {
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && typeof body.data === "string") dataField = body.data;
  }

  const url = new URL(request.url);
  if (dataField && !url.searchParams.get("data")) {
    url.searchParams.set("data", dataField);
  }
  return GET(new Request(url.toString(), { method: "GET" }));
}
