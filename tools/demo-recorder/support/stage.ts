import type { BrowserContext, Page } from '@playwright/test';
import { installHermeticBase, setSession } from '../../../e2e/support/mock-api';
import { installDemoApi, type Lang } from './routes';
import { installCursor } from './cursor';

const USERNAME = 'analucia';

/**
 * Stage dressing, and the only thing in these clips that is not the app as it
 * ships: the panel under the recorder runs on a dev server, so the client-view
 * link it draws would read `http://localhost:5199/...` on a public marketing
 * page. The module that builds that link is rewritten in flight to use the
 * production host, so the link and its QR agree and neither one advertises a
 * laptop. Nothing else about the footage is touched.
 */
const SHARE_ORIGIN = 'https://buildtrackfield.com';

async function dressShareOrigin(page: Page) {
  await page.route(/\/src\/app\/services\/clientAccess\.ts(\?.*)?$/, async route => {
    const res = await route.fetch();
    const body = (await res.text()).replace('window.location.origin', JSON.stringify(SHARE_ORIGIN));
    await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'text/javascript' } });
  });
}

/**
 * A logged-in panel with the demo dataset behind it, cursor on, in `lang`.
 *
 * The language is the whole point of recording twice: an English reader on the
 * landing page should not be shown a Spanish panel and left to guess whether
 * the product speaks their language. Both the chrome (the panel's own i18n)
 * and the fixture content follow this flag.
 */
export async function stage(
  page: Page, context: BrowserContext,
  { lang = 'es', role = 'ADMIN', username = USERNAME }: { lang?: Lang; role?: string; username?: string } = {},
) {
  await setSession(context, role, username);
  await installHermeticBase(page, { role, username });
  // After the base: the last addInitScript wins, and the base pins English.
  await page.addInitScript(({ username, lang }) => {
    try {
      localStorage.setItem('ofjr_language', lang);
      // Favourites would reorder the sidebar between clips.
      localStorage.setItem(`bt.navfavs.${username}`, '[]');
    } catch { /* private mode */ }
    // Every section tour reports itself as already seen. Seeding a list of
    // keys is not enough: a tour is scoped to the SCREEN, so the ficha tabs
    // and the Presupuestos report view each own one, and a scope this list
    // did not know about opened its spotlight mid-clip and dimmed the page.
    // Answering for the whole prefix cannot miss one.
    const seenAt = '2026-01-01T00:00:00.000Z';
    const read = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (typeof key === 'string' && (key.startsWith('bt.sectiontour.') || key.startsWith('bt.sectionintro.'))) {
        return seenAt;
      }
      return read.call(this, key);
    };
  }, { username, lang });
  await dressShareOrigin(page);
  await installDemoApi(page, lang);
  await installCursor(page);
}

/**
 * Open the admin panel and settle on the given section.
 *
 * Sections are component state, not routes, so there is no URL to wait on:
 * after clicking the sidebar we wait for one of the section's own tour anchors
 * (`data-tour="sec.<key>.*"`) to exist. A fixed sleep was not enough — a click
 * that lands while the dashboard is still painting is swallowed, and the clip
 * then films the wrong screen (it did, once, and the run only failed later on
 * a locator that was never going to be there).
 */
export async function openSection(page: Page, key: string) {
  await page.goto('/admin/dashboard');
  await page.waitForSelector('button[data-tour="dashboard"]');
  await page.waitForTimeout(1200);
  if (key === 'dashboard') return;

  const anchor = `[data-tour^="sec.${key}."]`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.locator(`button[data-tour="${key}"]`).first().click();
    try {
      await page.waitForSelector(anchor, { timeout: 6_000 });
      await page.waitForTimeout(1200);
      return;
    } catch {
      if (attempt === 3) throw new Error(`openSection("${key}"): the section never rendered ${anchor}`);
    }
  }
}
