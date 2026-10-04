import { test, expect } from '@playwright/test';
import { installHermeticBase, setSession, json } from './support/mock-api';

const screens = [
  { role: 'ADMIN', path: '/admin/tareas', areas: 6 },
  { role: 'FINANCE', path: '/finance/receivables', areas: 6 },
  { role: 'SUPERVISOR', path: '/supervisor/tareas', areas: 4 },
  { role: 'WORKER', path: '/worker/horas', areas: 4 },
  { role: 'WAREHOUSE', path: '/warehouse/materiales', areas: 4 },
];

test.describe('Web navigation by role', () => {
  for (const screen of screens) {
    test(`${screen.role}: grouped navigation survives a direct link and reload`, async ({ page, context }) => {
      await setSession(context, screen.role); await installHermeticBase(page, { role: screen.role, username: 'tester' });
      await page.goto(screen.path);
      await expect(page.getByRole('navigation', { name: 'Work areas', exact: true }).getByRole('button')).toHaveCount(screen.areas);
      await expect(page.locator('#workspace-content')).toBeVisible();
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`${screen.path}$`));
      await expect(page.getByRole('navigation', { name: 'Work areas', exact: true }).getByRole('button')).toHaveCount(screen.areas);
      await page.screenshot({ path: test.info().outputPath(`${screen.role.toLowerCase()}-web.png`), fullPage: true });
    });
  }
  test('Admin finds a secondary destination with the keyboard and returns with browser back', async ({ page, context }) => {
    await setSession(context, 'ADMIN'); await installHermeticBase(page, { role: 'ADMIN', username: 'tester' });
    await page.goto('/admin/obras?q=escuela');
    await expect(page.getByRole('navigation', { name: 'Work areas' })).toBeVisible();
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Find a section' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Find a section' }).fill('payroll');
    await dialog.getByRole('button', { name: /^Labor Payroll/ }).first().click();
    await expect(page).toHaveURL(/\/admin\/nomina$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/obras\?q=escuela$/);
  });
  test('Admin retains task filters on reload and carries the chosen worksite into budgets', async ({ page, context }) => {
    await setSession(context, 'ADMIN'); await installHermeticBase(page, { role: 'ADMIN', username: 'tester' });
    await page.route('**/api/v1/admin/projects?*', json({ content: [{ id: 13, name: 'Escuela Central' }], totalPages: 1, totalElements: 1 }));
    await page.route('**/api/v1/admin/tasks?*', json({ content: [], totalPages: 1, totalElements: 0 }));
    await page.goto('/admin/tareas?obra=13&q=escuela');
    await expect(page.getByRole('combobox', { name: 'Worksite', exact: true })).toHaveValue('13');
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Worksite', exact: true })).toHaveValue('13');
    await page.getByRole('navigation', { name: 'Work areas' }).getByRole('button', { name: 'Finance', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/cobros\?obra=13$/);
    await page.getByRole('navigation', { name: 'Area sections' }).getByRole('button', { name: 'Budgets', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/presupuestos\?obra=13$/);
  });
  test('A worker cannot use an admin deep link to get an admin workspace', async ({ page, context }) => {
    await setSession(context, 'WORKER'); await installHermeticBase(page, { role: 'WORKER', username: 'tester' });
    await page.goto('/admin/obras');
    await expect(page).toHaveURL(/\/worker\/(dashboard|time)$/);
    await expect(page.getByRole('navigation', { name: 'Work areas' }).getByRole('button')).toHaveCount(4);
  });
  test('Leaving an unfinished expense offers a choice and keeps the form when cancelled', async ({ page, context }) => {
    await setSession(context, 'WORKER'); await installHermeticBase(page, { role: 'WORKER', username: 'tester' });
    await page.goto('/worker/gastos/nuevo');
    await page.getByRole('spinbutton').fill('25');
    const hours = page.getByRole('navigation', { name: 'Work areas' }).getByRole('button', { name: 'My Hours', exact: true });
    await hours.click();
    const warning = page.getByRole('alertdialog', { name: 'You have unsaved changes' });
    await expect(warning).toBeVisible();
    await warning.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/worker\/gastos\/nuevo$/);
    await expect(page.getByRole('spinbutton')).toHaveValue('25');
    await hours.click();
    await warning.getByRole('button', { name: 'Discard and leave' }).click();
    await expect(page).toHaveURL(/\/worker\/horas$/);
  });
  test('Collections distinguish worksites with the same name by ID', async ({ page, context }) => {
    await setSession(context, 'FINANCE'); await installHermeticBase(page, { role: 'FINANCE', username: 'tester' });
    const invoice = { id: 101, documentType: 'INVOICE', invoiceNumber: 'INV-13', client: 'Municipalidad', project: 'Escuela Central', projectId: 13, description: null, issuedDate: '2026-10-01', dueDate: '2026-10-31', subtotal: 100, discount: 0, taxRate: 0, tax: 0, amount: 100, paidAmount: 0, status: 'pending', notes: null, lineItems: [], payments: [], createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z' };
    await page.route('**/api/v1/finance/receivables?*', json({ content: [invoice, { ...invoice, id: 102, projectId: 14, invoiceNumber: 'INV-14' }], totalPages: 1, totalElements: 2 }));
    await page.goto('/finance/receivables?obra=13');
    await expect(page.getByRole('row', { name: /INV-13/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /INV-14/ })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('row', { name: /INV-13/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /INV-14/ })).toHaveCount(0);
  });
  test('An unavailable supervisor feature explains how to return instead of leaving an empty page', async ({ page, context }) => {
    await setSession(context, 'SUPERVISOR'); await installHermeticBase(page, { role: 'SUPERVISOR', username: 'tester' });
    await page.goto('/supervisor/bitacora');
    await expect(page.getByText('This section is unavailable', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to my worksites', exact: true }).click();
    await expect(page).toHaveURL(/\/supervisor\/obras$/);
  });
  test('Site log opens the chosen worksite and protects notes when changing the worksite', async ({ page, context }) => {
    await setSession(context, 'SUPERVISOR'); await installHermeticBase(page, { role: 'SUPERVISOR', username: 'tester' });
    await page.route('**/api/v1/site-logs/feature', json({ enabled: true }));
    await page.route('**/api/v1/supervisor/dashboard/projects', json([{ id: 13, name: 'Escuela Central' }, { id: 14, name: 'Clínica Municipal' }]));
    const log = { id: 1, projectId: 14, projectName: 'Clínica Municipal', workDate: '2026-10-03', authorName: 'Supervisor', status: 'DRAFT', weather: null, temperatureC: null, notes: '', attendance: [], tasksDone: [], photos: [] };
    await page.route('**/api/v1/projects/*/site-logs?date=*', json(log));
    await page.route('**/api/v1/projects/*/site-logs/attendance-suggestion?*', json({ attendance: [], doneTasks: [] }));
    await page.route('**/api/v1/projects/*/site-logs?page=*', json({ content: [{ id: 1, workDate: '2026-10-02', status: 'DRAFT', attendanceCount: 0, tasksDoneCount: 0, photoCount: 0 }], totalPages: 1, totalElements: 1 }));
    await page.goto('/supervisor/bitacora?obra=14&fecha=2026-10-03');
    const project = page.getByRole('combobox', { name: 'Project', exact: true });
    await expect(project).toHaveValue('14');
    const notes = page.locator('textarea');
    await notes.fill('Keep this daily note');
    page.once('dialog', dialog => dialog.dismiss());
    await project.selectOption('13');
    await expect(project).toHaveValue('14');
    await expect(notes).toHaveValue('Keep this daily note');
    await expect(page).toHaveURL(/obra=14/);
    page.once('dialog', dialog => dialog.accept());
    await project.selectOption('13');
    await expect(project).toHaveValue('13');
    await expect(page).toHaveURL(/obra=13/);
    await expect(notes).toHaveValue('');
    await page.goto('/supervisor/bitacora?obra=13&fecha=2026-10-03&vista=history');
    await expect(page.getByRole('button', { name: /^2026-10-02/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /^2026-10-02/ })).toBeVisible();
  });
  test('Spanish desktop preview uses successful task data', async ({ page, context }) => {
    await setSession(context, 'ADMIN'); await installHermeticBase(page, { role: 'ADMIN', username: 'tester' });
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Guatemala' });
    const task = { id: 1, projectId: 13, projectName: 'Escuela Central', title: 'Revisar instalación eléctrica', description: null, status: 'TODO', priority: 'HIGH', assignedToId: 7, assignedToName: 'Ana López', startDate: today, dueDate: today, sortOrder: 0, createdById: 1, createdByName: 'Administrador', createdAt: `${today}T12:00:00Z`, updatedAt: `${today}T12:00:00Z`, commentCount: 0, photoCount: 0, documentCount: 0, historyCount: 1 };
    await page.route('**/api/v1/admin/projects?*', json({ content: [{ id: 13, name: 'Escuela Central', status: 'ACTIVE' }], totalPages: 1, totalElements: 1 }));
    await page.route('**/api/v1/admin/tasks?*', json({ content: [task], totalPages: 1, totalElements: 1 }));
    await page.route('**/api/v1/admin/tasks/summary', json({ open: 1, overdue: 0, dueToday: 1, thisWeek: 1, noDates: 0, unassigned: 0, closedThisWeek: 0, openByProject: { '13': 1 }, openByAssignee: { '7': 1 } }));
    await page.goto('/admin/tareas?obra=13');
    await page.getByRole('button', { name: 'ES', exact: true }).click();
    await expect(page.getByRole('button', { name: `Seleccionar la tarea ${task.title}`, exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('administracion-tareas-es.png'), fullPage: true });
  });
});
