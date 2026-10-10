import { test, expect, type Page } from '@playwright/test';
import { installHermeticBase, setSession, json } from './support/mock-api';

const paged = (content: unknown[], totalPages = 1) => ({ content, page: 0, size: 200, totalPages, totalElements: content.length });
const tool = { id: 1, code: 'PT-014', name: 'Rotomartillo Bosch', category: 'Power Tools', status: 'Available', assignedTo: null, assignedToId: null, projectName: null, dateRegistered: '2026-10-01', lastActivityAt: '2026-10-01T12:00:00Z', notes: null, zone: null, history: [] };
const summary = { total: 1, available: 1, assigned: 0, pendingAcceptance: 0, inReview: 0, damaged: 0, lost: 0 };
const projects = [{ id: 13, name: 'Escuela Central', status: 'ACTIVE', assignedUsers: [], hoursThisWeek: 8, approvedRecordsThisWeek: 1, pendingRecordsThisWeek: 1, teamTotal: 2, teamActiveToday: 1, lastActivityAt: null }];

async function warehouseData(page: Page) {
  await page.route('**/api/v1/warehouse/tools?*', json(paged([tool])));
  await page.route('**/api/v1/warehouse/tools/summary', json(summary));
  await page.route('**/api/v1/warehouse/tools/1/history', json([]));
  await page.route('**/api/v1/warehouse/consumables/summary', json({ total: 1, inStock: 1, lowStock: 0, outOfStock: 0 }));
  await page.route('**/api/v1/warehouse/consumables/search?*', json(paged([{ id: 2, code: 'CS-002', name: 'Cemento', category: 'General', unit: 'sacos', currentStock: 40, minimumStock: 10, status: 'In Stock', lastRestocked: null }])));
  await page.route('**/api/v1/admin/users?*', json(paged([])));
  await page.route('**/api/v1/warehouse/assignments/active', json([]));
  await page.route('**/api/v1/warehouse/assignments/log?*', json(paged([])));
  await page.route('**/api/v1/warehouse/assignments/summary', json({ activeAssignments: 0, assignedToday: 0, returnedToday: 0 }));
}

test.describe('Shared administrator design in web roles', () => {
  for (const screen of [
    { path: '/finance/receivables', title: 'Collect', marker: 'sec.accounts-receivable.rows' },
    { path: '/finance/payables', title: 'Pay', marker: 'sec.accounts-payable.lanes' },
    { path: '/finance/invoices', title: 'Invoices & Change Orders', marker: 'sec.invoices.list' },
  ]) {
    test(`Finance opens the shared screen at ${screen.path}`, async ({ page, context }) => {
      await setSession(context, 'FINANCE');
      await installHermeticBase(page, { role: 'FINANCE', username: 'tester' });
      await page.route('**/api/v1/finance/receivables?*', json(paged([])));
      await page.route('**/api/v1/finance/payables?*', json(paged([])));
      await page.goto(screen.path);
      await expect(page.locator('#workspace-content').getByRole('heading', { name: screen.title, exact: true })).toBeVisible();
      await expect(page.locator(`[data-tour="${screen.marker}"]`)).toBeVisible();
      await page.reload();
      await expect(page.locator(`[data-tour="${screen.marker}"]`)).toBeVisible();
      await page.getByRole('button', { name: 'ES', exact: true }).click();
      await page.screenshot({ path: test.info().outputPath(`${screen.path.split('/').pop()}-es.png`), fullPage: true });
    });
  }

  test('Warehouse uses the shared inventory and keeps its counter actions', async ({ page, context }) => {
    await setSession(context, 'WAREHOUSE');
    await installHermeticBase(page, { role: 'WAREHOUSE', username: 'tester' });
    await warehouseData(page);
    const requests: string[] = [];
    page.on('request', r => requests.push(r.url()));
    await page.goto('/warehouse/inventory');
    await expect(page.getByTestId('tool-row-1')).toContainText(tool.name);
    await page.getByTestId('tool-row-1').click();
    const detail = page.getByRole('dialog');
    await expect(detail).toContainText(tool.code);
    await detail.getByRole('button', { name: 'Assignments and returns', exact: true }).click();
    await expect(page).toHaveURL(/\/warehouse\/asignaciones$/);
    await expect(page.getByRole('button', { name: 'Assign Tool', exact: true })).toBeVisible();
    await page.goto('/warehouse/materiales');
    await expect(page.getByTestId('consumables-figures')).toBeVisible();
    await expect(page.locator('#workspace-content')).toContainText('Cemento');
    await expect(page.getByRole('button', { name: 'Dispatch supplies', exact: true })).toBeVisible();
    expect(requests.some(url => url.includes('/api/v1/admin/tools'))).toBe(false);
    await page.getByRole('button', { name: 'ES', exact: true }).click();
    await page.screenshot({ path: test.info().outputPath('bodega-materiales-es.png'), fullPage: true });
  });

  test('Supervisor uses the shared approval queue and only its assigned worksite records', async ({ page, context }) => {
    await setSession(context, 'SUPERVISOR');
    await installHermeticBase(page, { role: 'SUPERVISOR', username: 'tester' });
    await page.route('**/api/v1/supervisor/dashboard/projects', json(projects));
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Guatemala' });
    const record = { id: 71, workerId: 7, workerUsername: 'ana', workerName: 'Ana López', workerRole: 'WORKER', projectId: 13, projectName: 'Escuela Central', workDate: today, approvalStatus: 'PENDING', pendingEventCount: 0, events: [], reviews: [] };
    await page.route('**/api/v1/time-records/supervisor?*', json(paged([record, { ...record, id: 72, projectId: 14, workerName: 'Other worksite worker' }])));
    await page.route('**/api/v1/time-records/71', json(record));
    const requests: string[] = [];
    page.on('request', r => requests.push(r.url()));
    await page.goto('/supervisor/time-approvals?obra=13');
    await expect(page.locator('[data-tour="sec.time-approvals.queue"]')).toContainText('Ana López');
    await expect(page.locator('[data-tour="sec.time-approvals.queue"]')).not.toContainText('Other worksite worker');
    await expect(page.getByTestId('create-day-button')).toHaveCount(0);
    expect(requests.some(url => /\/api\/v1\/time-records\?/.test(url))).toBe(false);
    await page.getByRole('button', { name: 'ES', exact: true }).click();
    await page.screenshot({ path: test.info().outputPath('supervisor-jornadas-es.png'), fullPage: true });
  });

  test('Warehouse preserves restocking, editing and dispatch history in the shared window', async ({ page, context }) => {
    await setSession(context, 'WAREHOUSE');
    await installHermeticBase(page, { role: 'WAREHOUSE', username: 'tester' });
    await warehouseData(page);
    let supply = { id: 2, code: 'CS-002', name: 'Cemento', category: 'General', unit: 'sacos', currentStock: 40, minimumStock: 10, status: 'In Stock', lastRestocked: null, notes: '' };
    const updates: Record<string, unknown>[] = [];
    const restocks: Record<string, unknown>[] = [];
    await page.route('**/api/v1/warehouse/consumables/search?*', route => json(paged([supply]))(route));
    await page.route('**/api/v1/warehouse/consumables/2/dispatches', json([{ id: 1, project: 'Escuela Central', requestedBy: 'Ana López', date: '2026-10-01', quantity: 5, unit: 'sacos', notes: 'Colado de columnas' }]));
    await page.route('**/api/v1/warehouse/consumables/2', route => {
      const update = route.request().postDataJSON();
      updates.push(update);
      supply = { ...supply, ...update };
      return json(supply)(route);
    });
    // AUD-049: a restock adds a quantity under an intention key; the server applies it.
    await page.route('**/api/v1/warehouse/consumables/2/restock', route => {
      const restock = route.request().postDataJSON();
      restocks.push(restock);
      supply = { ...supply, currentStock: supply.currentStock + Number(restock.quantity) };
      return json(supply)(route);
    });
    await page.goto('/warehouse/materiales');
    await page.getByTestId('consumable-row-2').click();
    const window = page.getByRole('dialog');
    await expect(window).toContainText('Colado de columnas');
    await window.getByRole('spinbutton', { name: 'Quantity to add', exact: true }).fill('20');
    await window.getByRole('button', { name: 'Restock', exact: true }).click();
    await expect.poll(() => restocks[0]).toMatchObject({ quantity: 20 });
    expect(String(restocks[0].requestKey ?? '')).not.toBe('');
    expect(restocks[0]).not.toHaveProperty('currentStock');
    expect(updates).toEqual([]);
    await expect(window).toContainText('Current stock: 60 sacos');
    await window.getByRole('button', { name: 'Edit Item', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit CS-002' });
    await expect(edit.locator('#cs-stock')).toBeDisabled();
    await edit.locator('#cs-name').fill('Cemento Portland');
    await edit.locator('#cs-notes').fill('Almacén principal');
    await edit.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect.poll(() => updates[0]).toMatchObject({ name: 'Cemento Portland', notes: 'Almacén principal' });
    expect(updates[0]).not.toHaveProperty('currentStock');
    await expect(page.getByTestId('consumable-row-2')).toContainText('Cemento Portland');
  });

  test('Supervisor expense totals include all pages and bulk review respects the selected worksite', async ({ page, context }) => {
    await setSession(context, 'SUPERVISOR');
    await installHermeticBase(page, { role: 'SUPERVISOR', username: 'tester' });
    await page.route('**/api/v1/supervisor/dashboard/projects', json(projects));
    await page.route('**/api/v1/admin/users?*', json(paged([])));
    const expense = { id: 1, version: 4, workerId: 7, workerName: 'Ana López', workerUsername: 'ana', projectId: 13, projectName: 'Escuela Central', expenseType: 'MATERIALS', amountCents: 10000, expenseDate: '2026-10-01', description: 'Cemento para la escuela', status: 'PENDING', receiptUrl: null, reviewerId: null, reviewerName: null, reviewerComment: null, reviewedAt: null, createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z' };
    const reviewed: number[] = [];
    await page.route('**/api/v1/supervisor/expenses?*', route => {
      const secondPage = new URL(route.request().url()).searchParams.get('page') === '1';
      const rows = secondPage ? [{ ...expense, id: 2, version: 5, amountCents: 20000 }, { ...expense, id: 3, projectId: 14, projectName: 'Other worksite', description: 'Must stay pending' }] : [expense];
      return json(paged(rows.filter(e => !reviewed.includes(e.id)), 2))(route);
    });
    await page.route('**/api/v1/supervisor/expenses/summary', json({ totalSubmitted: 3, pendingCount: 3, pendingCents: 40000, observedCount: 0, rejectedCount: 0, totalApprovedCents: 0 }));
    // AUD-013 (phase 1): one request with the frozen set and the versions the
    // supervisor saw — never a filter the server re-evaluates.
    const batches: { expenseIds: number[]; expectedVersions: Record<string, number> }[] = [];
    await page.route('**/api/v1/supervisor/expenses/approve-batch', route => {
      const batch = route.request().postDataJSON();
      batches.push(batch);
      reviewed.push(...batch.expenseIds);
      return json({ approvedCount: batch.expenseIds.length, skipped: [], approvedIds: batch.expenseIds, approvedAmountCents: 30000 })(route);
    });
    const requests: string[] = [];
    page.on('request', r => requests.push(r.url()));
    await page.goto('/supervisor/gastos?obra=13');
    await expect(page.getByTestId('expense-row')).toHaveCount(2);
    await expect(page.locator('#workspace-content')).toContainText('$300.00');
    await expect(page.locator('#workspace-content')).not.toContainText('Must stay pending');
    await page.locator('[data-tour="sec.expenses.acciones"]').getByRole('button').click();
    const modal = page.getByRole('dialog', { name: 'Approve in bulk' });
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Approve the 2', exact: true }).click();
    await expect.poll(() => reviewed.slice().sort()).toEqual([1, 2]);
    expect(batches).toHaveLength(1);
    expect(batches[0].expenseIds.slice().sort()).toEqual([1, 2]);
    expect(batches[0].expectedVersions).toEqual({ 1: 4, 2: 5 });
    expect(requests.some(url => url.includes('/api/v1/admin/expenses') || url.includes('/api/v1/admin/projects'))).toBe(false);
    await expect(page.getByRole('dialog')).toContainText('$300.00');
  });

  test('Mobile warehouse retains the shared inventory and navigates to dispatch', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setSession(context, 'WAREHOUSE');
    await installHermeticBase(page, { role: 'WAREHOUSE', username: 'tester' });
    await warehouseData(page);
    await page.goto('/warehouse/materiales');
    await expect(page.getByTestId('consumables-figures')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('bodega-mobile.png'), fullPage: true });
    for (const width of [768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.getByRole('button', { name: 'Dispatch supplies', exact: true }).click();
    await expect(page).toHaveURL(/\/warehouse\/materiales\/despachar$/);
  });
});
