import { test } from '@playwright/test';

// Not part of the pipeline: a look at the landing page with the footage in it,
// in both languages, so the Videos block can be reviewed as a reader sees it.
for (const lang of ['es', 'en'] as const) {
  test(`landing: videos block · ${lang}`, async ({ page }) => {
    await page.addInitScript((l) => { try { localStorage.setItem('ofjr_language', l); } catch { /* */ } }, lang);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await page.waitForTimeout(2500);
    await page.locator('section#plataforma').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await page.locator('figure').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `tools/demo-recorder/.shots/landing-${lang}-1.png` });
    await page.mouse.wheel(0, 950);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `tools/demo-recorder/.shots/landing-${lang}-2.png` });
    await page.locator('section#app').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tools/demo-recorder/.shots/landing-${lang}-app.png` });
  });
}
