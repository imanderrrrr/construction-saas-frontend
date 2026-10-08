import { expect, test, type Page } from '@playwright/test';
import { installHermeticBase, json, setSession } from './support/mock-api';

const paged = (content: unknown[]) => ({ content, page: 0, size: 100, totalPages: 1, totalElements: content.length });
const supply = { id: 2, code: 'CS-002', name: 'Cemento', category: 'General', unit: 'sacos', currentStock: 100, minimumStock: 10, unitCostCents: 1000, status: 'In Stock', lastRestocked: null, notes: '' };
const project = {
  id: 13, name: 'Escuela Central', status: 'ACTIVE', clientId: null, client: null, costCode: 'CC-13',
  originalContractCents: 1000000, revisedContractCents: 1000000, changeOrdersTotalCents: 0,
  contractAmountCents: 850000, approvedExpensesCents: 50000, totalConsumedCents: 150000,
  costBudgetCents: null, budgetBaseCents: 1000000, remainingBudgetCents: 850000,
  invoicedCents: 0, collectedCents: 0, outstandingCents: 0, address: null,
  latitude: null, longitude: null, geofenceRadiusMeters: 200, assignedUserIds: [],
  createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-07T12:00:00Z',
};

async function warehouse(page: Page) {
  await page.route('**/api/v1/warehouse/consumables/search?*', json(paged([supply])));
  await page.route('**/api/v1/warehouse/consumables/summary', json({ total: 1, inStock: 1, lowStock: 0, outOfStock: 0 }));
  await page.route('**/api/v1/warehouse/consumables?*', json([supply]));
  await page.route('**/api/v1/warehouse/consumables/2/dispatches', json([]));
  await page.route('**/api/v1/warehouse/consumables/dispatches?*', json(paged([])));
  await page.route('**/api/v1/warehouse/projects?*', json(paged([project])));
  await page.route('**/api/v1/admin/users?*', json(paged([{ id: 7, username: 'ana', fullName: 'Ana López', role: 'WORKER', status: 'ACTIVE' }])));
}

test('catalogue editing sends exact cents without changing physical stock', async ({ page, context }) => {
  await setSession(context, 'WAREHOUSE');
  await installHermeticBase(page, { role: 'WAREHOUSE', username: 'tester' });
  await warehouse(page);
  let update: Record<string, unknown> | undefined;
  await page.route('**/api/v1/warehouse/consumables/2', route => {
    update = route.request().postDataJSON();
    return json({ ...supply, ...update })(route);
  });
  await page.goto('/warehouse/materiales');
  await page.getByTestId('consumable-row-2').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit Item', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit CS-002' });
  await expect(edit.locator('#cs-unit-cost')).toHaveValue('10.00');
  await edit.locator('#cs-unit-cost').fill('12.34');
  await edit.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect.poll(() => update?.unitCostCents).toBe(1234);
  expect(update).not.toHaveProperty('currentStock');
});

test('dispatch shows the catalogue estimate and sends the project and quantity', async ({ page, context }) => {
  await setSession(context, 'WAREHOUSE');
  await installHermeticBase(page, { role: 'WAREHOUSE', username: 'tester' });
  await warehouse(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/v1/warehouse/consumables/dispatch', route => {
    submitted = route.request().postDataJSON();
    return json({ id: 41, ...submitted, consumableCode: supply.code, consumableName: supply.name, unit: 'sacos', unitCostCents: 1000, totalCostCents: 50000, date: '2026-10-07' }, 201)(route);
  });
  await page.goto('/warehouse/materiales/despachar');
  await page.locator('#workspace-content').getByRole('button', { name: 'Dispatch Supply', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').nth(0).click();
  await page.getByRole('option', { name: /CS-002/ }).click();
  await dialog.getByRole('spinbutton').fill('50');
  await expect(dialog).toContainText('50 × $10.00 = $500.00');
  await expect(dialog).toContainText('automatically be charged');
  await dialog.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'Escuela Central', exact: true }).click();
  await dialog.locator('[role="combobox"]').nth(2).click();
  await page.getByRole('option', { name: 'Ana López', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('warehouse-cost.png') });
  await dialog.getByRole('button', { name: 'Dispatch', exact: true }).click();
  await expect.poll(() => submitted).toMatchObject({ consumableCode: 'CS-002', quantity: 50, projectId: 13, requestedById: 7 });
  expect(submitted).not.toHaveProperty('unitCostCentsOverride');
  expect(submitted).not.toHaveProperty('budgetLineItemId');
});

test('finance reads all five ledger sources and exports only the visible projects', async ({ page, context }) => {
  await setSession(context, 'FINANCE');
  await installHermeticBase(page, { role: 'FINANCE', username: 'tester' });
  await page.route('**/api/v1/finance/projects?*', json(paged([project])));
  const amounts = { payrollCents: 10000, subcontractorCents: 20000, supplierCents: 30000, warehouseCents: 40000, expenseCents: 50000, totalConsumedCents: 150000 };
  await page.route('**/api/v1/finance/budgets/consumption-breakdown', json({ computedAt: '2026-10-07T12:00:00Z', projects: [{ projectId: 13, projectName: project.name, ...amounts }], totals: amounts }));
  let exportUrl = '';
  await page.route('**/api/v1/finance/budgets/report/export?*', route => {
    exportUrl = route.request().url();
    return route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'Content-Disposition': 'attachment; filename="job-costing.pdf"', 'Access-Control-Expose-Headers': 'Content-Disposition' }, body: '%PDF-1.4\n%%EOF' });
  });
  await page.goto('/finance/budgets');
  await page.getByRole('tab', { name: 'Report', exact: true }).click();
  await page.getByRole('button', { name: /Escuela Central.*\$10,000/ }).click();
  for (const label of ['Own labour (payroll)', 'Subcontractors', 'Suppliers / Purchases', 'Warehouse materials', 'Field expenses']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  for (const amount of ['$100.00', '$200.00', '$300.00', '$400.00', '$500.00']) {
    await expect(page.getByText(amount, { exact: true }).first()).toBeVisible();
  }
  await page.screenshot({ path: test.info().outputPath('budget-five-sources.png'), fullPage: true });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: /PDF/ }).click();
  expect((await download).suggestedFilename()).toBe('job-costing.pdf');
  expect(new URL(exportUrl).searchParams.get('projectIds')).toBe('13');
});

test('payables distinguishes linked subcontractor invoices on desktop and mobile', async ({ page, context }) => {
  await setSession(context, 'FINANCE');
  await installHermeticBase(page, { role: 'FINANCE', username: 'tester' });
  const bill = { id: 91, billNumber: 'SUB-SC-100', vendor: 'Ana Subcontratista', category: 'subcontractor', projectId: 13, project: project.name, description: 'Instalación', receivedDate: '2026-10-01', dueDate: '2026-10-08', amount: 5000, paidAmount: 0, status: 'pending', documentType: 'INVOICE', invoiceNumber: 'SC-100', notes: null, createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-07T12:00:00Z', payments: [], attachmentCount: 0, subcontractorInvoiceId: 71, subcontractorInvoiceNumber: 'SC-100' };
  await page.route('**/api/v1/finance/payables?*', json(paged([bill])));
  await page.route('**/api/v1/finance/receivables?*', json(paged([])));
  await page.route('**/api/v1/finance/payables/vendors', json([]));
  await page.route('**/api/v1/finance/projects?*', json(paged([project])));
  await page.route('**/api/v1/admin/projects?*', json(paged([project])));
  await page.goto('/finance/payables');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const badge = page.getByText('Subcontractor', { exact: true }).filter({ visible: true });
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/text-violet-700/);
    await expect(page.getByText('Subcontractor invoice #SC-100', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.locator('#workspace-content')).not.toContainText('NaN');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: test.info().outputPath('subcontractor-payable-mobile.png'), fullPage: true });
});
