import type { PaymentMethod, PaymentStatus } from "./constants";

export type { PaymentMethod, PaymentStatus };

export interface PaymentSecrets {
  esewa_merchant_code: string | null;
  esewa_secret_key: string | null;
  esewa_environment: "sandbox" | "production";
  khalti_public_key: string | null;
  khalti_secret_key: string | null;
  khalti_environment: "sandbox" | "production";
}

export interface PublicPaymentMethods {
  enabled_methods: PaymentMethod[];
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  bank_swift_code: string | null;
  qr_code_url: string | null;
  payment_instructions: string | null;
  has_esewa: boolean;
  has_khalti: boolean;
}

export interface OwnerPaymentConfig {
  enabled_methods: PaymentMethod[];
  esewa_merchant_code: string | null;
  esewa_environment: "sandbox" | "production";
  has_esewa_secret: boolean;
  khalti_public_key: string | null;
  khalti_environment: "sandbox" | "production";
  has_khalti_secret: boolean;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  bank_swift_code: string | null;
  qr_code_url: string | null;
  payment_instructions: string | null;
}

export interface InitiateContext {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  shopId: string;
  shopName: string;
  amount: number; // NPR, decimal allowed (e.g. 1250.00)
  transactionReference: string;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  baseUrl: string; // origin, e.g. https://example.com
}

export interface InitiateResult {
  /** Redirect URL or HTML form-post target. Empty for offline methods (COD/bank/QR). */
  redirectUrl?: string;
  /** Optional form fields if redirectUrl is a POST endpoint. */
  formFields?: Record<string, string>;
  /** Optional method for the redirect ("GET" or "POST"). Default "GET". */
  redirectMethod?: "GET" | "POST";
  /** Gateway-issued reference for later lookup (e.g. Khalti pidx). */
  gatewayReference?: string;
  /** Server-side metadata to attach to the payment row. */
  metadata?: Record<string, unknown>;
}

export interface VerifyContext {
  paymentId: string;
  shopId: string;
  transactionReference: string;
  amount: number;
  /** Raw query/body from the gateway redirect/callback. */
  gatewayPayload: Record<string, string>;
  secrets: PaymentSecrets;
}

export interface VerifyResult {
  ok: boolean;
  gatewayTransactionId?: string;
  reason?: string;
  rawResponse?: Record<string, unknown>;
}

export interface Payment {
  id: string;
  order_id: string;
  shop_id: string;
  customer_id: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount: number;
  currency: string;
  transaction_reference: string;
  gateway_transaction_id: string | null;
  gateway_response: Record<string, unknown> | null;
  receipt_url: string | null;
  receipt_uploaded_at: string | null;
  verified_by_owner: string | null;
  verified_at: string | null;
  rejected_reason: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWithPayment {
  order_id: string;
  order_number: string;
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  status: string;
  total_amount: number;
  items: Array<{
    id?: string;
    name: string;
    price: number;
    qty: number;
    image?: string | null;
  }>;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_id: string | null;
  receipt_url: string | null;
  rejected_reason: string | null;
  created_at: string;
}
