export const AUTH_ERROR_CODES = {
  MISSING_PROFILE: "missing_profile",
  ROLE_CONFLICT: "role_conflict",
  DUPLICATE_EMAIL: "duplicate_email",
  EXCHANGE_FAILED: "exchange_failed",
  RATE_LIMITED: "rate_limited",
  ACCOUNT_REVOKED: "account_revoked",
} as const;

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

const ALL_CODES: readonly string[] = Object.values(AUTH_ERROR_CODES);

export function isAuthErrorCode(value: string | null): value is AuthErrorCode {
  return value !== null && ALL_CODES.includes(value);
}

export interface AuthErrorDisplay {
  title: string;
  description?: string;
}

export const AUTH_ERROR_MESSAGES: Record<
  AuthErrorCode,
  (params: URLSearchParams) => AuthErrorDisplay
> = {
  missing_profile: () => ({
    title: "Profile synchronization issue detected.",
    description: "We're attempting to fix your account. Please try logging out and back in.",
  }),
  role_conflict: (params) => {
    const actual = params.get("actual");
    if (actual === "customer") {
      return {
        title: "This email is already registered as a customer.",
        description: "Please use the email login below — Google sign-in is for shop owners only.",
      };
    }
    return {
      title: "This email is already registered as a shop owner.",
      description: "Please use the owner login (Google or owner email).",
    };
  },
  duplicate_email: () => ({
    title: "An account with this email already exists.",
    description: "Please log in with your original sign-up method.",
  }),
  exchange_failed: () => ({
    title: "We could not complete sign-in.",
    description: "Please try again, or contact support if the issue persists.",
  }),
  rate_limited: () => ({
    title: "Too many sign-in attempts.",
    description: "Please wait a few minutes and try again.",
  }),
  account_revoked: () => ({
    title: "Your account is no longer active.",
    description: "If you believe this is a mistake, please contact support.",
  }),
};
