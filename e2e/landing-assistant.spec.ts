// Landing assistant — hermetic (no backend, no Cloudflare).
//
// The chat and the contact form are answered by mockLandingAssistant, and the
// Turnstile loader is stubbed to hand out `e2e-token` at once. What this covers
// that the unit tests cannot: the panel chunk really loads on click (and only
// then), Turnstile is fetched only when a conversation starts, and the phone
// sheet covers the screen and holds the page still.

import { test, expect, type Page } from '@playwright/test';
import { ASSISTANT_REPLY, installHermeticBase, mockLandingAssistant } from './support/mock-api';

async function openAssistant(page: Page) {
  await page.getByRole('button', { name: 'AI assistant' }).click();
  const dialog = page.getByRole('dialog', { name: 'AI assistant' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Wheel scrolling animates: wait until the page stops moving. */
async function scrollSettled(page: Page) {
  let last = -1;
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => window.scrollY);
      const still = y === last;
      last = y;
      return still;
    }, { intervals: [200] })
    .toBe(true);
}

async function fillContact(dialog: ReturnType<Page['getByRole']>) {
  await dialog.getByLabel('Name', { exact: true }).fill('Ana Prueba');
  await dialog.getByLabel('Company', { exact: true }).fill('Constructora Ejemplo');
  await dialog.getByLabel('Email or phone', { exact: true }).fill('ana@ejemplo.test');
}

test.describe('Landing assistant', () => {
  test('no request goes to challenges.cloudflare.com before the button is clicked', async ({ page }) => {
    await installHermeticBase(page);
    await mockLandingAssistant(page);
    const turnstile: string[] = [];
    page.on('request', request => {
      if (request.url().includes('challenges.cloudflare.com')) turnstile.push(request.url());
    });

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'AI assistant' })).toBeVisible();
    await page.waitForLoadState('load');
    expect(turnstile).toEqual([]);

    const dialog = await openAssistant(page);
    await dialog.getByRole('button', { name: /Do I need to install anything\?/ }).click();
    await expect(dialog.getByText(ASSISTANT_REPLY)).toBeVisible();
    expect(turnstile).toHaveLength(1);
  });

  test('desktop: open, ask the first suggested question, see the reply, open the form, submit stays disabled until consent, then the Received stamp appears', async ({ page }) => {
    await installHermeticBase(page);
    const sent = await mockLandingAssistant(page);
    await page.goto('/');

    const dialog = await openAssistant(page);
    await expect(dialog.getByRole('textbox', { name: 'Your message' })).toBeFocused();
    await dialog.getByRole('button', { name: /Do I need to install anything\?/ }).click();
    await expect(dialog.getByText(ASSISTANT_REPLY)).toBeVisible();
    expect(sent.chat[0]).toEqual({
      locale: 'en',
      messages: [{ role: 'user', content: 'Do I need to install anything?' }],
      turnstileToken: 'e2e-token',
    });

    await dialog.getByRole('button', { name: 'Book a demo' }).click();
    const submit = dialog.getByRole('button', { name: 'Send my details' });
    await fillContact(dialog);
    await expect(submit).toBeDisabled();
    await dialog.getByRole('checkbox').check();
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(dialog.getByText('Received', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'We got your details.' })).toBeVisible();
    expect(sent.leads[0]).toEqual({
      name: 'Ana Prueba',
      company: 'Constructora Ejemplo',
      email: 'ana@ejemplo.test',
      interest: 'DEMO',
      locale: 'en',
      source: 'CHAT',
      consent: true,
      consentVersion: 'landing-lead-v1',
      turnstileToken: 'e2e-token',
    });
  });

  test('a 503 shows the unavailable notice with the support mailto and the form still submits', async ({ page }) => {
    await installHermeticBase(page);
    const sent = await mockLandingAssistant(page, {
      chat: { status: 503, body: { code: 'ASSISTANT_DISABLED', message: 'The landing assistant is switched off' } },
    });
    await page.goto('/');

    const dialog = await openAssistant(page);
    await dialog.getByRole('textbox', { name: 'Your message' }).fill('Hello there');
    await dialog.getByRole('textbox', { name: 'Your message' }).press('Enter');

    const notice = dialog.getByRole('alert');
    await expect(notice).toContainText("I can't answer right now");
    await expect(notice.getByRole('link')).toHaveAttribute('href', 'mailto:support@buildtrackfield.com');
    await expect(dialog.getByText('The landing assistant is switched off')).toHaveCount(0);

    await fillContact(dialog);
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Send my details' }).click();
    await expect(dialog.getByText('Received', { exact: true })).toBeVisible();
    expect(sent.leads).toHaveLength(1);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('mobile viewport: the panel fills the screen and the page behind does not scroll', async ({ page }) => {
      await installHermeticBase(page);
      await mockLandingAssistant(page);
      await page.goto('/');

      // The page itself scrolls while the assistant is closed…
      await page.mouse.move(180, 400);
      await page.mouse.wheel(0, 900);
      await page.waitForFunction(() => window.scrollY > 0);
      await scrollSettled(page);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await scrollSettled(page);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      const dialog = await openAssistant(page);
      // Measured once the 220 ms entrance (a scale from .98) is over.
      await expect.poll(() => dialog.boundingBox()).toEqual({ x: 0, y: 0, width: 375, height: 812 });
      await expect(dialog).toHaveAttribute('aria-modal', 'true');

      // …and holds still under the open sheet.
      await page.mouse.move(180, 30);
      await page.mouse.wheel(0, 900);
      await scrollSettled(page);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    });
  });
});
