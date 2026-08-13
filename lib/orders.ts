/** Shared order-lifecycle helpers (no server-action constraints). */

/** Translate transition_order_status() coded exceptions into user-facing copy. */
export function orderTransitionError(raw: string): string {
  if (raw.includes("STATUS_CONFLICT"))
    return "This order just changed elsewhere. Refresh and try again.";
  if (raw.includes("ORDER_FINALIZED"))
    return "This order is already delivered or cancelled.";
  if (raw.includes("OWNER_CANCEL_WINDOW_CLOSED"))
    return "An order can no longer be cancelled once it's out for delivery.";
  if (raw.includes("CUSTOMER_CANCEL_WINDOW_CLOSED"))
    return "This order can no longer be cancelled — the shop has started preparing it.";
  if (raw.includes("PAYMENT_NOT_SETTLED"))
    return "Payment must be verified before the order can be marked delivered.";
  if (raw.includes("INVALID_TRANSITION"))
    return "That status change isn't allowed from the order's current state.";
  if (raw.includes("ORDER_NOT_FOUND")) return "Order not found.";
  if (raw.includes("unauthorized") || raw.includes("42501"))
    return "You're not allowed to change this order.";
  return "Could not update the order. Please try again.";
}
