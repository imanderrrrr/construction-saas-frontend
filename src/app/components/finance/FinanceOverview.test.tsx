import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payable, Receivable } from '../../services/finance';

const service = vi.hoisted(() => ({ listAllReceivables: vi.fn(), listAllPayables: vi.fn(), getFinanceExpenses: vi.fn() }));
vi.mock('../../services/finance', async importOriginal => ({ ...await importOriginal<typeof import('../../services/finance')>(), listAllReceivables: service.listAllReceivables, listAllPayables: service.listAllPayables }));
vi.mock('../../services/expenses', () => ({ getFinanceExpenses: service.getFinanceExpenses }));

import i18n from '../../../i18n';
import { FinanceOverview } from './FinanceOverview';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const receivables = [
  { id: 1, client: 'Cliente vencido', invoiceNumber: 'INV-01', project: 'Los Pinos', amount: 10000, paidAmount: 4000, dueDate: '2026-09-30', status: 'partial', payments: [{ amount: 4000, date: '2026-10-02' }] },
  { id: 2, client: 'Cliente a tiempo', invoiceNumber: 'INV-02', project: 'Los Pinos', amount: 3500, paidAmount: 0, dueDate: '2026-10-10', status: 'pending', payments: [] },
  { id: 3, client: 'Cliente saldado', invoiceNumber: 'INV-03', project: 'Los Pinos', amount: 5000, paidAmount: 5000, dueDate: '2026-09-25', status: 'paid', payments: [{ amount: 5000, date: '2026-10-01' }] },
] as Receivable[];
const payables = [
  { id: 1, vendor: 'Electro Demo', project: 'Los Pinos', invoiceNumber: 'SUB-001', amount: 8000, paidAmount: 3000, dueDate: '2026-09-30', status: 'partial', payments: [{ amount: 3000, date: '2026-10-02' }] },
  { id: 2, vendor: 'Proveedor saldado', project: 'Los Pinos', billNumber: 'B-002', amount: 2000, paidAmount: 2000, dueDate: '2026-09-25', status: 'paid', payments: [{ amount: 2000, date: '2026-09-25' }] },
  { id: 3, vendor: 'Materiales Demo', project: 'Los Pinos', billNumber: 'B-003', amount: 1500, paidAmount: 0, dueDate: '2026-10-10', status: 'pending', payments: [] },
] as unknown as Payable[];

describe('FinanceOverview', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onNavigate = vi.fn();
  const onStartTutorial = vi.fn();
  beforeAll(async () => { await i18n.changeLanguage('es'); });
  beforeEach(() => {
    vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T18:00:00Z'));
    service.listAllReceivables.mockResolvedValue(receivables);
    service.listAllPayables.mockResolvedValue(payables);
    service.getFinanceExpenses.mockResolvedValue({ content: [{ id: 1, workerName: 'Ana Demo', projectName: 'Los Pinos', expenseType: 'FUEL', amountCents: 1250 }] });
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });
  async function render() { await act(async () => root.render(<FinanceOverview username="fin.demo" onNavigate={onNavigate} onStartTutorial={onStartTutorial} />)); }
  const figure = (name: string) => container.querySelector(`[data-testid="finance-figure-${name}"]`)!;
  const attention = (anchor: string) => container.querySelector(`[data-tour="sec.finance-overview.${anchor}"]`)!;

  it('separates pending balances from actual month collections and vendor payments', async () => {
    await render();
    expect(figure('receivables').textContent).toContain('9,500.00');
    expect(figure('payables').textContent).toContain('6,500.00');
    expect(figure('collections').textContent).toContain('9,000.00');
    expect(figure('paid').textContent).toContain('3,000.00');
    expect(container.querySelector('[data-testid="finance-month-net"]')?.textContent).toContain('6,000.00');
    expect(container.textContent).toContain('no representa el saldo bancario');
  });
  it('shows partial overdue collections separately from payments falling due within 7 days', async () => {
    await render();
    expect(attention('overdue').textContent).toContain('6,000.00');
    expect(attention('overdue').textContent).toContain('Cliente vencido');
    expect(attention('overdue').textContent).not.toContain('Cliente saldado');
    expect(attention('payments').textContent).toContain('1,500.00');
    expect(attention('payments').textContent).toContain('Materiales Demo');
    expect(attention('payments').textContent).toContain('5,000.00 en 1 pago ya vencido');
    const row = [...attention('overdue').querySelectorAll('button')].find(b => b.textContent?.includes('INV-01'))!;
    await act(async () => row.click());
    expect(onNavigate).toHaveBeenCalledWith('accounts-receivable', expect.objectContaining({ registro: 1, obra: null, vista: 'docs' }));
  });
  it('keeps successful blocks visible and makes the net unknown until a failed side recovers', async () => {
    service.listAllReceivables.mockRejectedValueOnce(new Error('offline'));
    await render();
    expect(figure('receivables').textContent).toContain('—');
    expect(figure('payables').textContent).toContain('6,500.00');
    expect(container.querySelector('[data-testid="finance-month-net"]')?.textContent).toContain('—');
    expect(container.textContent).toContain('Ana Demo');
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    await act(async () => (container.querySelector('[role="alert"] button') as HTMLButtonElement).click());
    expect(figure('receivables').textContent).toContain('9,500.00');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
  it('does not claim there are no upcoming payments when the request failed', async () => {
    service.listAllPayables.mockRejectedValueOnce(new Error('offline')); await render();
    expect(figure('payables').textContent).toContain('—');
    expect(attention('payments').textContent).toContain('No se pudieron cargar los pagos pendientes.');
    expect(attention('payments').textContent).not.toContain('No hay pagos por vencer');
  });
  it('offers a replayable tutorial and keeps its four anchors even on empty accounts', async () => {
    service.listAllReceivables.mockResolvedValue([]); service.listAllPayables.mockResolvedValue([]); await render();
    for (const anchor of ['position', 'overdue', 'payments', 'month']) expect(attention(anchor)).toBeTruthy();
    const guide = [...container.querySelectorAll('button')].find(b => b.textContent === 'Ver guía')!;
    await act(async () => guide.click()); expect(onStartTutorial).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain('NaN');
  });
});
