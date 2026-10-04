import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({ getReceivableSummary: vi.fn(), listAllPayables: vi.fn(), getFinanceExpenses: vi.fn(), getFinanceExpenseReport: vi.fn() }));
vi.mock('../../services/finance', () => ({ getReceivableSummary: service.getReceivableSummary, listAllPayables: service.listAllPayables }));
vi.mock('../../services/expenses', () => ({ getFinanceExpenses: service.getFinanceExpenses, getFinanceExpenseReport: service.getFinanceExpenseReport }));

import i18n from '../../../i18n';
import { FinanceOverview } from './FinanceOverview';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const summary = { outstanding: 9500, overdue: 6000, overdueCount: 1, collectedThisMonth: 9000, month: '2026-10' };

describe('FinanceOverview', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onNavigate = vi.fn();
  beforeAll(async () => { await i18n.changeLanguage('es'); });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T18:00:00Z'));
    service.getReceivableSummary.mockResolvedValue(summary);
    service.listAllPayables.mockResolvedValue([
      { id: 1, vendor: 'Electro Demo', project: 'Los Pinos', invoiceNumber: 'SUB-001', amount: 8000, paidAmount: 3000, dueDate: '2026-09-30' },
      { id: 2, vendor: 'Proveedor saldado', project: 'Los Pinos', billNumber: 'B-002', amount: 2000, paidAmount: 2000, dueDate: '2026-09-25' },
      { id: 3, vendor: 'Materiales Demo', project: 'Los Pinos', billNumber: 'B-003', amount: 1500, paidAmount: 0, dueDate: '2026-10-10' },
    ]);
    service.getFinanceExpenses.mockResolvedValue({ content: [{ id: 1, workerName: 'Ana Demo', projectName: 'Los Pinos', expenseType: 'FUEL', amountCents: 1250 }] });
    service.getFinanceExpenseReport.mockResolvedValue({ kpis: { totalApprovedCents: 100000, expenseCount: 4 } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

  async function render() { await act(async () => root.render(<FinanceOverview username="fin.demo" onNavigate={onNavigate} />)); }
  const figure = (name: string) => container.querySelector(`[data-testid="finance-figure-${name}"]`)!;

  it('uses tenant collection totals and remaining payable balances, excluding settled bills', async () => {
    await render();
    expect(figure('receivables').textContent).toContain('9,500.00');
    expect(figure('collections').textContent).toContain('9,000.00');
    expect(figure('payables').textContent).toContain('6,500.00');
    expect(figure('payables').textContent).toContain('1 documento vencido');
    expect(container.textContent).not.toContain('Proveedor saldado');
    await act(async () => (figure('payables') as HTMLButtonElement).click());
    expect(onNavigate).toHaveBeenCalledWith('accounts-payable');
  });

  it('keeps successful blocks visible and marks failed collections unknown until retry succeeds', async () => {
    service.getReceivableSummary.mockRejectedValueOnce(new Error('offline'));
    await render();
    expect(figure('receivables').textContent).toContain('—');
    expect(figure('payables').textContent).toContain('6,500.00');
    expect(container.textContent).toContain('Ana Demo');
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    await act(async () => (container.querySelector('[role="alert"] button') as HTMLButtonElement).click());
    expect(figure('receivables').textContent).toContain('9,500.00');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('does not report an empty payment queue when payables failed to load', async () => {
    service.listAllPayables.mockRejectedValueOnce(new Error('offline'));
    await render();
    expect(figure('payables').textContent).toContain('—');
    expect(container.textContent).toContain('No se pudieron cargar los pagos pendientes.');
    expect(container.textContent).not.toContain('No hay facturas pendientes de pago.');
  });
});
