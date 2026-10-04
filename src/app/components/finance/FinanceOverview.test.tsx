// BuildTrack — the FINANCE home (ported from Codex's 6e2d1d3, on today's
// services). Four figures that are the server's, for the whole company; the
// payments coming due; the latest approved expenses. Every block fails on its
// own and a failure is never read as a zero or as "nothing pending".

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  getReceivableSummary: vi.fn(),
  getPayableSummary: vi.fn(),
  listAllPayables: vi.fn(),
  getFinanceExpenses: vi.fn(),
  getFinanceExpenseReport: vi.fn(),
}));
vi.mock('../../services/finance', () => ({
  getReceivableSummary: service.getReceivableSummary,
  getPayableSummary: service.getPayableSummary,
  listAllPayables: service.listAllPayables,
}));
vi.mock('../../services/expenses', () => ({
  getFinanceExpenses: service.getFinanceExpenses,
  getFinanceExpenseReport: service.getFinanceExpenseReport,
}));

import i18n from '../../../i18n';
import { FinanceOverview } from './FinanceOverview';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const RECEIVABLES = {
  issuedThisMonth: 12000, issuedThisMonthCount: 3, outstanding: 9500, overdue: 6000, overdueCount: 1,
  month: '2026-10', asOf: '2026-10-03', collectedThisMonth: 9000, collectedThisMonthCount: 2, pending: 3500, pendingCount: 2,
};
const PAYABLES_SUMMARY = {
  dueThisWeekCents: 150_000, dueThisWeekCount: 1, overdueCents: 500_000, overdueCount: 1,
  outstandingCents: 650_000, outstandingCount: 2, paidThisMonthCents: 300_000, paidThisMonthCount: 1, asOf: '2026-10-03',
};
const BILLS = [
  { id: 1, vendor: 'Electro Demo', project: 'Los Pinos', invoiceNumber: 'SUB-001', billNumber: 'B-001', amount: 8000, paidAmount: 3000, dueDate: '2026-09-30' },
  { id: 2, vendor: 'Proveedor saldado', project: 'Los Pinos', invoiceNumber: null, billNumber: 'B-002', amount: 2000, paidAmount: 2000, dueDate: '2026-09-25' },
  { id: 3, vendor: 'Materiales Demo', project: 'Los Pinos', invoiceNumber: null, billNumber: 'B-003', amount: 1500, paidAmount: 0, dueDate: '2026-10-10' },
];

describe('FinanceOverview', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onNavigate = vi.fn();

  beforeAll(async () => { await i18n.changeLanguage('es'); });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T18:00:00Z'));
    service.getReceivableSummary.mockResolvedValue(RECEIVABLES);
    service.getPayableSummary.mockResolvedValue(PAYABLES_SUMMARY);
    service.listAllPayables.mockResolvedValue(BILLS);
    service.getFinanceExpenses.mockResolvedValue({ content: [{ id: 1, workerName: 'Ana Demo', projectName: 'Los Pinos', expenseType: 'FUEL', amountCents: 1250 }] });
    service.getFinanceExpenseReport.mockResolvedValue({ kpis: { totalApprovedCents: 100000, expenseCount: 4 } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

  async function render() {
    await act(async () => root.render(<FinanceOverview username="fin.demo" onNavigate={onNavigate} />));
    await act(async () => { await Promise.resolve(); });
  }
  const figure = (name: string) => container.querySelector(`[data-testid="finance-figure-${name}"]`)!;

  it('shows the server figures for the whole company, each one a door to its screen', async () => {
    await render();
    expect(figure('receivables').textContent).toContain('$9,500.00');
    expect(figure('receivables').textContent).toContain('$6,000.00 vencido · 1 documento');
    expect(figure('collections').textContent).toContain('$9,000.00');
    expect(figure('collections').textContent).toContain('2 cobros registrados');
    expect(figure('payables').textContent).toContain('$6,500.00');
    expect(figure('payables').textContent).toContain('1 cuenta vencida');
    expect(figure('expenses').textContent).toContain('$1,000.00');
    await act(async () => (figure('payables') as HTMLButtonElement).click());
    expect(onNavigate).toHaveBeenCalledWith('accounts-payable');
  });

  it('lists what falls due first, without settled bills, overdue ones first', async () => {
    await render();
    const text = container.textContent ?? '';
    expect(text).not.toContain('Proveedor saldado');
    expect(text.indexOf('Electro Demo')).toBeLessThan(text.indexOf('Materiales Demo'));
    expect(text).toContain('$5,000.00');
  });

  it('falls back to the bills for the payables figure on a server without the summary', async () => {
    service.getPayableSummary.mockRejectedValueOnce(new Error('404'));
    await render();
    // 8000 − 3000 + 1500, the two bills still owed.
    expect(figure('payables').textContent).toContain('$6,500.00');
    expect(figure('payables').textContent).toContain('1 cuenta vencida');
  });

  it('keeps the blocks that loaded and marks a failed one unknown until a retry works', async () => {
    service.getReceivableSummary.mockRejectedValueOnce(new Error('offline'));
    await render();
    expect(figure('receivables').textContent).toContain('—');
    expect(figure('payables').textContent).toContain('$6,500.00');
    expect(container.textContent).toContain('Ana Demo');
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    await act(async () => (container.querySelector('[role="alert"] button') as HTMLButtonElement).click());
    await act(async () => { await Promise.resolve(); });
    expect(figure('receivables').textContent).toContain('$9,500.00');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('never says nothing is pending when the bills failed to load', async () => {
    service.listAllPayables.mockRejectedValueOnce(new Error('offline'));
    await render();
    expect(container.textContent).toContain('No se pudieron cargar los pagos pendientes.');
    expect(container.textContent).not.toContain('No hay cuentas pendientes de pago.');
  });

  it('carries the anchors of its tour', async () => {
    await render();
    for (const step of ['figures', 'payments', 'expenses', 'shortcuts']) {
      expect(container.querySelector(`[data-tour="sec.finance-dashboard.${step}"]`), step).not.toBeNull();
    }
  });
});
