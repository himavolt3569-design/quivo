/**
 * Payment provider dispatcher.
 *
 * Each provider implements the same shape (initiate / verify) so the rest of
 * the application can stay agnostic of the specific gateway.
 *
 * Currently supported providers:
 *   - cod, bank_transfer, qr_code  →  no gateway (manual verification)
 *   - esewa                        →  eSewa ePay v2
 *   - khalti                       →  Khalti KPG-2
 *
 * To add a new provider:
 *   1. Implement initiate() and (optionally) verify() in lib/payments/providers/X.ts
 *   2. Register it in the switch statements below.
 */
import type {
  InitiateContext, InitiateResult, VerifyContext, VerifyResult, PaymentMethod,
} from "./types";
import { initiateEsewa, verifyEsewa } from "./providers/esewa";
import { initiateKhalti, verifyKhalti } from "./providers/khalti";
import { initiateCod, initiateBankTransfer, initiateQrCode } from "./providers/offline";

export async function initiatePaymentProvider(
  method: PaymentMethod,
  ctx: InitiateContext,
  secrets: Parameters<typeof initiateEsewa>[1]
): Promise<InitiateResult> {
  switch (method) {
    case "esewa":         return initiateEsewa(ctx, secrets);
    case "khalti":        return initiateKhalti(ctx, secrets);
    case "cod":           return initiateCod(ctx);
    case "bank_transfer": return initiateBankTransfer(ctx);
    case "qr_code":       return initiateQrCode(ctx);
    default:
      throw new Error(`UNSUPPORTED_PAYMENT_METHOD:${method}`);
  }
}

export async function verifyGatewayPayment(
  method: PaymentMethod,
  ctx: VerifyContext
): Promise<VerifyResult> {
  switch (method) {
    case "esewa":  return verifyEsewa(ctx);
    case "khalti": return verifyKhalti(ctx);
    default:
      return { ok: false, reason: "VERIFY_NOT_APPLICABLE" };
  }
}

export * from "./types";
export * from "./constants";
