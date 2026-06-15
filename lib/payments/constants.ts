export const PAYMENT_METHODS = [
  "cod",
  "esewa",
  "khalti",
  "bank_transfer",
  "qr_code",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "payment_initiated",
  "payment_failed",
  "payment_cancelled",
  "paid_pending_receipt_upload",
  "paid_pending_owner_confirmation",
  "bank_transfer_pending_verification",
  "qr_payment_pending_verification",
  "cod_pending",
  "payment_verified",
  "payment_rejected",
  "cod_paid",
  "refund_requested",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  esewa: "eSewa",
  khalti: "Khalti",
  bank_transfer: "Bank Transfer",
  qr_code: "QR Code",
};

export const PAYMENT_METHOD_DESCRIPTIONS: Record<PaymentMethod, string> = {
  cod: "Pay in cash when your order is delivered.",
  esewa:
    "Pay securely using eSewa. You'll be redirected to the official eSewa page.",
  khalti:
    "Pay securely using Khalti. You'll be redirected to the official Khalti page.",
  bank_transfer:
    "Transfer the amount to the shop's bank account and upload a receipt.",
  qr_code:
    "Scan the shop's QR code with any banking or wallet app and upload a receipt.",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  payment_initiated: "Awaiting payment",
  payment_failed: "Payment failed",
  payment_cancelled: "Payment cancelled",
  paid_pending_receipt_upload: "Paid — upload receipt",
  paid_pending_owner_confirmation: "Receipt submitted — awaiting verification",
  bank_transfer_pending_verification: "Bank transfer — awaiting verification",
  qr_payment_pending_verification: "QR payment — awaiting verification",
  cod_pending: "Cash on delivery",
  payment_verified: "Payment verified",
  payment_rejected: "Payment rejected",
  cod_paid: "Paid (COD collected)",
  refund_requested: "Refund requested",
  refunded: "Refunded",
};

export const TERMINAL_STATUSES: PaymentStatus[] = [
  "payment_verified",
  "cod_paid",
  "payment_rejected",
  "refunded",
];

export const AWAITING_OWNER_STATUSES: PaymentStatus[] = [
  "paid_pending_owner_confirmation",
  "bank_transfer_pending_verification",
  "qr_payment_pending_verification",
];

export const AWAITING_CUSTOMER_STATUSES: PaymentStatus[] = [
  "payment_initiated",
  "paid_pending_receipt_upload",
];

export function isOwnerActionable(status: PaymentStatus): boolean {
  return AWAITING_OWNER_STATUSES.includes(status);
}
