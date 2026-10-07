import { paymentCounts, type Payable, type Receivable } from '../../services/finance';
import { addDays, isBillable } from '../accounts/accounting';

export type AttentionDocument = {
  id: number; party: string; number: string; project: string; dueDate: string; balanceCents: number;
};

const remaining = (doc: { amount: number; paidAmount: number }) => Math.max(0, Math.round(doc.amount * 100) - Math.round(doc.paidAmount * 100));
const sum = (docs: AttentionDocument[]) => docs.reduce((total, doc) => total + doc.balanceCents, 0);

function paymentsInMonth(docs: Array<Receivable | Payable>, today: string) {
  const from = `${today.slice(0, 7)}-01`;
  const payments = docs.flatMap(doc => (doc.payments ?? []).filter(payment =>
    paymentCounts(doc, payment) && payment.date >= from && payment.date <= today));
  return { cents: payments.reduce((total, payment) => total + Math.round(payment.amount * 100), 0), count: payments.length };
}

/** Pending balances and actual payments are deliberately separate measures. */
export function financeOverview(receivables: Receivable[], payables: Payable[], today: string) {
  const billable = receivables.filter(isBillable);
  const ar = billable.filter(doc => remaining(doc) > 0 && doc.status.toLowerCase() !== 'paid').map(doc => ({
    id: doc.id, party: doc.client, number: doc.invoiceNumber, project: doc.project, dueDate: doc.dueDate, balanceCents: remaining(doc),
  }));
  const ap = payables.filter(doc => remaining(doc) > 0 && doc.status.toLowerCase() !== 'paid').map(doc => ({
    id: doc.id, party: doc.vendor, number: doc.invoiceNumber ?? doc.billNumber, project: doc.project, dueDate: doc.dueDate, balanceCents: remaining(doc),
  }));
  const byDue = (a: AttentionDocument, b: AttentionDocument) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id;
  const overdueReceivables = ar.filter(doc => doc.dueDate < today).sort(byDue);
  const overduePayables = ap.filter(doc => doc.dueDate < today).sort(byDue);
  const nextPayments = ap.filter(doc => doc.dueDate >= today && doc.dueDate <= addDays(today, 7)).sort(byDue);
  const collected = paymentsInMonth(billable, today);
  const paid = paymentsInMonth(payables, today);
  return {
    receivableBalanceCents: sum(ar), payableBalanceCents: sum(ap),
    overdueReceivables, overdueReceivableCents: sum(overdueReceivables),
    overduePayables, overduePayableCents: sum(overduePayables),
    nextPayments, nextPaymentCents: sum(nextPayments),
    collected, paid, netCents: collected.cents - paid.cents,
  };
}
