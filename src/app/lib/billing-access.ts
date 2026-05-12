// BuildTrack — Billing access predicate (frontend gate).
//
// A tenant can use the SaaS only while its local billing snapshot is in a
// known-good state. Anything else — including a null snapshot (no checkout
// has ever completed), an in-flight CHECKOUT_PENDING, a lapsed subscription
// or a value the frontend doesn't recognise — must be treated as "not
// entitled" and route the admin back to the billing page.
//
// CHECKOUT_PENDING explicitly does NOT entitle: it only means the admin
// clicked "Subscribe" and the backend minted a Paddle transaction id.
// Activation is owned by the signed Paddle webhook on the backend; until
// that webhook lands and flips the row to ACTIVE / TRIALING, the frontend
// keeps the workspace locked.
//
// We intentionally enumerate the *allowed* set and default-deny everything
// else, so a backend that grows new lifecycle states (EXPIRED, INCOMPLETE,
// PAYMENT_REQUIRED…) doesn't silently let users into a half-activated
// workspace.

import type { BillingStatusValue } from '../services/billing';

/** Billing states that grant full access to the workspace. */
export const ACCESS_ALLOWED_STATUSES: ReadonlyArray<BillingStatusValue> = [
  'ACTIVE',
  'TRIALING',
];

/**
 * Returns true only when the billing snapshot represents an entitled
 * tenant. Null / unknown / any non-allowed string returns false so the
 * caller redirects to billing.
 */
export function isBillingAllowed(
  status: BillingStatusValue | null | undefined,
): boolean {
  if (status == null) return false;
  return (ACCESS_ALLOWED_STATUSES as ReadonlyArray<string>).includes(status);
}

/**
 * Reason codes propagated to /admin/billing so the page can show the
 * right activation copy without re-doing the gating logic. Kept narrow on
 * purpose — the page maps these to localized strings.
 */
export type BillingBlockReason =
  | 'pending'    // CHECKOUT_PENDING — checkout opened, no webhook yet
  | 'missing'   // null billingStatus — never checked out
  | 'inactive'  // any known non-allowed status (PAST_DUE, CANCELED, …)
  | 'error';    // status fetch failed

export function billingBlockReason(
  status: BillingStatusValue | null | undefined,
): BillingBlockReason {
  if (status == null || status === 'NO_SUBSCRIPTION') return 'missing';
  if (status === 'CHECKOUT_PENDING') return 'pending';
  return 'inactive';
}
