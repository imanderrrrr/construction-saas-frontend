// Public status page — hermetic.
//
// The measured history (GET /api/v1/public/status) and the live health probe
// are both stubbed. What a real browser adds over the unit tests: the 90 bars
// per component fit a phone without pushing the page sideways, pointing at a
// day shows its card, and the landing's main nav reaches this page.

import { test, expect, type Page } from '@playwright/test';
import { installHermeticBase } from './support/mock-api';

const HEALTH_URL = 'https://construction-saas-backend-b00g.onrender.com/actuator/health';

/** 90 days ending today; measured for the last `measured` of them. */
function history(measured: number, value: (i: number) => number) {
  const days = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date, uptimePercent: i < measured ? value(i) : null });
  }
  return days;
}

async function stubStatus(page: Page) {
  const days = history(12, i => (i === 4 ? 97.2 : 100));
  await page.route('**/api/v1/public/status', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        timezone: 'America/Guatemala',
        trackingSince: days[78].date,
        days: 90,
        components: [
          { key: 'web', current: 'OPERATIONAL', uptimePercent: 100, history: days },
          { key: 'api', current: 'OPERATIONAL', uptimePercent: 99.77, history: days },
          { key: 'database', current: 'OPERATIONAL', uptimePercent: 99.77, history: days },
          { key: 'files', current: 'OPERATIONAL', uptimePercent: 100, history: days },
        ],
      }),
    }),
  );
  await page.route(HEALTH_URL, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"UP"}' }),
  );
}

for (const { name, viewport, isMobile } of [
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
]) {
  test.describe(`Status page (${name})`, () => {
    test.use({ viewport, isMobile, hasTouch: isMobile });

    test('four components, 90 measured days each, inside the window', async ({ page }) => {
      await installHermeticBase(page);
      await stubStatus(page);
      await page.goto('/status');

      await expect(page.getByRole('heading', { level: 1, name: 'All systems operational' })).toBeVisible();
      for (const key of ['web', 'api', 'database', 'files']) {
        await expect(page.getByTestId(`status-bars-${key}`).locator('span')).toHaveCount(90);
      }
      await expect(page.getByTestId('status-component-api')).toContainText('99.77% uptime');
      await expect(page.getByText(/MEASURED SINCE/)).toBeVisible();

      // 360 bars must not push the page sideways on a phone.
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

      // Pointing at the worst day tells its date and figure.
      const strip = page.getByTestId('status-bars-api');
      const box = (await strip.boundingBox())!;
      await page.mouse.move(box.x + box.width * (85.5 / 90), box.y + box.height / 2);
      await expect(page.getByRole('tooltip')).toContainText('97.20% available');
    });

    test('the landing\'s main nav reaches it', async ({ page }) => {
      await installHermeticBase(page);
      await stubStatus(page);
      await page.goto('/');
      const nav = page.getByRole('navigation').first();
      await nav.getByRole('link', { name: 'System status' }).click();
      await expect(page).toHaveURL(/\/status$/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    });
  });
}
