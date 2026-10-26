// Platform console › Leads — hermetic. The unit tests cover the page's states;
// this one needs a real layout: at a common 1440 px window the console's
// content column is narrower than the design's 1072 px, and every column —
// the delete button included — must still fit inside the card.

import { test, expect } from '@playwright/test';
import { installHermeticBase, json } from './support/mock-api';

test.use({ viewport: { width: 1440, height: 900 } });

test('at 1440 px the Received column and the delete button fit inside the table card', async ({ page }) => {
  await installHermeticBase(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('ofjr_platform_session', JSON.stringify({
      accessToken: 'e2e', role: 'OWNER', email: 'owner@ejemplo.test', fullName: 'Owner Ejemplo', expiresAt: Date.now() + 3_600_000,
    }));
  });
  await page.route('**/api/platform/me', json({ id: 1, email: 'owner@ejemplo.test', fullName: 'Owner Ejemplo', role: 'OWNER' }));
  await page.route('**/api/platform/leads?**', json({
    content: [{
      id: 1, createdAt: '2026-10-25T16:42:00Z', name: 'Ana Prueba', company: 'Constructora Ejemplo, S. A.',
      email: 'ana.prueba@ejemplo.test', phone: null, interest: 'DEMO', locale: 'es', source: 'CHAT',
    }],
    totalElements: 1, totalPages: 1, number: 0, size: 25,
  }));

  await page.goto('/platform/leads');
  const remove = page.getByRole('button', { name: 'Delete lead Ana Prueba' });
  await expect(remove).toBeVisible();

  const card = page.locator('table').locator('..');
  const cardBox = (await card.boundingBox())!;
  const removeBox = (await remove.boundingBox())!;
  expect(removeBox.x + removeBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
  const received = page.getByRole('row').nth(1).getByRole('cell').nth(6);
  const receivedBox = (await received.boundingBox())!;
  expect(receivedBox.x + receivedBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
});
