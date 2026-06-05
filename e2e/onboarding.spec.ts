// Critical "money / onboarding" path — hermetic (no backend, no real Paddle).
//
// Covers the brief's path: signup → checkout (stubbed Paddle) → tenant +
// admin materialised → admin lands on their dashboard; plus an existing admin
// signing in via the login form.

import { test, expect } from '@playwright/test';
import { installHermeticBase, json, sessionResponse, BASE_URL } from './support/mock-api';

test.describe('Onboarding & auth — money path', () => {
  test('signup → stubbed Paddle checkout → /signup/complete → admin dashboard', async ({ page, context }) => {
    await installHermeticBase(page);

    // 1) Mint the checkout intent (no tenant exists yet).
    await page.route('**/api/v1/signup/checkout', json({
      signupIntentId: 'intent_e2e',
      paddleTransactionId: 'txn_e2e',
      transactionId: 'txn_e2e',
      checkoutUrl: null,
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      expiresAt: '2099-01-01T00:00:00Z',
    }));

    // 2) Complete signup — the backend would set the session cookie here, so we
    //    do the same before answering 200, then the app routes to the dashboard.
    await page.route('**/api/v1/signup/complete', async route => {
      await context.addCookies([{
        name: 'ofjr_session',
        value: encodeURIComponent(JSON.stringify({ role: 'ADMIN', username: 'founder' })),
        url: BASE_URL,
      }]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessionResponse('ADMIN', 'founder')),
      });
    });

    // A plan is required (the Pricing page supplies it) — arrive with one.
    await page.goto('/signup?plan=PRO&interval=MONTHLY');

    await page.fill('#companyName', 'Acme Construction');
    await page.fill('#tenantSlug', 'acme');
    await page.fill('#adminFullName', 'Frank Founder');
    await page.fill('#adminEmail', 'founder@acme.test');
    await page.fill('#adminUsername', 'founder');
    await page.fill('#adminPassword', 'supersecret1');
    await page.locator('button[type="submit"]').click();

    // Paddle stub redirects to /checkout/success, which calls /signup/complete
    // (materialising the tenant + admin session) and then shows the success
    // view with a "Go to dashboard" CTA. Follow it into the admin dashboard.
    await expect(page).toHaveURL(`${BASE_URL}/checkout/success`, { timeout: 20_000 });
    const goToDashboard = page.locator('a[href="/admin/dashboard"]');
    await expect(goToDashboard).toBeVisible({ timeout: 15_000 });
    await goToDashboard.click();

    await expect(page).toHaveURL(`${BASE_URL}/admin/dashboard`, { timeout: 15_000 });
    await expect(page.locator('#password')).toHaveCount(0);
  });

  test('existing admin signs in via the login form → admin dashboard', async ({ page, context }) => {
    await installHermeticBase(page);

    await page.route('**/api/v1/auth/login', async route => {
      await context.addCookies([{
        name: 'ofjr_session',
        value: encodeURIComponent(JSON.stringify({ role: 'ADMIN', username: 'admin1' })),
        url: BASE_URL,
      }]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessionResponse('ADMIN', 'admin1')),
      });
    });

    await page.goto('/login');
    await page.fill('#tenantSlug', 'acme');
    await page.fill('#username', 'admin1');
    await page.fill('#password', 'supersecret1');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(`${BASE_URL}/admin/dashboard`, { timeout: 15_000 });
  });
});
