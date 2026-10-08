import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { installHermeticBase, setSession, json } from './support/mock-api';

const paged = (content: unknown[], totalPages = 1) => ({ content, page: 0, size: 200, totalPages, totalElements: content.length });
const invoice = { id: 101, documentType: 'INVOICE', invoiceNumber: 'INV-101', client: 'Cliente vencido', project: 'Los Pinos', projectId: 13, description: null, issuedDate: '2026-09-01', dueDate: '2026-09-30', subtotal: 10000, discount: 0, taxRate: 0, tax: 0, amount: 10000, paidAmount: 4000, status: 'partial', notes: null, lineItems: [], payments: [{ id: 1, amount: 4000, date: '2026-10-02', method: 'bank' }], createdAt: '2026-09-01T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z' };
const bill = { id: 201, documentType: 'BILL', billNumber: 'B-201', invoiceNumber: null, vendor: 'Materiales Demo', category: 'MATERIALS', project: 'Los Pinos', projectId: 13, description: null, receivedDate: '2026-10-01', dueDate: '2026-10-14', amount: 8000, paidAmount: 3000, status: 'partial', notes: null, payments: [{ id: 1, amount: 3000, date: '2026-10-02', method: 'bank' }], createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z' };

async function prepare(page: Page, context: BrowserContext, seen = true) {
  await setSession(context, 'FINANCE'); await installHermeticBase(page, { role: 'FINANCE', username: 'tester' });
  await page.clock.setFixedTime(new Date('2026-10-07T18:00:00Z'));
  if (seen) await page.addInitScript(() => localStorage.setItem('bt.sectiontour.v1.tester.finance-overview', '1'));
  await page.route('**/api/v1/finance/receivables?*', json(paged([invoice, { ...invoice, id: 102, invoiceNumber: 'INV-102', client: 'Cliente saldado', amount: 5000, paidAmount: 5000, status: 'paid', payments: [{ id: 2, amount: 5000, date: '2026-10-01', method: 'bank' }] }])));
  await page.route(/\/api\/v1\/finance\/receivables\?.*status=pending_approval/, json(paged([])));
  await page.route('**/api/v1/finance/payables?*', json(paged([bill])));
  await page.route('**/api/v1/finance/projects?*', json(paged([{ id: 13, name: 'Los Pinos' }])));
  await page.route('**/api/v1/finance/expenses?*', json(paged([])));
}

test('Finance shows overdue balances, seven-day payments and actual monthly movement', async ({ page, context }) => {
  await prepare(page, context); await page.goto('/finance/dashboard');
  await expect(page.locator('header select')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Overdue collections', exact: true })).toContainText('$6,000.00');
  await expect(page.getByRole('region', { name: 'Payments in the next 7 days', exact: true })).toContainText('$5,000.00');
  await expect(page.getByTestId('finance-figure-collections')).toContainText('$9,000.00');
  await expect(page.getByTestId('finance-figure-paid')).toContainText('$3,000.00');
  await expect(page.getByTestId('finance-month-net')).toContainText('$6,000.00');
  await expect(page.getByRole('region', { name: 'Monthly income and expenses' })).toContainText('not your bank balance');
  await page.getByRole('region', { name: 'Overdue collections', exact: true }).getByRole('button', { name: /Cliente vencido/ }).click();
  await expect(page).toHaveURL(/\/finance\/receivables\?/);
  expect(new URL(page.url()).searchParams.get('registro')).toBe('101');
  expect(new URL(page.url()).searchParams.get('obra')).toBeNull();
  await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toBeVisible();
});

test('Finance tutorial starts on first visit and can replay all four steps', async ({ page, context }) => {
  await prepare(page, context, false); await page.goto('/finance/dashboard');
  const titles = ['What remains to collect and pay', 'Start with overdue collections', 'Prepare upcoming payments', 'How the monthly comparison works'];
  for (let i = 0; i < titles.length; i += 1) {
    const dialog = page.getByRole('dialog', { name: titles[i], exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`${i + 1} of 4`);
    await dialog.getByRole('button', { name: i === 3 ? 'Done!' : 'Next', exact: true }).click();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'View guide', exact: true }).click();
  await expect(page.getByRole('dialog', { name: titles[0], exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Skip tour', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('finance-overview-desktop.png'), fullPage: true });
});

test('Finance overview and its guide remain usable on a phone', async ({ page, context }) => {
  await prepare(page, context); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/finance/dashboard');
  await expect(page.getByTestId('finance-month-net')).toContainText('$6,000.00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'View guide', exact: true }).click();
  await expect(page.getByText('Finance — what needs attention and how the month is going', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('finance-overview-mobile.png'), fullPage: true });
});
