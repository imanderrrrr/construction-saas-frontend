// Landing logo build — «BuildTrack se construye» — hermetic.
//
// What the unit tests cannot see: the real video plays in a real browser
// (Chromium takes the WebM, not Safari's HEVC), a phone gets the 700 px render,
// and when the flight is over the orange box drawn in the video sits ON the
// real logo's box, which then takes over. installHermeticBase marks the build
// as seen, so these ask for it with `?logo`, as a reviewer would.

import { test, expect, type Page } from '@playwright/test';
import { installHermeticBase } from './support/mock-api';

const REAL_LOGO = 'nav a[aria-label="BuildTrack"]';

/**
 * Waits for the hand-off and reports, at that moment, how far the orange box
 * drawn in the video (300,196 · 128 px in its 1400 px frame) is from the real
 * one, in page px.
 */
function landingError(page: Page) {
  return page.evaluate(
    realLogo =>
      new Promise<number>(resolve => {
        const root = document.querySelector('.logo-build-root')!;
        const measure = () => {
          const video = root.querySelector('video')!.getBoundingClientRect();
          const mark = document.querySelector(`${realLogo} .bg-bt-orange`)!.getBoundingClientRect();
          const k = video.width / 1400;
          resolve(Math.max(
            Math.abs(video.left + 300 * k - mark.left),
            Math.abs(video.top + 196 * k - mark.top),
            Math.abs(128 * k - mark.width),
          ));
        };
        new MutationObserver((_, observer) => {
          if (root.getAttribute('data-phase') !== 'handoff') return;
          observer.disconnect();
          // The flight's transition and its timer end together; let the last frame settle.
          window.setTimeout(measure, 80);
        }).observe(root, { attributes: true, attributeFilter: ['data-phase'] });
      }),
    REAL_LOGO,
  );
}

for (const { name, viewport, isMobile, render } of [
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, render: 'logo-build-700.webm' },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, render: 'logo-build-1400.webm' },
]) {
  test.describe(`Landing logo build (${name})`, () => {
    test.use({ viewport, isMobile, hasTouch: isMobile });

    test('builds the logo, lands it on the real one, and hands the corner back', async ({ page }) => {
      await installHermeticBase(page);
      await page.goto('/?logo');

      const overlay = page.locator('.logo-build-root');
      await expect(overlay).toHaveAttribute('data-phase', 'building');
      await expect(page.locator(REAL_LOGO)).toHaveClass(/opacity-0/);
      expect(await page.locator('.logo-build-root video').evaluate(v => (v as HTMLVideoElement).currentSrc))
        .toMatch(new RegExp(`/logo-build/${render.replace('.', '\\.')}$`));

      // The page stays usable underneath: the overlay takes no clicks.
      expect(await overlay.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');

      await expect(overlay).toHaveAttribute('data-phase', 'landing', { timeout: 10_000 });
      expect(await landingError(page)).toBeLessThan(1);

      await expect(overlay).toHaveCount(0);
      await expect(page.locator(REAL_LOGO)).not.toHaveClass(/opacity-0/);
      expect(await page.evaluate(() => localStorage.getItem('buildtrack:logo-build-v1-seen'))).toBe('1');
    });
  });
}
