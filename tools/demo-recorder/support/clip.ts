import fs from 'node:fs';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

/**
 * Clip bookkeeping.
 *
 * Playwright records the whole test — including the two or three seconds of
 * navigation it takes to get where the clip starts. Each test therefore writes
 * the in/out points it wants kept, measured from its own first line, and
 * `encode.mjs` cuts the raw recording down to them.
 */
const OUT = 'tools/demo-recorder/.out/clips';

/** Call once the screen is ready: the clip starts here. */
export async function beginScene(page: Page, t0: number, settle = 800): Promise<number> {
  await page.waitForTimeout(settle);
  return Date.now() - t0;
}

/** Call at the end of the choreography. */
export async function endScene(
  page: Page, info: TestInfo, key: string, lang: string, t0: number, start: number, tail = 900,
): Promise<void> {
  await page.waitForTimeout(tail);
  const end = Date.now() - t0;
  // NOT page.video().path(): that is the temp artifact, which Playwright moves
  // into the test's own output dir once the test ends. This is where it lands.
  await page.video();
  const video = path.join(info.outputDir, 'video.webm');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, `${key}.${lang}.json`),
    JSON.stringify({ key, lang, video, startMs: start, endMs: end, title: info.title }, null, 2),
  );
}
