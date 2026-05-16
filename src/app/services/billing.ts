// BuildTrack — Billing service (admin tenant-side).
//
// Thin client over tenant-admin billing endpoints. The backend resolves
// tenant from the session cookie / JWT, so the frontend MUST NOT send
// tenantId, tenantSlug, priceId, productId, amount, currency, trialDays
// or any other billing knob. Checkout sends only `planCode` and
// `billingInterval`; status sends no payload at all.
//
// `changePlan` mirrors the same contract: it sends just `planCode` and
// `billingInterval`. The backend resolves the existing Paddle
// subscription from the session and applies the change server-side;
// the frontend never touches Paddle ids, prices, or proration.

import { api } from '../lib/api';

export type PlanCode = 'PRO' | 'BUSINESS';
export type BillingInterval = 'MONTHLY' | 'ANNUAL';
export type BillingStatusValue =
  | 'CHECKOUT_PENDING'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'EXPIRED'
  | 'INCOMPLETE'
  | 'PAYMENT_REQUIRED'
  | (string & {});

// Reasons the backend can return for refusing a plan change. Kept as a
// closed enum so the UI can map each one to friendly copy; we also
// accept any other string for forward-compat with new backend states.
export type ChangePlanBlockedReason =
  | 'NO_PADDLE_SUBSCRIPTION'
  | 'CANCEL_AT_PERIOD_END'
  | 'BILLING_STATUS_NOT_ALLOWED'
  | 'PLAN_NOT_RESOLVED'
  | 'NO_BILLING_ACCOUNT'
  | (string & {});

export interface CreateCheckoutRequest {
  planCode: PlanCode;
  billingInterval: BillingInterval;
}

export interface CreateCheckoutResponse {
  transactionId: string;
}

export interface ChangePlanRequest {
  planCode: PlanCode;
  billingInterval: BillingInterval;
}

// The change-plan endpoint accepts and produces a 200 with no required
// body shape — the backend syncs with Paddle async and the new state
// arrives through the regular webhook -> /billing/status path. We type
// the response loosely so we don't depend on field that may not exist.
export interface ChangePlanResponse {
  accepted?: boolean;
  message?: string;
}

export interface BillingStatusResponse {
  billingStatus: BillingStatusValue | null;
  planCode: PlanCode | null;
  billingInterval: BillingInterval | null;
  paddleEnv: 'sandbox' | 'live' | (string & {}) | null;
  // Period window. `currentPeriodStartsAt` is the start of the current
  // billing cycle, `currentPeriodEndsAt` is when it renews / ends.
  currentPeriodStartsAt?: string | null;
  currentPeriodEndsAt: string | null;
  // Trial window — set when the subscription is/was in trial. `isTrialing`
  // is the authoritative flag (a TRIALING billingStatus is the same thing
  // but we keep the dedicated boolean for clarity in the UI).
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  isTrialing?: boolean | null;
  // When `true`, the subscription is scheduled to cancel at the end of
  // the current period. We do not let the user change plan while in this
  // state (backend also enforces it).
  cancelAtPeriodEnd?: boolean | null;
  // Last time the local billing snapshot was updated by a webhook.
  updatedAt?: string | null;
  // Optional convenience flag from the backend.
  hasPaddleSubscription?: boolean | null;
  // Authoritative gate for the change-plan UI. The frontend must read
  // this — never derive its own decision from billingStatus alone.
  changePlanAllowed?: boolean | null;
  // When `changePlanAllowed === false`, explains why so the UI can map
  // it to a friendly message instead of a generic "disabled" state.
  changePlanBlockedReason?: ChangePlanBlockedReason | null;
  lastEventId: string | null;
  lastEventOccurredAt: string | null;
}

export const BillingService = {
  /**
   * Read the local billing snapshot for the authenticated tenant.
   * No tenant or checkout fields are sent; the backend resolves scope from
   * the admin session and returns null fields when billing is not configured.
   */
  getStatus(): Promise<BillingStatusResponse> {
    return api<BillingStatusResponse>('/api/v1/billing/status');
  },

  /**
   * Ask the backend to mint a Paddle transaction for the given plan +
   * interval. Returns the transactionId to feed into Paddle Checkout.
   *
   * Auth: relies on the existing tenant-admin session cookie + CSRF
   * handled by the shared `api()` wrapper.
   */
  createCheckout(req: CreateCheckoutRequest): Promise<CreateCheckoutResponse> {
    return api<CreateCheckoutResponse>('/api/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({
        planCode: req.planCode,
        billingInterval: req.billingInterval,
      }),
    });
  },

  /**
   * Ask the backend to change the active Paddle subscription to the
   * given plan + interval. The backend resolves the existing
   * subscription from the session and performs the change against
   * Paddle. The actual swap is async (Paddle webhooks flip the local
   * snapshot a moment later), so callers should treat success as
   * "requested, refresh status to see the new state".
   *
   * Only `planCode` and `billingInterval` are sent — tenantId, priceId,
   * Paddle subscription/customer ids, amount and currency are all
   * resolved by the backend.
   */
  changePlan(req: ChangePlanRequest): Promise<ChangePlanResponse> {
    return api<ChangePlanResponse>('/api/v1/billing/subscription/change-plan', {
      method: 'POST',
      body: JSON.stringify({
        planCode: req.planCode,
        billingInterval: req.billingInterval,
      }),
    });
  },
};
