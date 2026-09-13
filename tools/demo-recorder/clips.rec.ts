import { test, type Page } from '@playwright/test';
import { stage, openSection } from './support/stage';
import { beginScene, endScene } from './support/clip';
import { click, hideCursor, moveTo, scroll } from './support/cursor';

// One test = one clip of the landing page's Videos block. The choreography is
// deliberately slow: these loop silently at a third of a screen's width, so a
// viewer needs a beat to read each thing before the next move.

const PROJECT = 'Residencial Vista Hermosa II';

/** Projects → the ficha of the demo jobsite, before the clip starts. */
async function openFicha(page: Page, tab?: string) {
  await openSection(page, 'projects');
  await page.getByText(PROJECT).first().click();
  await page.waitForSelector('role=tab[name=/resumen/i]');
  await page.waitForTimeout(900);
  if (tab) {
    await page.getByRole('tab', { name: new RegExp(tab, 'i') }).click();
    await page.waitForTimeout(1200);
  }
}

test('panel', async ({ page, context }, info) => {
  const t0 = Date.now();
  await stage(page, context);
  await openSection(page, 'dashboard');
  await hideCursor(page);
  const start = await beginScene(page, t0, 1400);

  await moveTo(page, page.getByText(/REQUIERE ATENCIÓN/i).first(), 900);
  await page.waitForTimeout(1400);
  await scroll(page, 520);
  await page.waitForTimeout(1600);
  await scroll(page, 560);
  await page.waitForTimeout(1800);
  await scroll(page, -1080, 16, 35);
  await page.waitForTimeout(900);

  await endScene(page, info, 'panel', t0, start);
});

test('proyectos', async ({ page, context }, info) => {
  const t0 = Date.now();
  await stage(page, context);
  await openSection(page, 'projects');
  await hideCursor(page);
  const start = await beginScene(page, t0, 1400);

  const search = page.getByPlaceholder(/buscar por nombre/i);
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

  await endScene(page, info, 'proyectos', t0, start);
});

test('contrato', async ({ page, context }, info) => {
  const t0 = Date.now();
  await stage(page, context);
  await openFicha(page);
  const start = await beginScene(page, t0, 900);

  await click(page, page.getByRole('tab', { name: /dinero/i }), { after: 2400 });
  await hideCursor(page);
  await page.waitForTimeout(1500);
  await scroll(page, 420, 12, 45);
  await page.waitForTimeout(2200);
  await scroll(page, 300, 10, 45);
  await page.waitForTimeout(1800);

  await endScene(page, info, 'contrato', t0, start);
});

test('presupuestos', async ({ page, context }, info) => {
  const t0 = Date.now();
  await stage(page, context);
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

  await endScene(page, info, 'presupuestos', t0, start);
});

test('facturas', async ({ page, context }, info) => {
  const t0 = Date.now();
  await stage(page, context);
  await openSection(page, 'invoices');
  await hideCursor(page);
  const start = await beginScene(page, t0, 1400);

  await page.waitForTimeout(1500);
  await scroll(page, 300, 10, 45);
  await page.waitForTimeout(1900);
  await scroll(page, -300, 10, 40);

  const status = page.getByLabel(/estado/i).first();
  await moveTo(page, status, 700);
  await status.selectOption('PENDING_APPROVAL');
  await page.waitForTimeout(2400);
  await scroll(page, 260, 8, 45);
  await page.waitForTimeout(1800);

  await endScene(page, info, 'facturas', t0, start);
});

test('pendientes', async ({ page, context }, info) => {
  const t0 = Date.now();
  await stage(page, context);
  await openFicha(page, 'pendientes');
  await hideCursor(page);
  const start = await beginScene(page, t0, 1000);

  await scroll(page, 260, 8, 45);
  await page.waitForTimeout(2200);
  await click(page, page.getByRole('button', { name: /comentarios/i }).first(), { after: 2400 });
  await hideCursor(page);
  await page.waitForTimeout(1600);
  await scroll(page, 300, 10, 45);
  await page.waitForTimeout(1800);

  await endScene(page, info, 'pendientes', t0, start);
});

test('consultas', async ({ page, context }, info) => {
  const t0 = Date.now();
  await stage(page, context);
  await openFicha(page, 'consultas');
  await hideCursor(page);
  const start = await beginScene(page, t0, 1000);

  await scroll(page, 260, 8, 45);
  await page.waitForTimeout(2200);
  await click(page, page.getByRole('button', { name: /respuestas/i }).first(), { after: 2400 });
  await hideCursor(page);
  await page.waitForTimeout(1800);
  await scroll(page, 340, 10, 45);
  await page.waitForTimeout(1800);

  await endScene(page, info, 'consultas', t0, start);
});

test('portal', async ({ page, context }, info) => {
  const t0 = Date.now();
  await stage(page, context);
  await openFicha(page, 'portal');
  await hideCursor(page);
  const start = await beginScene(page, t0, 1200);

  await page.waitForTimeout(1800);
  await click(page, page.getByRole('button', { name: /copiar enlace/i }), { after: 2400 });
  await hideCursor(page);
  await scroll(page, 320, 10, 45);
  await page.waitForTimeout(2000);

  await endScene(page, info, 'portal', t0, start);
});
