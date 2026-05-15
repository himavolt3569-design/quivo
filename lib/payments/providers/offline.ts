/**
 * Offline payment providers: COD, bank transfer, QR code.
 *
 * These have no gateway redirect. The order is created with an "awaiting"
 * payment status:
 *   - cod          → cod_pending          (verified physically on delivery)
 *   - bank_transfer→ bank_transfer_pending_verification  (receipt-driven)
 *   - qr_code      → qr_payment_pending_verification     (receipt-driven)
 *
 * The customer is redirected back to the order tracking page where they can
 * upload the payment receipt (for bank/QR) or simply view the order (for COD).
 */
import type { InitiateContext, InitiateResult } from "../types";

export async function initiateCod(ctx: InitiateContext): Promise<InitiateResult> {
  return {
    redirectUrl: `${ctx.baseUrl}/s/${ctx.shopName ? "" : ""}order/${ctx.orderNumber}`,
    redirectMethod: "GET",
    metadata: { method: "cod" },
  };
}

export async function initiateBankTransfer(ctx: InitiateContext): Promise<InitiateResult> {
  return {
    redirectUrl: `${ctx.baseUrl}/order/${ctx.orderNumber}`,
    redirectMethod: "GET",
    metadata: { method: "bank_transfer" },
  };
}

export async function initiateQrCode(ctx: InitiateContext): Promise<InitiateResult> {
  return {
    redirectUrl: `${ctx.baseUrl}/order/${ctx.orderNumber}`,
    redirectMethod: "GET",
    metadata: { method: "qr_code" },
  };
}
