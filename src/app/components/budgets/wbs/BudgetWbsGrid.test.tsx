import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const svc = vi.hoisted(() => ({ getWbsSummary: vi.fn(), createLineItem: vi.fn(), updateLineItem: vi.fn(), bulkImportLineItems: vi.fn(), deleteLineItem: vi.fn() }));
vi.mock('../../../services/budgetLineItems', async importOriginal => ({ ...(await importOriginal<typeof import('../../../services/budgetLineItems')>()), ...svc }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
import i18n from '../../../../i18n';
import { ApiError } from '../../../lib/api';
import type { BudgetLineItem, ProjectWbsSummary } from '../../../services/budgetLineItems';
import { BudgetWbsGrid } from './BudgetWbsGrid';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const item = (id: number, spentCents: number): BudgetLineItem => ({
  id, projectId: 7, code: `01.0${id}`, name: id === 1 ? 'Foundation' : 'Walls', category: 'GENERAL', unit: 'GLB', quantity: 1, unitCostCents: 10000,
  originalBudgetCents: 10000, changeOrdersCents: 0, revisedBudgetCents: 10000, spentCents, committedCents: 0, balanceCents: 10000 - spentCents,
  consumptionPct: spentCents / 100, varianceStatus: spentCents >= 10000 ? 'OVER_BUDGET' : spentCents >= 8500 ? 'WARNING' : 'OK',
  spendByPillar: { payrollCents: 0, subcontractorCents: 0, supplierCents: 2000, warehouseCents: spentCents - 2000, expenseCents: 0 }, notes: 'original notes',
});
const summary: ProjectWbsSummary = { projectId: 7, totalOriginalBudgetCents: 20000, totalRevisedBudgetCents: 20000, totalSpentCents: 22000, totalCommittedCents: 0, totalBalanceCents: -2000, globalConsumptionPct: 110, itemsCount: 2, warningCount: 1, overBudgetCount: 1, items: [item(1, 8500), item(2, 13500)] };

describe('BudgetWbsGrid', () => {
  let container: HTMLDivElement, root: Root;
  beforeEach(async () => {
    vi.clearAllMocks(); await i18n.changeLanguage('en'); svc.getWbsSummary.mockResolvedValue(summary);
    svc.createLineItem.mockResolvedValue(item(1, 0)); svc.updateLineItem.mockResolvedValue(item(1, 0)); svc.bulkImportLineItems.mockResolvedValue([]); svc.deleteLineItem.mockResolvedValue(undefined);
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  async function mount(readOnly = false) { await act(async () => { root.render(<BudgetWbsGrid projectId={7} readOnly={readOnly} />); }); }
  async function clickText(text: string) { const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === text); if (!button) throw new Error(`no ${text}`); await act(async () => button.click()); }
  async function input(id: string, value: string) {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
    const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
  }

  it('shows early warning and overrun rows even while the aggregate has available funds', async () => {
    await mount();
    expect(container.textContent).toContain('Warning · 85%+'); expect(container.textContent).toContain('Over budget · 100%+');
    expect(container.textContent).toContain('-$35.00'); expect(container.textContent).toContain('135 %');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });
  it('expands the actual spend into all five pillars', async () => {
    await mount(); await clickText('01.01');
    const breakdown = container.querySelector('#wbs-pillars-1');
    expect(breakdown?.textContent).toContain('Warehouse'); expect(breakdown?.textContent).toContain('$65.00'); expect(breakdown?.querySelectorAll('dt')).toHaveLength(5);
  });
  it('uses finance reads and hides all mutation controls', async () => {
    await mount(true);
    expect(svc.getWbsSummary).toHaveBeenCalledWith(7, true);
    expect(container.textContent).toContain('Read only · finance'); expect(container.textContent).not.toContain('New line item'); expect(container.textContent).not.toContain('Delete');
    await clickText('01.02'); expect(container.querySelector('#wbs-pillars-2')).not.toBeNull();
  });
  it('retains failed-load evidence and retries instead of rendering an empty budget', async () => {
    svc.getWbsSummary.mockRejectedValueOnce(new Error('offline')); await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not load line items');
    await clickText('Retry'); expect(container.textContent).toContain('Foundation');
  });
  it('creates exact cents and lets the server compute quantity times unit cost', async () => {
    await mount(); await clickText('New line item'); await input('wbs-code', '02.01'); await input('wbs-name', 'Structure'); await input('wbs-quantity', '2.5'); await input('wbs-unit-cost', '12.34'); await clickText('Save line item');
    expect(svc.createLineItem).toHaveBeenCalledWith(7, { code: '02.01', name: 'Structure', category: 'GENERAL', unit: 'GLB', quantity: 2.5, unitCostCents: 1234, notes: null });
    expect(svc.getWbsSummary).toHaveBeenCalledTimes(2);
  });
  it('edits the original allocation, budget changes and clears notes', async () => {
    await mount(); await clickText('Edit'); await input('wbs-original', '80.01'); await input('wbs-orders', '-5.01'); await input('wbs-notes', ''); await clickText('Save line item');
    expect(svc.updateLineItem).toHaveBeenCalledWith(1, expect.objectContaining({ originalBudgetCents: 8001, changeOrdersCents: -501, notes: '' }));
  });
  it('previews pasted Excel rows and submits all rows in one bulk request', async () => {
    await mount(); await clickText('Import CSV / Excel'); await input('wbs-import-source', 'Code\tName\tCategory\tAmount\n02.01\tStructure\tMATERIAL\t200.05\n03.01\tWalls\tLABOR\t100.01');
    expect(document.body.textContent).toContain('2 line items · total $300.06'); await clickText('Import 2 line items');
    expect(svc.bulkImportLineItems).toHaveBeenCalledWith(7, [{ code: '02.01', name: 'Structure', category: 'MATERIAL', originalBudgetCents: 20005 }, { code: '03.01', name: 'Walls', category: 'LABOR', originalBudgetCents: 10001 }]);
  });
  it('prevents a malformed import from reaching the API', async () => {
    await mount(); await clickText('Import CSV / Excel'); await input('wbs-import-source', '01,One,GENERAL,12\n01,Other,GENERAL,3');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('duplicate code');
    const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Import 0 line items') as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(svc.bulkImportLineItems).not.toHaveBeenCalled();
  });
  it('explains a protected deletion and keeps the line item visible', async () => {
    svc.deleteLineItem.mockRejectedValue(new ApiError(409, 'protected', undefined, 'CANNOT_DELETE_LINE_ITEM_WITH_TRANSACTIONS'));
    await mount(); await clickText('Delete');
    const dialog = document.querySelector('[role="dialog"]')!;
    await act(async () => (Array.from(dialog.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Delete') as HTMLButtonElement).click());
    expect(toast.error).toHaveBeenCalledWith('This line item has transactions and cannot be deleted.', expect.anything()); expect(container.textContent).toContain('Foundation');
  });
});
