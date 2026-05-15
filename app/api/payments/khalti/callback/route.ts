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
import { verifyKhalti } from "@/lib/payments/providers/khalti";
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
  const pidx      = searchParams.get("pidx");
  const status    = searchParams.get("status");

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

  // Idempotent — already terminal.
  if (TERMINAL_STATUSES.has(payment.payment_status)) {
    return NextResponse.redirect(`${origin}/order/${orderNumber ?? ""}`);
  }

  if (!pidx) {
    await admin
      .from("payments")
      .update({
        payment_status: "payment_failed",
        gateway_response: { status, reason: "missing_pidx" },
      })
      .eq("id", payment.id);
    await admin.from("orders").update({ payment_status: "payment_failed" }).eq("id", payment.order_id);
    await admin.from("payment_audit_logs").insert({
      payment_id: payment.id, shop_id: payment.shop_id,
      action: "failed", actor_type: "gateway",
      from_status: payment.payment_status, to_status: "payment_failed",
      metadata: { status, reason: "missing_pidx" },
    });
    return failureRedirect(origin, orderNumber, "missing_pidx");
  }

  const { data: secrets, error: secretsErr } = await admin
    .rpc("get_shop_payment_secrets", { p_shop_id: payment.shop_id })
    .single<PaymentSecrets>();
  if (secretsErr || !secrets) {
    return failureRedirect(origin, orderNumber, "config_missing");
  }

  const verifyResult = await verifyKhalti({
    paymentId: payment.id,
    shopId: payment.shop_id,
    transactionReference: payment.transaction_reference,
    amount: Number(payment.amount),
    gatewayPayload: { pidx, status: status ?? "" },
    secrets,
  });

  if (!verifyResult.ok) {
    await admin
      .from("payments")
      .update({
        payment_status: "payment_failed",
        gateway_transaction_id: pidx,
        gateway_response: verifyResult.rawResponse ?? { reason: verifyResult.reason },
      })
      .eq("id", payment.id)
      .eq("payment_status", payment.payment_status);
    await admin.from("orders").update({ payment_status: "payment_failed" }).eq("id", payment.order_id);
    await admin.from("payment_audit_logs").insert({
      payment_id: payment.id, shop_id: payment.shop_id,
      action: "failed", actor_type: "gateway",
      from_status: payment.payment_status, to_status: "payment_failed",
      metadata: { reason: verifyResult.reason ?? "verification_failed", pidx, status },
    });
    return failureRedirect(origin, orderNumber, verifyResult.reason ?? "verification_failed");
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
    .not("payment_status", "in", "(payment_verified,cod_paid,refunded)")
    .select("id")
    .maybeSingle();

  if (updErr) {
    return failureRedirect(origin, orderNumber, "db_update_failed");
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
      payment_id: payment.id, shop_id: payment.shop_id,
      action: "verified", actor_type: "gateway",
      from_status: payment.payment_status, to_status: "payment_verified",
      metadata: { pidx, gateway_transaction_id: verifyResult.gatewayTransactionId },
    });
  }

  return NextResponse.redirect(`${origin}/order/${orderNumber ?? ""}?payment=success`);
}
