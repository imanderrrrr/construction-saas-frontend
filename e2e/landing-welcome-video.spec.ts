// Landing welcome film (BT-V00) — hermetic.
//
// What the unit tests cannot see: the real files play in a real browser. The
// film is the tab the reader finds, it starts muted once it is on screen with
// the captions of the page's language showing, and «Ver con sonido» starts it
// over from the top, with sound. Picking another tab stops it.

import { test, expect, type Page } from '@playwright/test';
import { installHermeticBase } from './support/mock-api';

const PLAYER = 'figure[role="tabpanel"] video';

function film(page: Page) {
  return page.locator(PLAYER).evaluate(el => {
    const video = el as HTMLVideoElement;
    const captions = video.textTracks[0];
    return {
      src: video.currentSrc,
      paused: video.paused,
      muted: video.muted,
      time: video.currentTime,
      captions: captions && { language: captions.language, mode: captions.mode, cues: captions.cues?.length ?? 0 },
    };
  });
}

for (const { lang, sound } of [
  { lang: 'es', sound: 'Ver con sonido' },
  { lang: 'en', sound: 'Watch with sound' },
]) {
  test.describe(`Landing welcome film (${lang})`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('plays muted with captions on screen, starts over with sound, and stops on another tab', async ({ page }) => {
      await installHermeticBase(page);
      await page.addInitScript(language => localStorage.setItem('ofjr_language', language), lang);
      await page.goto('/');

      const tabs = page.getByRole('tab');
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
      await expect(tabs.first()).toContainText('V00');

      await page.locator(PLAYER).scrollIntoViewIfNeeded();
      await expect.poll(async () => (await film(page)).time, { timeout: 15_000 }).toBeGreaterThan(1);
      const muted = await film(page);
      expect(muted.src).toMatch(new RegExp(`/demos/${lang}/bienvenida\\.(mp4|webm)$`));
      expect(muted.muted).toBe(true);
      expect(muted.paused).toBe(false);
      expect(muted.captions).toMatchObject({ language: lang, mode: 'showing' });
      expect(muted.captions!.cues).toBeGreaterThan(10);

      await page.getByRole('button', { name: sound }).click();
      await expect(page.getByRole('button', { name: sound })).toHaveCount(0);
      const heard = await film(page);
      expect(heard.muted).toBe(false);
      expect(heard.paused).toBe(false);
      expect(heard.time).toBeLessThan(1);

      await tabs.nth(1).click();
      expect((await film(page)).src).not.toContain('bienvenida');
      await expect(page.locator('video[src*="bienvenida"], video:has(source[src*="bienvenida"])')).toHaveCount(0);
    });
  });
}
