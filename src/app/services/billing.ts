// BuildTrack — Billing service (admin tenant-side).
//
// Thin client over `POST /api/v1/billing/checkout`. The endpoint is
// ADMIN-only and the backend resolves tenant from the session cookie /
// JWT, so the frontend MUST NOT send tenantId, tenantSlug, priceId,
// productId, amount, currency, trialDays or any other billing knob —
// only `planCode` and `billingInterval`. The backend mints a Paddle
// transaction and returns a transactionId that the UI hands to
// Paddle.Checkout.open().

import { api } from '../lib/api';

export type PlanCode = 'PRO' | 'BUSINESS';
export type BillingInterval = 'MONTHLY' | 'ANNUAL';

export interface CreateCheckoutRequest {
  planCode: PlanCode;
  billingInterval: BillingInterval;
}

export interface CreateCheckoutResponse {
  transactionId: string;
}

export const BillingService = {
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
