import { test, expect } from '@playwright/test';

// The same test can run against the local production preview via the optional
// platform-only config; the request must come from the built client as well.
test('platform login and MFA use the API namespace while page routes remain reloadable', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'tenant_cookie_probe', value: 'tenant-only', url: baseURL! }]);
  const requests: { url: string; cookie?: string; authorization?: string }[] = [];
  await page.route('**/api/platform/auth/**', async route => {
    const request = route.request();
    const headers = await request.allHeaders();
    requests.push({ url: request.url(), cookie: headers.cookie, authorization: headers.authorization });
    const login = new URL(request.url()).pathname.endsWith('/login');
    await route.fulfill({
      status: login ? 200 : 401,
      contentType: 'application/json',
      body: JSON.stringify(login
        ? { status: 'MFA_REQUIRED', challengeToken: 'local-test-challenge' }
        : { code: 'MFA_INVALID', message: 'Invalid test code' }),
    });
  });
  await page.goto('/platform/login');
  await page.reload();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('owner@example.com');
  await page.getByLabel('Password', { exact: true }).fill('local-test-password');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText("Verify it's you", { exact: true })).toBeVisible();
  await page.getByPlaceholder('000000').fill('123456');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText('Invalid test code', { exact: true })).toBeVisible();
  expect(requests.map(r => r.url)).toEqual([
    `${baseURL}/api/platform/auth/login`, `${baseURL}/api/platform/auth/mfa-verify`,
  ]);
  expect(requests.every(r => !r.cookie && !r.authorization)).toBe(true);
});
