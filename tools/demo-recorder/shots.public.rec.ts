import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installHermeticBase } from '../../e2e/support/mock-api';
import { installPublicApi } from './support/routes.public';
import type { Lang } from './support/routes';

// Stills of everything that is NOT the panel: the public site a prospect
// reads, and the token pages a client or a subcontractor opens from a link
// without ever having a BuildTrack account.
//
// These carry no session cookie on purpose — that is the point of them, and
// the manual has to show it.

const LANGS: Lang[] = (process.env.SHOT_LANGS?.split(',') as Lang[]) ?? ['es'];
const OUT = 'tools/demo-recorder/.shots/manual';

type Shot = {
  key: string;
  url: string;
  /** Frame this section of a long page. Its own id, not a pixel offset: the
   *  landing grows a block and a pixel offset quietly films the wrong thing. */
  section?: string;
  after?: (page: Page, lang: Lang) => Promise<void>;
};

const SHOTS: Shot[] = [
  { key: 'public.landing',         url: '/' },
  { key: 'public.landing-sistema', url: '/', section: 'sistema' },
  { key: 'public.landing-app',     url: '/', section: 'app' },
  { key: 'public.landing-demo',    url: '/', section: 'demo' },
  { key: 'public.landing-beta',    url: '/', section: 'beta' },
  { key: 'public.landing-faq',     url: '/', section: 'faq' },
  { key: 'public.docs',           url: '/docs' },
  { key: 'public.status',         url: '/status' },
  { key: 'public.support',        url: '/support' },
  { key: 'public.login',          url: '/login' },
  { key: 'public.subcontractor',  url: '/subcontractor/info' },
  { key: 'public.accept-invite',  url: '/accept-invite/demo-invite-token' },
  { key: 'public.sign',           url: '/sign/demo-sign-token' },
  { key: 'portal.bitacora',       url: '/client-view/demo-vista-hermosa-portal-token' },
  {
    key: 'portal.pendientes', url: '/client-view/demo-vista-hermosa-portal-token',
    after: async page => { await page.getByRole('tab').nth(1).click(); },
  },
  {
    key: 'portal.consultas', url: '/client-view/demo-vista-hermosa-portal-token',
    after: async page => { await page.getByRole('tab').nth(2).click(); },
  },
];

for (const lang of LANGS) {
  test(`shots · públicas · ${lang}`, async ({ page, context }, info) => {
    test.setTimeout(600_000);
    const dir = path.join(OUT, lang);
    fs.mkdirSync(dir, { recursive: true });

    // No setSession: these pages have no user. The base still stubs Paddle and
    // pins a language, which the init script below overrides.
    await installHermeticBase(page, {});
    await page.addInitScript(l => {
      try { localStorage.setItem('ofjr_language', l); } catch { /* private mode */ }
    }, lang);
    await installPublicApi(page, lang);

    const missing: string[] = [];
    for (const shot of SHOTS) {
      await page.goto(shot.url);
      await page.waitForTimeout(2600);
      if (shot.after) { await shot.after(page, lang); await page.waitForTimeout(1800); }
      if (shot.section) {
        await page.evaluate(id => {
          document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
        }, shot.section);
        await page.waitForTimeout(1600);
      }
      if (await page.getByText('Unexpected Application Error').isVisible().catch(() => false)) {
        missing.push(shot.key);
      }
      await page.screenshot({ path: path.join(dir, `${shot.key}.png`) });
      fs.writeFileSync(
        path.join(dir, `${shot.key}.txt`),
        await page.locator('body').innerText().catch(() => ''),
      );
      info.annotations.push({ type: 'shot', description: shot.key });
    }
    if (missing.length) throw new Error(`pages that crashed: ${missing.join(', ')}`);
  });
}
