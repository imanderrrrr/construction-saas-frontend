// BuildTrack E2E — hermetic network harness.
//
// Every spec runs with NO backend and NO real Paddle. We:
//   • stub window.Paddle + intercept the Paddle CDN so checkout "succeeds"
//     by redirecting to its successUrl,
//   • force the UI language to English (deterministic text assertions),
//   • answer GET /billing/status with ACTIVE (so the ADMIN BillingGuard
//     lets dashboards render),
//   • default every other /api/v1/** call to 500 so data-fetching dashboards
//     fall back to their empty/error state and still render their shell.
//
// Specs add their own `page.route(...)` AFTER installHermeticBase(); the most
// recently registered handler wins in Playwright, so those overrides take
// precedence over the catch-all here.

import type { BrowserContext, Page, Route } from '@playwright/test';

export const BASE_URL = 'http://localhost:5180';
const PADDLE_CDN = 'https://cdn.paddle.com/**';

// A subscription that the billing gate treats as allowed (ACTIVE | TRIALING).
export const BILLING_ACTIVE = {
  billingStatus: 'ACTIVE',
  planCode: 'PRO',
  billingInterval: 'MONTHLY',
  currentPeriodStartsAt: '2026-05-04',
  currentPeriodEndsAt: '2099-01-01',
  isTrialing: false,
  cancelAtPeriodEnd: false,
  changePlanAllowed: true,
  lastEventId: 'evt_e2e',
  lastEventOccurredAt: '2026-06-04T00:00:00Z',
};

// A login/complete/accept success body (same shape across all three).
export function sessionResponse(role: string, username = 'tester') {
  return { role, username, expiresInMinutes: 480 };
}

/** Fulfill helper: JSON body + status. */
export function json(body: unknown, status = 200) {
  return (route: Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/**
 * Seed the client-readable `ofjr_session` cookie the way the backend would,
 * so `AuthService.isAuthenticated()/getRole()` see a logged-in user.
 * The app reads it as JSON.parse(decodeURIComponent(value)) — match that.
 */
export async function setSession(context: BrowserContext, role: string, username = 'tester') {
  await context.addCookies([
    {
      name: 'ofjr_session',
      value: encodeURIComponent(JSON.stringify({ role, username })),
      url: BASE_URL,
    },
    { name: 'bt_tenant', value: 'acme', url: BASE_URL },
    { name: 'XSRF-TOKEN', value: 'e2e-csrf-token', url: BASE_URL },
  ]);
}

interface BaseOpts {
  role?: string;
  username?: string;
}

/** Install the default hermetic network layer. Call once per test before goto. */
export async function installHermeticBase(page: Page, opts: BaseOpts = {}) {
  // English UI + a stubbed Paddle that "pays" by redirecting to successUrl.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ofjr_language', 'en');
    } catch {
      /* ignore */
    }
    // Minimal surface matching lib/paddle.ts' PaddleGlobal.
    (window as unknown as { Paddle: unknown }).Paddle = {
      Environment: { set() {} },
      Initialize() {},
      Checkout: {
        open(o: { settings?: { successUrl?: string } }) {
          const url = o?.settings?.successUrl;
          if (url) window.location.assign(url);
        },
        close() {},
      },
    };
  });

  // Paddle.js loader injects this <script>; serve an empty 200 so onload fires
  // and the stub above is used instead of the real SDK.
  await page.route(PADDLE_CDN, route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* paddle stub */' }),
  );

  // Catch-all (registered first → lowest priority): unmocked endpoints 500 so
  // dashboards degrade gracefully rather than render stale/wrong data.
  await page.route('**/api/v1/**', route =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'e2e-default-500', code: 'E2E_UNMOCKED' }),
    }),
  );

  // Billing gate → allowed, so the ADMIN BillingGuard renders children.
  await page.route('**/api/v1/billing/status', json(BILLING_ACTIVE));

  // Session validation echo (some shells call /auth/me on mount).
  if (opts.role) {
    await page.route('**/api/v1/auth/me', json(sessionResponse(opts.role, opts.username)));
  }
}
