import type { BrowserContext, Page } from '@playwright/test';
import { installHermeticBase, setSession } from '../../../e2e/support/mock-api';
import { installDemoApi } from './routes';
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

/** A logged-in panel with the demo dataset behind it, in Spanish, cursor on. */
export async function stage(page: Page, context: BrowserContext, role = 'ADMIN', username = USERNAME) {
  await setSession(context, role, username);
  await installHermeticBase(page, { role, username });
  // After the base: the last addInitScript wins, and the base pins English.
  await page.addInitScript(({ username }) => {
    try {
      localStorage.setItem('ofjr_language', 'es');
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
  }, { username });
  await dressShareOrigin(page);
  await installDemoApi(page);
  await installCursor(page);
}

/** Open the admin panel and settle on the given section. */
export async function openSection(page: Page, key: string) {
  await page.goto('/admin/dashboard');
  await page.waitForSelector('button[data-tour="dashboard"]');
  await page.waitForTimeout(1200);
  if (key !== 'dashboard') {
    await page.locator(`button[data-tour="${key}"]`).first().click();
    await page.waitForTimeout(1500);
  }
}
