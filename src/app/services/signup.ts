// BuildTrack — Pre-payment signup service.
//
// Thin client over the new `/api/v1/signup/{checkout,complete}` endpoints.
// The legacy `/api/v1/auth/signup` is still wired in `AuthService.signup`
// for tests + internal flows that don't go through Paddle, but the public
// signup page MUST go through this surface so a tenant is never created
// before the customer's payment is accepted.
//
// Boundary rules:
//   - the frontend never sends `priceId`, `amount`, `currency`,
//     `paddle_*`, or anything the backend can resolve itself,
//   - the password is sent only to `/signup/checkout`, never logged, and
//     never echoed back — the backend hashes it on receipt,
//   - only the `signupIntentId` and minimum plan metadata are stored in
//     `sessionStorage` so the success/cancel pages can recover the flow
//     without retaining sensitive signup form fields.

import { api } from '../lib/api';

export type SignupPlanCode = 'PRO' | 'BUSINESS';
export type SignupBillingInterval = 'MONTHLY' | 'ANNUAL';

/** Mirrors the backend `SignupCheckoutRequest`. */
export interface SignupCheckoutPayload {
  companyName: string;
  workspaceIdentifier: string;
  adminUsername: string;
  adminPassword: string;
  adminFullName: string;
  adminEmail: string;
  planCode: SignupPlanCode;
  billingInterval: SignupBillingInterval;
}

/** Mirrors the backend `SignupCheckoutResponse`. */
export interface SignupCheckoutResponse {
  signupIntentId: string;
  paddleTransactionId: string;
  transactionId: string;
  checkoutUrl: string | null;
  planCode: SignupPlanCode;
  billingInterval: SignupBillingInterval;
  expiresAt: string;
}

/** Mirrors the backend `SignupCompleteRequest`. */
export interface SignupCompletePayload {
  signupIntentId: string;
}

/**
 * Same shape as `AuthService.LoginResponse` — the backend issues a real
 * session as part of `/signup/complete`, so the success page can
 * transition straight into the authenticated UI without forcing the
 * customer to retype their credentials.
 */
export interface SignupCompleteResponse {
  role: string;
  username: string;
  expiresInMinutes: number;
}

/**
 * Browser-storage key for the `signupIntentId` returned by
 * `/signup/checkout`. `sessionStorage` is the right scope here — we want
 * the value to survive the Paddle popup redirect (same browser tab /
 * session) but NOT to outlive the tab closing, which would otherwise
 * leak an unspent intent id across signups on shared computers.
 */
export const SIGNUP_INTENT_STORAGE_KEY = 'bt_signup_intent';

/**
 * Persist a signup intent id alongside the metadata we need to render
 * the recovery surface. Keep this intentionally small: no password,
 * workspace slug, email, names, or Paddle internals.
 */
export interface StoredSignupIntent {
  signupIntentId: string;
  planCode: SignupPlanCode;
  billingInterval: SignupBillingInterval;
}

export const SignupService = {
  /**
   * Stage the signup. Validates server-side, persists a temporary
   * SignupCheckoutIntent (no tenant yet), and returns the Paddle
   * transactionId for the frontend to feed into `Paddle.Checkout.open`.
   *
   * On success the caller MUST persist the returned id with
   * [rememberSignupIntent] so the success/cancel surfaces can recover
   * the flow after the Paddle popup closes.
   */
  createCheckoutIntent(
    payload: SignupCheckoutPayload,
  ): Promise<SignupCheckoutResponse> {
    return api<SignupCheckoutResponse>('/api/v1/signup/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Complete the signup after Paddle redirected the customer to the
   * success URL. The backend materialises the tenant + admin and issues
   * an auth session (cookie mode for the web).
   */
  completeSignup(
    payload: SignupCompletePayload,
  ): Promise<SignupCompleteResponse> {
    return api<SignupCompleteResponse>('/api/v1/signup/complete', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export function rememberSignupIntent(stored: StoredSignupIntent): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(SIGNUP_INTENT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage can be disabled (private browsing, quota exhausted). The
    // success page degrades to asking the user to start a new signup
    // — losing the intent is annoying but never harmful, and we never
    // need to throw out of the happy path on a storage failure.
  }
}

export function readSignupIntent(): StoredSignupIntent | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SIGNUP_INTENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSignupIntent> | null;
    if (
      !parsed ||
      typeof parsed.signupIntentId !== 'string' ||
      (parsed.planCode !== 'PRO' && parsed.planCode !== 'BUSINESS') ||
      (parsed.billingInterval !== 'MONTHLY' &&
        parsed.billingInterval !== 'ANNUAL')
    ) {
      return null;
    }
    return parsed as StoredSignupIntent;
  } catch {
    return null;
  }
}

export function clearSignupIntent(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(SIGNUP_INTENT_STORAGE_KEY);
  } catch {
    // Same rationale as [rememberSignupIntent] — never throw.
  }
}
