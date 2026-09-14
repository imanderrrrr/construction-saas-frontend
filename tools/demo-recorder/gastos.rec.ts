import { test } from '@playwright/test';
import { stage, openSection } from './support/stage';

// Análisis: las tres pantallas de gastos tal como están hoy.
const SHOT = (n: string) => ({ path: `tools/demo-recorder/.shots/gastos-${n}.png`, fullPage: true });

test('gastos: las tres pantallas', async ({ page, context }) => {
  await stage(page, context, { lang: 'es' });

  await openSection(page, 'expenses');
  await page.waitForTimeout(1500);
  await page.screenshot(SHOT('todos'));
  // Una fila abierta: el detalle y los tres botones de revisión.
  await page.getByText('Manuel Ramírez').first().click();
  await page.waitForTimeout(1200);
  await page.screenshot(SHOT('todos-detalle'));

  await openSection(page, 'expense-report');
  await page.waitForTimeout(2000);
  await page.screenshot(SHOT('reporte'));
  const fila = page.getByText('Residencial Vista Hermosa II').first();
  if (await fila.count()) { await fila.click(); await page.waitForTimeout(1200); await page.screenshot(SHOT('reporte-desglose')); }

  await openSection(page, 'office-expenses');
  await page.waitForTimeout(1800);
  await page.screenshot(SHOT('oficina'));
});
