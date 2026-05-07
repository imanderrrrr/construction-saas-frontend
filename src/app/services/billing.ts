// BuildTrack — Billing service (admin tenant-side).
//
// Thin client over tenant-admin billing endpoints. The backend resolves
// tenant from the session cookie / JWT, so the frontend MUST NOT send
// tenantId, tenantSlug, priceId, productId, amount, currency, trialDays
// or any other billing knob. Checkout sends only `planCode` and
// `billingInterval`; status sends no payload at all.

import { api } from '../lib/api';

export type PlanCode = 'PRO' | 'BUSINESS';
export type BillingInterval = 'MONTHLY' | 'ANNUAL';
export type BillingStatusValue =
  | 'CHECKOUT_PENDING'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'PAYMENT_REQUIRED'
  | (string & {});

export interface CreateCheckoutRequest {
  planCode: PlanCode;
  billingInterval: BillingInterval;
}

export interface CreateCheckoutResponse {
  transactionId: string;
}

export interface BillingStatusResponse {
  billingStatus: BillingStatusValue | null;
  planCode: PlanCode | null;
  billingInterval: BillingInterval | null;
  paddleEnv: 'sandbox' | 'live' | (string & {}) | null;
  currentPeriodEndsAt: string | null;
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
};
