import { expect, test, type Page } from '@playwright/test';
import { installHermeticBase, json, setSession } from './support/mock-api';

const paged = (content: unknown[]) => ({ content, page: 0, size: 100, totalPages: 1, totalElements: content.length });
const project = {
  id: 13, name: 'Escuela Central', status: 'ACTIVE', clientId: null, client: null, costCode: 'CC-13',
  originalContractCents: 1000000, revisedContractCents: 1000000, changeOrdersTotalCents: 0,
  contractAmountCents: 850000, approvedExpensesCents: 0, totalConsumedCents: 150000,
  costBudgetCents: 1000000, budgetBaseCents: 1000000, remainingBudgetCents: 850000,
  invoicedCents: 0, collectedCents: 0, outstandingCents: 0, address: null,
  latitude: null, longitude: null, geofenceRadiusMeters: 200, assignedUserIds: [],
  createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-07T12:00:00Z',
};
const pillars = { payrollCents: 1000, subcontractorCents: 2000, supplierCents: 3000, warehouseCents: 4000, expenseCents: 5000 };
const line = (id: number, code: string, name: string, spentCents: number, varianceStatus: string) => ({
  id, projectId: 13, code, name, category: 'GENERAL', unit: 'GLB', quantity: 1, unitCostCents: 100000,
  originalBudgetCents: 100000, changeOrdersCents: 0, revisedBudgetCents: 100000, spentCents,
  committedCents: 0, balanceCents: 100000 - spentCents, consumptionPct: spentCents / 1000,
  varianceStatus, spendByPillar: { ...pillars, warehouseCents: spentCents - 11000 }, notes: null,
});
const items = [line(51, '01.01', 'Excavación', 15000, 'OK'), line(52, '01.02', 'Cimentación', 85000, 'WARNING'), line(53, '02.01', 'Estructura', 120000, 'OVER_BUDGET')];
const summary = { projectId: 13, totalOriginalBudgetCents: 300000, totalRevisedBudgetCents: 300000,
  totalSpentCents: 220000, totalCommittedCents: 0, totalBalanceCents: 80000,
  globalConsumptionPct: 220 / 3, itemsCount: 3, warningCount: 1, overBudgetCount: 1, items };

async function budgetMocks(page: Page, role: 'ADMIN' | 'FINANCE') {
  const plane = role === 'FINANCE' ? 'finance' : 'admin';
  await page.route(`**/api/v1/${plane}/projects?*`, json(paged([project])));
  await page.route('**/api/v1/finance/payables?*', json(paged([])));
  await page.route(`**/api/v1/${plane}/budgets/consumption-breakdown`, json({ projects: [{ projectId: 13, ...pillars, totalConsumedCents: 150000 }], totals: { ...pillars, totalConsumedCents: 150000 } }));
  await page.route(`**/api/v1/${plane}/projects/13/budget-line-items/summary`, json(summary));
}

test('finance can audit WBS risk and five pillars on desktop and mobile without write actions', async ({ page, context }) => {
  await setSession(context, 'FINANCE');
  await installHermeticBase(page, { role: 'FINANCE', username: 'tester' });
  await budgetMocks(page, 'FINANCE');
  await page.goto('/finance/budgets');
  await page.getByRole('button', { name: /Escuela Central/ }).first().click();
  await page.getByRole('tab', { name: /WBS/ }).click();
  const grid = page.getByTestId('budget-wbs-grid');
  await expect(grid.getByText('Excavación', { exact: true })).toBeVisible();
  await expect(grid).toContainText('85 %');
  await expect(grid).toContainText('120 %');
  await expect(grid).toContainText('-$200.00');
  await expect(grid.getByRole('button', { name: /New|Import|Edit|Delete/ })).toHaveCount(0);
  await grid.getByRole('button', { name: '01.01', exact: true }).click();
  for (const amount of ['$10.00', '$20.00', '$30.00', '$40.00', '$50.00']) {
    await expect(grid.locator('#wbs-pillars-51').getByText(amount, { exact: true })).toBeVisible();
  }
  await page.screenshot({ path: test.info().outputPath('wbs-finance-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(grid.getByRole('button', { name: '01.01', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(grid).not.toContainText('NaN');
  await page.screenshot({ path: test.info().outputPath('wbs-finance-mobile.png'), fullPage: true, animations: 'disabled' });
});

test('warehouse optional cost code reaches the dispatch request with exact project attribution', async ({ page, context }) => {
  await setSession(context, 'WAREHOUSE');
  await installHermeticBase(page, { role: 'WAREHOUSE', username: 'tester' });
  const supply = { id: 2, code: 'CS-002', name: 'Cemento', category: 'General', unit: 'sacos', currentStock: 100, minimumStock: 10, unitCostCents: 1000, status: 'In Stock', notes: '' };
  await page.route('**/api/v1/warehouse/consumables?*', json([supply]));
  await page.route('**/api/v1/warehouse/consumables/dispatches?*', json(paged([])));
  await page.route('**/api/v1/warehouse/projects?*', json(paged([project])));
  await page.route('**/api/v1/admin/users?*', json(paged([{ id: 7, username: 'ana', fullName: 'Ana López', role: 'WORKER', status: 'ACTIVE' }])));
  await page.route('**/api/v1/projects/13/budget-line-items/options', json(items.map(({ id, code, name }) => ({ id, code, name }))));
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/v1/warehouse/consumables/dispatch', route => {
    submitted = route.request().postDataJSON();
    return json({ id: 41, ...submitted, consumableCode: supply.code, consumableName: supply.name, unit: 'sacos', unitCostCents: 1000, totalCostCents: 2000, date: '2026-10-07' }, 201)(route);
  });
  await page.goto('/warehouse/materiales/despachar');
  await page.locator('#workspace-content').getByRole('button', { name: 'Dispatch Supply', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[role="combobox"]').nth(0).click();
  await page.getByRole('option', { name: /CS-002/ }).click();
  await dialog.getByRole('spinbutton').fill('2');
  await dialog.locator('[role="combobox"]').nth(1).click();
  await page.getByRole('option', { name: 'Escuela Central', exact: true }).click();
  await dialog.getByTestId('budget-line-item-select').selectOption('52');
  await dialog.locator('[role="combobox"]').nth(2).click();
  await page.getByRole('option', { name: 'Ana López', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('wbs-warehouse-attribution.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Dispatch', exact: true }).click();
  await expect.poll(() => submitted).toMatchObject({ consumableCode: 'CS-002', quantity: 2, projectId: 13, requestedById: 7, budgetLineItemId: 52 });
});

test('admin creates a measured item and imports an Excel paste with exact cents', async ({ page, context }) => {
  await setSession(context, 'ADMIN');
  await installHermeticBase(page, { role: 'ADMIN', username: 'tester' });
  await budgetMocks(page, 'ADMIN');
  let created: Record<string, unknown> | undefined;
  let imported: Record<string, unknown> | undefined;
  await page.route('**/api/v1/admin/projects/13/budget-line-items', route => {
    created = route.request().postDataJSON();
    return json({ ...items[0], ...created, id: 54 }, 201)(route);
  });
  await page.route('**/api/v1/admin/projects/13/budget-line-items/bulk', route => {
    imported = route.request().postDataJSON();
    return json([], 201)(route);
  });
  await page.goto('/admin/presupuestos');
  await page.getByRole('button', { name: /Escuela Central/ }).first().click();
  await page.getByRole('tab', { name: /WBS/ }).click();
  const grid = page.getByTestId('budget-wbs-grid');
  await grid.getByRole('button', { name: /New line item/ }).click();
  const editor = page.getByRole('dialog', { name: 'New line item', exact: true });
  await editor.locator('#wbs-code').fill('03.01');
  await editor.locator('#wbs-name').fill('Albañilería');
  await editor.locator('#wbs-quantity').fill('2.5');
  await editor.locator('#wbs-unit-cost').fill('12.34');
  await editor.getByRole('button', { name: 'Save line item', exact: true }).click();
  await expect.poll(() => created).toMatchObject({ code: '03.01', name: 'Albañilería', quantity: 2.5, unitCostCents: 1234 });
  expect(created).not.toHaveProperty('originalBudgetCents');
  await grid.getByRole('button', { name: /Import CSV/ }).click();
  const importer = page.getByRole('dialog', { name: 'Import line items', exact: true });
  await importer.locator('#wbs-import-source').fill('Código\tNombre\tCategoría\tMonto\n04.01\tMuros\tMATERIAL\t1200.34\n04.02\tMontaje\tSUBCONTRACTOR\t25.01');
  await expect(importer).toContainText('$1,225.35');
  await page.screenshot({ path: test.info().outputPath('wbs-admin-import.png'), animations: 'disabled' });
  await importer.getByRole('button', { name: /Import 2/ }).click();
  await expect.poll(() => imported).toMatchObject({ items: [
    { code: '04.01', name: 'Muros', category: 'MATERIAL', originalBudgetCents: 120034 },
    { code: '04.02', name: 'Montaje', category: 'SUBCONTRACTOR', originalBudgetCents: 2501 },
  ] });
});
