import { test, type Page } from '@playwright/test';
import { stage, openSection } from './support/stage';
import { beginScene, endScene } from './support/clip';
import { click, hideCursor, moveTo, scroll } from './support/cursor';
import type { Lang } from './support/routes';

// One test = one clip of the landing page's Videos block, recorded once per
// language. The choreography is deliberately slow: these loop silently at a
// third of a screen's width, so a viewer needs a beat to read each thing
// before the next move.
//
// Selectors that depend on copy live in WORDS. Everything else is picked by a
// stable id, a role, or the jobsite's own name, which does not translate.

const LANGS: Lang[] = ['es', 'en'];
const PROJECT = 'Residencial Vista Hermosa II';

const WORDS: Record<Lang, Record<string, RegExp>> = {
  es: {
    search:     /buscar por nombre/i,
    moneyBand:  /requiere atención/i,
    tabMoney:   /^dinero/i,
    tabPunch:   /^pendientes/i,
    tabRfi:     /^consultas/i,
    tabPortal:  /^portal/i,
    comments:   /^comentarios/i,
    responses:  /^respuestas/i,
    copyLink:   /copiar enlace/i,
    statusList: /^estado$/i,
  },
  en: {
    search:     /search by name/i,
    moneyBand:  /needs attention/i,
    tabMoney:   /^money/i,
    tabPunch:   /^punch list/i,
    tabRfi:     /^rfis/i,
    tabPortal:  /^portal/i,
    comments:   /^comments/i,
    responses:  /^responses/i,
    copyLink:   /copy link/i,
    statusList: /^status$/i,
  },
};

for (const lang of LANGS) {
  const w = WORDS[lang];

  /** Projects → the ficha of the demo jobsite, before the clip starts. */
  async function openFicha(page: Page, tab?: RegExp) {
    await openSection(page, 'projects');
    await page.getByText(PROJECT).first().click();
    await page.waitForSelector('[role="tab"]');
    await page.waitForTimeout(900);
    if (tab) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(1200);
    }
  }

  test(`panel · ${lang}`, async ({ page, context }, info) => {
    const t0 = Date.now();
    await stage(page, context, { lang });
    await openSection(page, 'dashboard');
    await hideCursor(page);
    const start = await beginScene(page, t0, 1400);

    await moveTo(page, page.getByText(w.moneyBand).first(), 900);
    await page.waitForTimeout(1400);
    await scroll(page, 520);
    await page.waitForTimeout(1600);
    await scroll(page, 560);
    await page.waitForTimeout(1800);
    await scroll(page, -1080, 16, 35);
    await page.waitForTimeout(900);

    await endScene(page, info, 'panel', lang, t0, start);
  });

  test(`proyectos · ${lang}`, async ({ page, context }, info) => {
    const t0 = Date.now();
    await stage(page, context, { lang });
    await openSection(page, 'projects');
    await hideCursor(page);
    const start = await beginScene(page, t0, 1400);

    const search = page.getByPlaceholder(w.search);
    await moveTo(page, search, 700);
    await search.click();
    await search.pressSequentially('vista', { delay: 190 });
    await page.waitForTimeout(1700);
    await search.press('Control+a');
    await search.press('Backspace');
    await page.waitForTimeout(1300);

    await click(page, page.getByText(PROJECT).first(), { after: 2200 });
    await hideCursor(page);
    await page.waitForTimeout(1600);
    await scroll(page, 320, 10, 45);
    await page.waitForTimeout(1500);

    await endScene(page, info, 'proyectos', lang, t0, start);
  });

  test(`contrato · ${lang}`, async ({ page, context }, info) => {
    const t0 = Date.now();
    await stage(page, context, { lang });
    await openFicha(page);
    const start = await beginScene(page, t0, 900);

    await click(page, page.getByRole('tab', { name: w.tabMoney }), { after: 2400 });
    await hideCursor(page);
    await page.waitForTimeout(1500);
    await scroll(page, 420, 12, 45);
    await page.waitForTimeout(2200);
    await scroll(page, 300, 10, 45);
    await page.waitForTimeout(1800);

    await endScene(page, info, 'contrato', lang, t0, start);
  });

  test(`presupuestos · ${lang}`, async ({ page, context }, info) => {
    const t0 = Date.now();
    await stage(page, context, { lang });
    await openSection(page, 'budgets');
    await hideCursor(page);
    const start = await beginScene(page, t0, 1400);

    await page.waitForTimeout(1600);
    await scroll(page, 330, 10, 45);
    await page.waitForTimeout(2000);
    await scroll(page, 320, 10, 45);
    await page.waitForTimeout(1800);
    await scroll(page, -650, 14, 35);
    await click(page, page.locator('#bt-budgets-tab-report'), { after: 2600 });
    await hideCursor(page);
    await page.waitForTimeout(1600);
    await scroll(page, 360, 10, 45);
    await page.waitForTimeout(1800);

    await endScene(page, info, 'presupuestos', lang, t0, start);
  });

  test(`facturas · ${lang}`, async ({ page, context }, info) => {
    const t0 = Date.now();
    await stage(page, context, { lang });
    await openSection(page, 'invoices');
    await hideCursor(page);
    const start = await beginScene(page, t0, 1400);

    await page.waitForTimeout(1500);
    await scroll(page, 300, 10, 45);
    await page.waitForTimeout(1900);
    await scroll(page, -300, 10, 40);

    const status = page.getByLabel(w.statusList).first();
    await moveTo(page, status, 700);
    await status.selectOption('PENDING_APPROVAL');
    await page.waitForTimeout(2400);
    await scroll(page, 260, 8, 45);
    await page.waitForTimeout(1800);

    await endScene(page, info, 'facturas', lang, t0, start);
  });

  test(`pendientes · ${lang}`, async ({ page, context }, info) => {
    const t0 = Date.now();
    await stage(page, context, { lang });
    await openFicha(page, w.tabPunch);
    await hideCursor(page);
    const start = await beginScene(page, t0, 1000);

    await scroll(page, 260, 8, 45);
    await page.waitForTimeout(2200);
    await click(page, page.getByRole('button', { name: w.comments }).first(), { after: 2400 });
    await hideCursor(page);
    await page.waitForTimeout(1600);
    await scroll(page, 300, 10, 45);
    await page.waitForTimeout(1800);

    await endScene(page, info, 'pendientes', lang, t0, start);
  });

  test(`consultas · ${lang}`, async ({ page, context }, info) => {
    const t0 = Date.now();
    await stage(page, context, { lang });
    await openFicha(page, w.tabRfi);
    await hideCursor(page);
    const start = await beginScene(page, t0, 1000);

    await scroll(page, 260, 8, 45);
    await page.waitForTimeout(2200);
    await click(page, page.getByRole('button', { name: w.responses }).first(), { after: 2400 });
    await hideCursor(page);
    await page.waitForTimeout(1800);
    await scroll(page, 340, 10, 45);
    await page.waitForTimeout(1800);

    await endScene(page, info, 'consultas', lang, t0, start);
  });

  test(`portal · ${lang}`, async ({ page, context }, info) => {
    const t0 = Date.now();
    await stage(page, context, { lang });
    await openFicha(page, w.tabPortal);
    await hideCursor(page);
    const start = await beginScene(page, t0, 1200);

    await page.waitForTimeout(1800);
    await click(page, page.getByRole('button', { name: w.copyLink }), { after: 2400 });
    await hideCursor(page);
    await scroll(page, 320, 10, 45);
    await page.waitForTimeout(2000);

    await endScene(page, info, 'portal', lang, t0, start);
  });
}
