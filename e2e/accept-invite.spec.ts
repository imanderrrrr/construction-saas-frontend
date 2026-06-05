// Invitation acceptance — the second half of the onboarding path, plus the
// 429 rate-limit UX we added (AcceptInvite.classify → 'rateLimited'). Hermetic.

import { test, expect } from '@playwright/test';
import { installHermeticBase, json, sessionResponse, BASE_URL } from './support/mock-api';

const TOKEN = 'e2e-token-123';
const previewUrl = `**/api/v1/auth/invitations/${TOKEN}`;
const acceptUrl = `**/api/v1/auth/invitations/${TOKEN}/accept`;

test.describe('Accept invitation', () => {
  test('preview → set password → invited worker lands on the worker dashboard', async ({ page, context }) => {
    await installHermeticBase(page);
    await page.route(previewUrl, json({
      role: 'WORKER',
      tenantName: 'Acme Construction',
      tenantSlug: 'acme',
      invitedByName: 'Admin One',
      expiresAt: '2099-01-01T00:00:00Z',
    }));
    await page.route(acceptUrl, async route => {
      await context.addCookies([{
        name: 'ofjr_session',
        value: encodeURIComponent(JSON.stringify({ role: 'WORKER', username: 'worker1' })),
        url: BASE_URL,
      }]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessionResponse('WORKER', 'worker1')),
      });
    });

    await page.goto(`/accept-invite/${TOKEN}`);
    await expect(page.getByText('Create your account')).toBeVisible();

    await page.fill('#fullName', 'Will Worker');
    await page.fill('#username', 'worker1');
    await page.fill('#password', 'supersecret1');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(`${BASE_URL}/worker/dashboard`, { timeout: 15_000 });
  });

  test('a 429 on accept shows the honest rate-limit message (not a network error)', async ({ page }) => {
    await installHermeticBase(page);
    await page.route(previewUrl, json({
      role: 'WORKER', tenantName: 'Acme', tenantSlug: 'acme', invitedByName: null, expiresAt: '2099-01-01T00:00:00Z',
    }));
    await page.route(acceptUrl, json({ message: 'slow down', code: 'RATE_LIMITED' }, 429));

    await page.goto(`/accept-invite/${TOKEN}`);
    await page.fill('#fullName', 'Will Worker');
    await page.fill('#username', 'worker1');
    await page.fill('#password', 'supersecret1');
    await page.locator('button[type="submit"]').click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Too many attempts');
  });

  test('an expired/invalid token (410) shows the terminal expired screen', async ({ page }) => {
    await installHermeticBase(page);
    await page.route(previewUrl, json({ message: 'gone', code: 'EXPIRED' }, 410));

    await page.goto(`/accept-invite/${TOKEN}`);
    await expect(page.getByText('Invitation expired')).toBeVisible();
    await expect(page.locator('#password')).toHaveCount(0);
  });
});
