import { test } from '@playwright/test';

// Not part of the pipeline: a look at the landing page with the new footage in
// it, so the Videos block can be reviewed as a reader sees it.
test('landing: videos block', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('ofjr_language', 'es'); } catch { /* */ } });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.waitForTimeout(2500);
  const block = page.locator('section#plataforma');
  await block.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3500);
  await page.locator('text=VIDEOS BT-V01').scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'tools/demo-recorder/.shots/landing-videos-1.png' });
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tools/demo-recorder/.shots/landing-videos-2.png' });
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tools/demo-recorder/.shots/landing-videos-3.png' });
  await page.locator('section#app').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tools/demo-recorder/.shots/landing-app.png' });
});
