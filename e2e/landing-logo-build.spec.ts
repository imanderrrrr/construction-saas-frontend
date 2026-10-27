// Landing logo build — «BuildTrack se construye» — hermetic.
//
// What the unit tests cannot see: the real video plays in a real browser
// (Chromium takes the WebM, not Safari's HEVC), it stands in the logo's
// corner — the whole frame inside the page, its orange box level with the
// real logo — and when it is over its orange box sits ON the real logo's box,
// which then takes over. installHermeticBase marks the build as seen, so
// these ask for it with `?logo`, as a reviewer would.

import { test, expect, type Page } from '@playwright/test';
import { installHermeticBase } from './support/mock-api';

const REAL_LOGO = 'nav a[aria-label="BuildTrack"]';

/** The frame and the orange box drawn in it (300,196 · 128 px of its 1400 px), next to the real logo's box, in page px. */
function boxes(page: Page) {
  return page.evaluate(realLogo => {
    const frame = document.querySelector('.logo-build-root')!.getBoundingClientRect();
    const mark = document.querySelector(`${realLogo} .bg-bt-orange`)!.getBoundingClientRect();
    const k = frame.width / 1400;
    return {
      frame: { left: frame.left, top: frame.top, right: frame.right, bottom: frame.bottom },
      drawn: { left: frame.left + 300 * k, top: frame.top + 196 * k, size: 128 * k },
      real: { left: mark.left, top: mark.top, size: mark.width },
      window: { width: innerWidth, height: innerHeight },
    };
  }, REAL_LOGO);
}

/** Waits for the hand-off and reports, at that moment, how far the drawn box is from the real one. */
function landingError(page: Page) {
  return page.evaluate(
    realLogo =>
      new Promise<number>(resolve => {
        const root = document.querySelector('.logo-build-root')!;
        const measure = () => {
          const frame = root.getBoundingClientRect();
          const mark = document.querySelector(`${realLogo} .bg-bt-orange`)!.getBoundingClientRect();
          const k = frame.width / 1400;
          resolve(Math.max(
            Math.abs(frame.left + 300 * k - mark.left),
            Math.abs(frame.top + 196 * k - mark.top),
            Math.abs(128 * k - mark.width),
          ));
        };
        new MutationObserver((_, observer) => {
          if (root.getAttribute('data-phase') !== 'handoff') return;
          observer.disconnect();
          // The grow's transition and its timer end together; let the last frame settle.
          window.setTimeout(measure, 80);
        }).observe(root, { attributes: true, attributeFilter: ['data-phase'] });
      }),
    REAL_LOGO,
  );
}

for (const { name, viewport, isMobile } of [
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
]) {
  test.describe(`Landing logo build (${name})`, () => {
    test.use({ viewport, isMobile, hasTouch: isMobile });

    test('builds the logo in its corner, grows it onto the real one, and hands the corner back', async ({ page }) => {
      await installHermeticBase(page);
      await page.goto('/?logo');

      const overlay = page.locator('.logo-build-root');
      await expect(overlay).toHaveAttribute('data-phase', 'building');
      await expect(page.locator(REAL_LOGO)).toHaveClass(/opacity-0/);
      expect(await page.locator('.logo-build-root video').evaluate(v => (v as HTMLVideoElement).currentSrc))
        .toMatch(/\/logo-build\/logo-build-700\.webm$/);

      // In the corner, whole, and nowhere else: the frame starts at the top of
      // the page, keeps to the left half of the window, and its orange box is
      // level with the real logo's.
      const during = await boxes(page);
      expect(during.frame.top).toBeGreaterThanOrEqual(0);
      expect(during.frame.left).toBeGreaterThanOrEqual(0);
      expect(during.frame.right).toBeLessThanOrEqual(during.window.width / 2 + 120);
      expect(during.frame.bottom).toBeLessThan(during.real.top + during.real.size + 30);
      expect(Math.abs(during.drawn.top + during.drawn.size / 2 - (during.real.top + during.real.size / 2))).toBeLessThan(1);

      // The page stays usable underneath: the build takes no clicks.
      expect(await overlay.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');

      await expect(overlay).toHaveAttribute('data-phase', 'landing', { timeout: 10_000 });
      expect(await landingError(page)).toBeLessThan(1);

      await expect(overlay).toHaveCount(0);
      await expect(page.locator(REAL_LOGO)).not.toHaveClass(/opacity-0/);
      expect(await page.evaluate(() => localStorage.getItem('buildtrack:logo-build-v2-seen'))).toBe('1');
    });
  });
}
