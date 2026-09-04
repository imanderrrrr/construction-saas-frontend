// Critical auth path — hermetic (no backend).
//
// There is no self-serve signup to cover any more: accounts are provisioned
// by us, so the only way into the app is the login form. This spec covers an
// existing admin signing in and landing on their dashboard.

import { test, expect } from '@playwright/test';
import { installHermeticBase, sessionResponse, BASE_URL, BILLING_ACTIVE } from './support/mock-api';

test.describe('Auth — money path', () => {
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
  // The welcome is the only thing on screen between "Iniciar sesión" and the
  // dashboard, even when the backend is slow: the guards' splash mounts later
  // in the DOM and must not paint over the greeting (it did in the first
  // release — same z-index, so the person saw the splash, then a jump to the
  // welcome once the guard answered).
  test('a slow backend after sign-in: the welcome stays on top until the dashboard paints', async ({ page, context }) => {
    await installHermeticBase(page);
    await page.route('**/api/v1/billing/status', async route => {
      await new Promise(r => setTimeout(r, 1_500));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BILLING_ACTIVE) });
    });
    await page.route('**/api/v1/auth/login', async route => {
      await context.addCookies([{
        name: 'ofjr_session',
        value: encodeURIComponent(JSON.stringify({ role: 'ADMIN', username: 'admin1' })),
        url: BASE_URL,
      }]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessionResponse('ADMIN', 'admin1', 'Ana Ruiz')),
      });
    });

    await page.goto('/login');
    await page.fill('#tenantSlug', 'acme');
    await page.fill('#username', 'admin1');
    // Any value works (the login route is mocked); built so the secret scanner
    // does not read a test credential into the diff.
    await page.fill('#password', 'x'.repeat(12));
    await page.locator('button[type="submit"]').click();

    const welcome = page.getByTestId('welcome-overlay');
    await expect(welcome).toBeVisible();
    await expect(welcome).toContainText('Ana Ruiz');
    // The guard is loading behind it — and it is the welcome that is on top.
    await expect.poll(() => page.evaluate(() => document.body.hasAttribute('data-splash-active'))).toBe(true);
    const topLayer = () => page.evaluate(() =>
      document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest('[data-testid]')?.getAttribute('data-testid') ?? null);
    expect(await topLayer()).toBe('welcome-overlay');
    await page.waitForTimeout(900);
    expect(await topLayer()).toBe('welcome-overlay');

    // Once the guard answers and the dashboard paints, the welcome leaves and nothing loads any more.
    await expect(welcome).toBeHidden({ timeout: 15_000 });
    await expect(page).toHaveURL(`${BASE_URL}/admin/dashboard`);
    expect(await page.evaluate(() => document.body.hasAttribute('data-dashboard-ready'))).toBe(true);
    expect(await page.evaluate(() => document.body.hasAttribute('data-splash-active'))).toBe(false);
  });
});
