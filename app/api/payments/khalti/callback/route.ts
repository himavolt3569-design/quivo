/**
 * Khalti KPG-2 callback handler.
 *
 * Khalti redirects the customer back here with:
 *   ?payment_id=<our-uuid>&pidx=<khalti-pidx>&status=Completed|User canceled|...
 *
 * We never trust the `status` query param.  Instead we POST to the lookup
 * endpoint with the `pidx` and use that server-side response as the
 * authoritative source.  Amount, transaction_reference, and current payment
 * status are all cross-checked against our own DB row.
 *
 * Idempotency: re-hitting the same callback after success is a no-op (terminal
 * statuses short-circuit; conditional UPDATE prevents racing finalizations).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/security";
import { verifyKhalti } from "@/lib/payments/providers/khalti";
import type { PaymentSecrets } from "@/lib/payments";

const TERMINAL_STATUSES = new Set([
  "payment_verified", "cod_paid", "refunded", "payment_rejected",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PIDX_RE = /^[A-Za-z0-9_-]{4,128}$/;

interface PaymentRow {
  id: string;
  order_id: string;
  shop_id: string;
  amount: number;
  payment_status: string;
  transaction_reference: string;
  gateway_transaction_id: string | null;
}

interface OrderRow {
  order_number: string;
  tracking_token: string;
}

function failureRedirect(origin: string, orderNumber: string | null, trackingToken: string | null, reason: string) {
  const target = orderNumber && trackingToken
    ? `${origin}/order/${orderNumber}?t=${trackingToken}&payment=failed&reason=${encodeURIComponent(reason)}`
    : `${origin}/?payment=failed&reason=${encodeURIComponent(reason)}`;
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getSiteUrl();
  const paymentId = searchParams.get("payment_id");
  const pidx      = searchParams.get("pidx");
  const status    = searchParams.get("status");

  if (!paymentId || !UUID_RE.test(paymentId)) {
    return NextResponse.redirect(`${origin}/?payment=failed&reason=missing_payment_id`);
  }

  const admin = createAdminClient();

  const { data: payment, error: payErr } = await admin
    .from("payments")
    .select("id, order_id, shop_id, amount, payment_status, transaction_reference, gateway_transaction_id")
    .eq("id", paymentId)
    .maybeSingle<PaymentRow>();

  if (payErr || !payment) {
    return NextResponse.redirect(`${origin}/?payment=failed&reason=payment_not_found`);
  }

  const { data: order } = await admin
    .from("orders")
    .select("order_number, tracking_token")
    .eq("id", payment.order_id)
    .maybeSingle<OrderRow>();
  const orderNumber = order?.order_number ?? null;
  const trackingToken = order?.tracking_token ?? null;
  const orderPath = orderNumber && trackingToken
    ? `/order/${orderNumber}?t=${trackingToken}`
    : "/";

  // Idempotent — already terminal.
  if (TERMINAL_STATUSES.has(payment.payment_status)) {
    return NextResponse.redirect(`${origin}${orderPath}`);
  }

  if (!pidx || !PIDX_RE.test(pidx)) {
    await admin.from("payment_audit_logs").insert({
      payment_id: payment.id, order_id: payment.order_id, shop_id: payment.shop_id,
      action: "callback_ignored", actor_type: "gateway",
      from_status: payment.payment_status, to_status: payment.payment_status,
      metadata: { status, reason: pidx ? "invalid_pidx" : "missing_pidx" },
    });
    return failureRedirect(origin, orderNumber, trackingToken, pidx ? "invalid_pidx" : "missing_pidx");
  }

  if (payment.gateway_transaction_id && payment.gateway_transaction_id !== pidx) {
    await admin.from("payment_audit_logs").insert({
      payment_id: payment.id, order_id: payment.order_id, shop_id: payment.shop_id,
      action: "callback_ignored", actor_type: "gateway",
      from_status: payment.payment_status, to_status: payment.payment_status,
      metadata: { status, reason: "pidx_mismatch", pidx },
    });
    return failureRedirect(origin, orderNumber, trackingToken, "pidx_mismatch");
  }

  const { data: secrets, error: secretsErr } = await admin
    .rpc("get_shop_payment_secrets", { p_shop_id: payment.shop_id })
    .single<PaymentSecrets>();
  if (secretsErr || !secrets) {
    return failureRedirect(origin, orderNumber, trackingToken, "config_missing");
  }

  const verifyResult = await verifyKhalti({
    paymentId: payment.id,
    shopId: payment.shop_id,
    transactionReference: payment.transaction_reference,
    amount: Number(payment.amount),
    gatewayPayload: {
      pidx,
      status: status ?? "",
      expected_pidx: payment.gateway_transaction_id ?? "",
    },
    secrets,
  });

  if (!verifyResult.ok) {
    await admin.from("payment_audit_logs").insert({
      payment_id: payment.id, order_id: payment.order_id, shop_id: payment.shop_id,
      action: "verification_failed", actor_type: "gateway",
      from_status: payment.payment_status, to_status: payment.payment_status,
      metadata: { reason: verifyResult.reason ?? "verification_failed", pidx, status },
    });
    return failureRedirect(origin, orderNumber, trackingToken, verifyResult.reason ?? "verification_failed");
  }

  const { data: updated, error: updErr } = await admin
    .from("payments")
    .update({
      payment_status: "payment_verified",
      gateway_transaction_id: verifyResult.gatewayTransactionId ?? pidx,
      gateway_response: verifyResult.rawResponse ?? null,
      verified_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .not("payment_status", "in", "(payment_verified,cod_paid,refunded,payment_rejected)")
    .select("id")
    .maybeSingle();

  if (updErr) {
    return failureRedirect(origin, orderNumber, trackingToken, "db_update_failed");
  }

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
      payment_id: payment.id, order_id: payment.order_id, shop_id: payment.shop_id,
      action: "verified", actor_type: "gateway",
      from_status: payment.payment_status, to_status: "payment_verified",
      metadata: { pidx, gateway_transaction_id: verifyResult.gatewayTransactionId },
    });
  }

  const successPath = orderNumber && trackingToken
    ? `/order/${orderNumber}?t=${trackingToken}&payment=success`
    : "/";
  return NextResponse.redirect(`${origin}${successPath}`);
}
