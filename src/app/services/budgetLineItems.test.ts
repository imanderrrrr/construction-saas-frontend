import { beforeEach, describe, expect, it, vi } from 'vitest';
const { api, apiMultipart } = vi.hoisted(() => ({ api: vi.fn(), apiMultipart: vi.fn() }));
vi.mock('../lib/api', () => ({ api, apiMultipart, getBaseUrl: () => '' }));
import { bulkImportLineItems, createLineItem, deleteLineItem, getWbsSummary, listLineItemOptions, listLineItems, updateLineItem } from './budgetLineItems';
import { createPayable, recordPayablePayment } from './finance';
import { dispatchConsumable } from './warehouse';
import { createExpense } from './expenses';
import { reviewInvoice } from './subcontractors';

beforeEach(() => { vi.clearAllMocks(); api.mockResolvedValue({}); apiMultipart.mockResolvedValue({}); });

describe('WBS API role and request contracts', () => {
  it('uses admin full financial reads and FINANCE-only read paths', async () => {
    await listLineItems(7); await listLineItems(7, true); await getWbsSummary(7, true);
    expect(api.mock.calls.map(call => call[0])).toEqual([
      '/api/v1/admin/projects/7/budget-line-items',
      '/api/v1/finance/projects/7/budget-line-items',
      '/api/v1/finance/projects/7/budget-line-items/summary',
    ]);
  });
  it('uses the minimal project-authorized selector endpoint', async () => {
    await listLineItemOptions(7);
    expect(api).toHaveBeenCalledWith('/api/v1/projects/7/budget-line-items/options');
  });
  it('wraps bulk import in the backend transaction contract', async () => {
    const items = [{ code: '01.01', name: 'Foundation', originalBudgetCents: 8000000 }];
    await createLineItem(7, items[0]); await bulkImportLineItems(7, items); await updateLineItem(9, { changeOrdersCents: -100 }); await deleteLineItem(9);
    expect(api.mock.calls.map(([url, request]) => [url, request.method, request.body ? JSON.parse(request.body) : null])).toEqual([
      ['/api/v1/admin/projects/7/budget-line-items', 'POST', items[0]],
      ['/api/v1/admin/projects/7/budget-line-items/bulk', 'POST', { items }],
      ['/api/v1/admin/budget-line-items/9', 'PUT', { changeOrdersCents: -100 }],
      ['/api/v1/admin/budget-line-items/9', 'DELETE', null],
    ]);
  });
  it('carries optional attribution through warehouse, AP payment and invoice approval', async () => {
    await dispatchConsumable({ consumableCode: 'DIESEL', quantity: 5, projectId: 7, budgetLineItemId: 9 });
    await createPayable({ vendor: 'Vendor', category: 'Materials', projectId: 7, amount: 10.01, receivedDate: '2026-10-07', dueDate: '2026-10-08', budgetLineItemId: 9 });
    await recordPayablePayment(1, { amount: 10.01, date: '2026-10-07', method: 'Cash', budgetLineItemId: 9 });
    await reviewInvoice(1, { action: 'APPROVE', budgetLineItemId: 9 });
    for (const [, request] of api.mock.calls) expect(JSON.parse(request.body).budgetLineItemId).toBe(9);
    expect(JSON.parse(api.mock.calls[1][1].body).amountCents).toBe(1001);
  });
  it('keeps legacy origin requests free of an attribution when omitted', async () => {
    await dispatchConsumable({ consumableCode: 'DIESEL', quantity: 5, projectId: 7 });
    expect(JSON.parse(api.mock.calls[0][1].body)).not.toHaveProperty('budgetLineItemId');
  });
  it('includes expense attribution in the multipart JSON data', async () => {
    await createExpense({ projectId: 7, expenseType: 'FUEL', amountCents: 1001, expenseDate: '2026-10-07', budgetLineItemId: 9 });
    const body = apiMultipart.mock.calls[0][2] as FormData;
    const blob = body.get('data') as Blob;
    const payload = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob); });
    expect(JSON.parse(payload)).toMatchObject({ budgetLineItemId: 9, amountCents: 1001 });
  });
});
