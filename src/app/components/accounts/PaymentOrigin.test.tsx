// BuildTrack — QuickBooks phase 4 in the payment histories: which payments
// count, where each one came from, and that a document whose payments come
// from the tenant's QuickBooks offers no way to record, edit or undo them here.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  // The detail's attachments panel lists the bill's files on mount.
  api: async () => [],
}));

import { PayableDetailPanel } from './PayableDetailPanel';
import type { VendorBill } from '../PayableCommon';
import { hasLiveQuickBooksPayment, paymentCounts, type Payable, type Receivable } from '../../services/finance';
import { payablePayments, receivablePayments } from './accounting';
import i18n from '../../../i18n';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const FROM_QUICKBOOKS = {
  id: 1, date: '2026-09-25', amount: 100, method: 'Check', reference: '5001', approvedBy: 'QuickBooks',
  voided: false, source: 'QUICKBOOKS' as const, qboPaymentId: '161',
};
const RECORDED_HERE = {
  id: 2, date: '2026-09-20', amount: 50, method: 'Cash', reference: undefined, approvedBy: 'admin',
  voided: false, source: 'SYSTEM' as const, qboPaymentId: null,
};
const DELETED_IN_QUICKBOOKS = {
  ...FROM_QUICKBOOKS, id: 3, qboPaymentId: '170', voided: true, reference: 'CHK-170',
  voidReason: 'No longer applied in QuickBooks (deleted, voided or unlinked there)',
};

function bill(partial: Partial<VendorBill> = {}): VendorBill {
  return {
    id: 9, billNumber: 'BILL-2026-0009', vendor: 'Ferretería Central', category: 'materials', project: 'Torre Norte',
    projectId: 1, description: null, documentType: 'BILL', invoiceNumber: null, receivedDate: '2026-09-25',
    dueDate: '2026-10-25', amount: 123.45, paidAmount: 100, status: 'partial', notes: null,
    payments: [FROM_QUICKBOOKS, RECORDED_HERE, DELETED_IN_QUICKBOOKS], createdAt: '2026-09-25T10:00:00Z',
    updatedAt: '2026-09-25T10:00:00Z', attachmentCount: 0, firstAttachmentId: null, paymentsInQuickBooks: true,
    ...partial,
  };
}

let host: HTMLDivElement;
let root: Root;

async function render(b: VendorBill) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <PayableDetailPanel
        bill={b} project={undefined} canManage today="2026-09-26" dateLocale="es" busy={false}
        onClose={() => {}} onPay={() => {}} onEditAmounts={() => {}} onEditInfo={() => {}} onConvert={() => {}}
        onReassign={() => {}} onUnpay={() => {}} onDelete={() => {}} onVoidPayment={() => {}} onEditPayment={() => {}}
      />,
    );
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

const text = () => document.body.textContent ?? '';

function button(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === label) as HTMLButtonElement | undefined;
}

/** The history row of one payment, found by what it shows. */
function paymentRow(marker: string): HTMLElement {
  const row = [...document.querySelectorAll('[data-testid="payable-payment"]')].find(el => el.textContent?.includes(marker));
  expect(row, marker).toBeTruthy();
  return row as HTMLElement;
}

beforeEach(async () => {
  await i18n.changeLanguage('es');
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  document.body.innerHTML = '';
});

describe('paymentCounts', () => {
  it('counts what the server counts', () => {
    const inQuickBooks = { paymentsInQuickBooks: true };
    const here = { paymentsInQuickBooks: false };
    expect(paymentCounts(inQuickBooks, FROM_QUICKBOOKS)).toBe(true);
    expect(paymentCounts(inQuickBooks, RECORDED_HERE)).toBe(false);
    expect(paymentCounts(inQuickBooks, DELETED_IN_QUICKBOOKS)).toBe(false);
    expect(paymentCounts(here, RECORDED_HERE)).toBe(true);
    // Switched off later: what was read from QuickBooks still happened.
    expect(paymentCounts(here, FROM_QUICKBOOKS)).toBe(true);
    expect(paymentCounts(here, { ...RECORDED_HERE, voided: true })).toBe(false);
    // Before phase 4 the server sent neither flag nor source.
    expect(paymentCounts({}, { voided: false })).toBe(true);
  });
});

describe('hasLiveQuickBooksPayment', () => {
  it('is true only while a payment read from QuickBooks still stands — the one case "void it first" cannot be done here', () => {
    expect(hasLiveQuickBooksPayment({ payments: [FROM_QUICKBOOKS, RECORDED_HERE] })).toBe(true);
    expect(hasLiveQuickBooksPayment({ payments: [DELETED_IN_QUICKBOOKS, RECORDED_HERE] })).toBe(false);
    expect(hasLiveQuickBooksPayment({ payments: [RECORDED_HERE] })).toBe(false);
    expect(hasLiveQuickBooksPayment({ payments: [] })).toBe(false);
  });
});

describe('the month figures', () => {
  it('collect and pay only what counts: a payment recorded here on a document read from QuickBooks is not money twice', () => {
    const receivable = { paymentsInQuickBooks: true, payments: [FROM_QUICKBOOKS, RECORDED_HERE, DELETED_IN_QUICKBOOKS] } as unknown as Receivable;
    const plain = { paymentsInQuickBooks: false, payments: [{ ...RECORDED_HERE, id: 4, amount: 7 }] } as unknown as Receivable;
    expect(receivablePayments([receivable, plain])).toEqual([
      { date: '2026-09-25', amount: 100 },
      { date: '2026-09-20', amount: 7 },
    ]);
    const payable = { paymentsInQuickBooks: true, payments: [FROM_QUICKBOOKS, RECORDED_HERE] } as unknown as Payable;
    expect(payablePayments([payable])).toEqual([{ date: '2026-09-25', amount: 100 }]);
  });
});

describe('a bill whose payments come from QuickBooks', () => {
  it('offers no way to pay it here, and says where to', async () => {
    await render(bill());

    const pay = button('Pagar');
    expect(pay, 'the pay button stays, off').toBeTruthy();
    expect(pay!.disabled).toBe(true);
    expect(pay!.parentElement!.getAttribute('title')).toBe('Regístralo en QuickBooks; aparecerá aquí solo.');
    expect(text()).toContain('Regístralo en QuickBooks; aparecerá aquí solo.');
  });

  it('tags each payment by where it came from; one read from QuickBooks is changed there, not here', async () => {
    await render(bill());

    const qbo = paymentRow('5001');
    expect(qbo.textContent).toContain('QuickBooks');
    expect(qbo.querySelector('[title="Pago #161 en QuickBooks"]')).toBeTruthy();
    expect([...qbo.querySelectorAll('button')]).toHaveLength(0);

    const local = paymentRow('Efectivo');
    expect(local.textContent).toContain('Registrado en BuildTrack, no en QuickBooks');
    expect(local.querySelector('.line-through')).toBeTruthy();
    // Recorded here: still filed away (or corrected) here.
    expect([...local.querySelectorAll('button')].map(b => b.textContent?.trim())).toEqual(['Editar', 'Anular']);

    const deleted = paymentRow('CHK-170');
    expect(deleted.textContent).toContain('Ya no está en QuickBooks');
    // Said in the panel's language: the server's note on a QuickBooks copy is
    // a fixed English sentence.
    expect(deleted.querySelector('[title="Se borró, anuló o desvinculó en QuickBooks, así que ya no cuenta."]')).toBeTruthy();
    expect(deleted.innerHTML).not.toContain('No longer applied in QuickBooks');
    expect([...deleted.querySelectorAll('button')]).toHaveLength(0);
  });

  it('a bill paid here as before keeps its buttons and no origin tag at all', async () => {
    await render(bill({ paymentsInQuickBooks: false, payments: [RECORDED_HERE], paidAmount: 50 }));

    const pay = button('Pagar');
    expect(pay!.disabled).toBe(false);
    expect(pay!.parentElement!.getAttribute('title')).toBeNull();
    expect(document.querySelector('[data-testid="payment-origin"]')).toBeNull();
    expect(text()).not.toContain('Regístralo en QuickBooks');
    expect([...paymentRow('Efectivo').querySelectorAll('button')].map(b => b.textContent?.trim())).toEqual(['Editar', 'Anular']);
  });
});
