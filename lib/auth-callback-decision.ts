/**
 * Pure decision logic for the OAuth/email-verification callback.
 *
 * This module performs zero I/O. It takes a fully-resolved snapshot of the
 * relevant state and returns the routing decision. The callback route handler
 * is responsible for fetching the inputs (intent, existing profile, shop
 * count) and acting on the output (signOut, redirect, audit-log).
 *
 * Keeping the logic pure makes the security-critical decision matrix
 * straightforward to unit-test exhaustively without mocking Supabase.
 */

export type Role = "owner" | "customer";

export interface CallbackInput {
  /** Role declared by the entrypoint UI (`?intent=...`), or null if absent. */
  intent: Role | null;
  /** Existing `profiles.role` for this user, or null if no profile row yet. */
  existingProfileRole: Role | null;
  /** Whether the user has at least one active shop_member row. */
  hasShop: boolean;
  /**
   * A safe, pre-validated `?next=` path provided by the caller, or null.
   * If non-null and not equal to "/dashboard", it overrides role-based routing.
   */
  explicitNext: string | null;
  /**
   * Set to true when the callback attempted to create a new profile row and
   * Postgres returned a unique-violation (23505) — i.e. a different auth.users
   * row already owns this email. Treated as a duplicate-account event.
   */
  profileCreationConflict?: boolean;
}

export type CallbackOutcome =
  | {
      kind: "conflict";
      code: "role_conflict";
      actual: Role;
      attempted: Role;
    }
  | {
      kind: "duplicate";
      code: "duplicate_email";
    }
  | {
      kind: "redirect";
      target: string;
    };

const TARGETS = {
  customer: "/dashboard/home",
  ownerWithShop: "/dashboard/owner",
  ownerNoShop: "/onboarding/owner",
} as const;

export function decideCallbackOutcome(input: CallbackInput): CallbackOutcome {
  // (1) Duplicate-email guard: if profile creation hit a unique violation we
  // have a session for an auth.users row whose email is already claimed by
  // another user.id. Reject.
  if (input.profileCreationConflict) {
    return { kind: "duplicate", code: "duplicate_email" };
  }

  // (2) Role-mismatch guard: a real existing profile whose role contradicts
  // the entrypoint intent. Block to prevent silent role-flipping.
  if (
    input.existingProfileRole &&
    input.intent &&
    input.existingProfileRole !== input.intent
  ) {
    return {
      kind: "conflict",
      code: "role_conflict",
      actual: input.existingProfileRole,
      attempted: input.intent,
    };
  }

  // (3) Resolve effective role.
  const role: Role = input.existingProfileRole ?? input.intent ?? "customer";

  // (4) Honor an explicit safe ?next= unless it's the generic /dashboard
  // (which would just bounce back through the role router).
  if (input.explicitNext && input.explicitNext !== "/dashboard") {
    return { kind: "redirect", target: input.explicitNext };
  }

  // (5) Role-based default routing.
  if (role === "owner") {
    return {
      kind: "redirect",
      target: input.hasShop ? TARGETS.ownerWithShop : TARGETS.ownerNoShop,
    };
  }
  return { kind: "redirect", target: TARGETS.customer };
}
