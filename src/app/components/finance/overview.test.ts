import { describe, expect, it } from 'vitest';
import type { Payable, Receivable } from '../../services/finance';
import { financeOverview } from './overview';

const ar = (id: number, patch: Partial<Receivable> = {}) => ({ id, invoiceNumber: `INV-${id}`, client: 'Cliente', project: 'Obra', amount: 100, paidAmount: 0, dueDate: '2026-10-06', status: 'pending', payments: [], ...patch } as Receivable);
const ap = (id: number, dueDate: string, patch: Partial<Payable> = {}) => ({ id, billNumber: `B-${id}`, vendor: 'Proveedor', project: 'Obra', amount: 100, paidAmount: 0, status: 'pending', payments: [], dueDate, ...patch } as Payable);

describe('finance overview calculations', () => {
  it('uses remaining balances and ignores unapproved, rejected and paid documents', () => {
    const result = financeOverview([ar(1, { amount: 100, paidAmount: 35 }), ar(2, { status: 'PENDING_APPROVAL' }), ar(3, { status: 'REJECTED' }), ar(4, { status: 'paid', paidAmount: 100 })], [], '2026-10-07');
    expect(result.receivableBalanceCents).toBe(6500);
    expect(result.overdueReceivableCents).toBe(6500);
    expect(result.overdueReceivables.map(d => d.id)).toEqual([1]);
  });
  it('includes today and day 7 while keeping overdue and later payments outside the upcoming total', () => {
    const result = financeOverview([], [ap(1, '2026-10-06'), ap(2, '2026-10-07'), ap(3, '2026-10-14', { paidAmount: 20 }), ap(4, '2026-10-15')], '2026-10-07');
    expect(result.nextPaymentCents).toBe(18000);
    expect(result.nextPayments.map(d => d.id)).toEqual([2, 3]);
    expect(result.overduePayableCents).toBe(10000);
  });
  it('counts current month movements through today and excludes voided, replaced and old QuickBooks copies', () => {
    const payments = [{ id: 1, amount: 0.1, date: '2026-10-01', method: 'bank' }, { id: 2, amount: 0.2, date: '2026-10-07', method: 'bank' }, { id: 3, amount: 20, date: '2026-09-30', method: 'bank' }, { id: 4, amount: 30, date: '2026-10-08', method: 'bank' }, { id: 5, amount: 40, date: '2026-10-02', method: 'bank', voided: true }, { id: 6, amount: 50, date: '2026-10-03', method: 'bank', supersededAt: '2026-10-03T12:00:00Z' }];
    const result = financeOverview([ar(1, { payments }), ar(2, { paymentsInQuickBooks: true, payments: [{ id: 7, amount: 60, date: '2026-10-03', method: 'bank', source: 'SYSTEM' }, { id: 8, amount: 70, date: '2026-10-04', method: 'bank', source: 'QUICKBOOKS' }] })], [ap(1, '2026-10-10', { payments })], '2026-10-07');
    expect(result.collected).toEqual({ cents: 7030, count: 3 });
    expect(result.paid).toEqual({ cents: 30, count: 2 });
    expect(result.netCents).toBe(7000);
  });
  it('sorts overdue documents oldest first and handles a negative monthly net', () => {
    const result = financeOverview([ar(1), ar(2, { dueDate: '2026-09-30' })], [ap(1, '2026-10-10', { payments: [{ id: 1, amount: 35, date: '2026-10-01', method: 'bank' }] })], '2026-10-07');
    expect(result.overdueReceivables.map(d => d.id)).toEqual([2, 1]);
    expect(result.netCents).toBe(-3500);
  });
});
