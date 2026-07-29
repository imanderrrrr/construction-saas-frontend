// Critical auth path — hermetic (no backend).
//
// There is no self-serve signup to cover any more: accounts are provisioned
// by us, so the only way into the app is the login form. This spec covers an
// existing admin signing in and landing on their dashboard.

import { test, expect } from '@playwright/test';
import { installHermeticBase, sessionResponse, BASE_URL } from './support/mock-api';

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
});
