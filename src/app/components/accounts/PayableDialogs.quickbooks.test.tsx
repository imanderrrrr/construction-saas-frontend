// BuildTrack — Pagar's "Reasignar" and "Eliminar" refused with 409
// PAYABLE_HAS_ACTIVE_PAYMENTS: what to do depends on where the live payment
// is. One read from QuickBooks is undone there (the next read voids its copy),
// so "void it first" — the answer for a payment recorded here — would send the
// admin in a circle. The dialogs' hints say the same before the click.
// (Audit B13, "Pruebas del panel": the branches that hang on the error code.)
//
// Same harness as screens.quickbooks.test.tsx: services faked at the module
// boundary, texts as their keys.

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VendorBill } from '../PayableCommon';

vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  // The real ApiError's module loads the app's i18n, which plugs this in.
  return { initReactI18next: { type: '3rdParty', init: () => {} }, useTranslation: () => ({ t, i18n: { language: 'es' } }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/finance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/finance')>()),
  reassignPayableProject: vi.fn(),
  deletePayable: vi.fn(),
}));

import { toast } from 'sonner';
import { DeleteBillDialog, ReassignDialog } from './PayableDialogs';
import { ApiError } from '../../lib/api';
import { deletePayable, reassignPayableProject } from '../../services/finance';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const READ_FROM_QUICKBOOKS = {
  id: 11, date: '2026-09-25', amount: 100, method: 'Check', reference: 'CHK-1001', voided: false,
  source: 'QUICKBOOKS' as const, qboPaymentId: '157',
};
const RECORDED_HERE = {
  id: 12, date: '2026-09-20', amount: 50, method: 'Cash', voided: false, source: 'SYSTEM' as const, qboPaymentId: null,
};

function bill(partial: Partial<VendorBill> = {}): VendorBill {
  return {
    id: 9, billNumber: 'BILL-QB-9', vendor: 'Ferretería Central', category: 'materials', project: 'Torre Norte', projectId: 1,
    description: null, documentType: 'BILL', invoiceNumber: null, receivedDate: '2026-09-20', dueDate: '2026-10-20',
    amount: 300, paidAmount: 100, status: 'partial', notes: null, payments: [READ_FROM_QUICKBOOKS],
    createdAt: '2026-09-20T10:00:00Z', updatedAt: '2026-09-25T10:00:00Z', attachmentCount: 0, firstAttachmentId: null,
    paymentsInQuickBooks: true,
    ...partial,
  };
}

const PAID_HERE = bill({ payments: [RECORDED_HERE], paidAmount: 50, paymentsInQuickBooks: false });
// Switched off later: the payment read from QuickBooks still stands, and is still undone there.
const READ_BEFORE_THE_SWITCH_WENT_OFF = bill({ paymentsInQuickBooks: false });
const REFUSED = () => new ApiError(409, 'La cuenta tiene pagos activos.', undefined, 'PAYABLE_HAS_ACTIVE_PAYMENTS');

let host: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

async function render(node: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(node); });
  await flush();
}

const text = () => document.body.textContent ?? '';

async function clickLabel(label: string) {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === label) as HTMLButtonElement | undefined;
  expect(b, label).toBeTruthy();
  await act(async () => { b!.click(); });
  await flush();
}

async function pickProject(id: number) {
  const select = document.querySelector('#ap-reassign-target') as HTMLSelectElement;
  await act(async () => {
    select.value = String(id);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(reassignPayableProject).mockReset();
  vi.mocked(deletePayable).mockReset();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  document.body.innerHTML = '';
});

const PROJECTS = [
  { id: 1, name: 'Torre Norte', remainingBudgetCents: 500_000 },
  { id: 2, name: 'Obra Sur', remainingBudgetCents: 800_000 },
];

describe('Reasignar, refused because of live payments', () => {
  it.each([
    ['a payment read from QuickBooks', bill(), 'quickbooksPaymentsHint', 'hasQuickBooksPayments'],
    ['a payment read from QuickBooks before the switch went off', READ_BEFORE_THE_SWITCH_WENT_OFF, 'quickbooksPaymentsHint', 'hasQuickBooksPayments'],
    ['a payment recorded here', PAID_HERE, 'activePaymentsHint', 'hasPayments'],
  ])('with %s, the hint and the refusal say where to undo it', async (_, b, hint, refusal) => {
    vi.mocked(reassignPayableProject).mockRejectedValue(REFUSED());
    await render(<ReassignDialog bill={b} projects={PROJECTS} onClose={() => {}} onReassigned={() => {}} />);

    expect(text()).toContain(`finance:payable.reassign.${hint}`);

    await pickProject(2);
    await clickLabel('finance:payable.reassign.confirm');

    expect(reassignPayableProject).toHaveBeenCalledWith(9, 2);
    expect(toast.error).toHaveBeenCalledWith(`finance:payable.reassign.${refusal}`, { description: 'La cuenta tiene pagos activos.' });
  });

  it('any other refusal keeps its own sentence', async () => {
    vi.mocked(reassignPayableProject).mockRejectedValue(new ApiError(409, 'La obra está cerrada.', undefined, 'PROJECT_NOT_ACTIVE'));
    await render(<ReassignDialog bill={bill()} projects={PROJECTS} onClose={() => {}} onReassigned={() => {}} />);

    await pickProject(2);
    await clickLabel('finance:payable.reassign.confirm');

    expect(toast.error).toHaveBeenCalledWith('finance:payable.reassign.notActive', { description: 'La obra está cerrada.' });
  });
});

describe('Eliminar, refused because of live payments', () => {
  it.each([
    ['a payment read from QuickBooks', bill(), 'quickbooksPaymentsHint', 'hasQuickBooksPayments'],
    ['a payment recorded here', PAID_HERE, 'activePaymentsHint', 'hasPayments'],
  ])('with %s, the hint and the refusal say where to undo it', async (_, b, hint, refusal) => {
    vi.mocked(deletePayable).mockRejectedValue(REFUSED());
    await render(<DeleteBillDialog bill={b} onClose={() => {}} onDeleted={() => {}} />);

    expect(text()).toContain(`finance:payable.delete.${hint}`);

    await clickLabel('finance:payable.delete.continue');
    await clickLabel('finance:payable.delete.confirm');

    expect(deletePayable).toHaveBeenCalledWith(9);
    expect(toast.error).toHaveBeenCalledWith(`finance:payable.delete.${refusal}`, { description: 'La cuenta tiene pagos activos.' });
  });

  it('a payment QuickBooks already voided is not live: no hint about undoing it', async () => {
    await render(<DeleteBillDialog bill={bill({ payments: [{ ...READ_FROM_QUICKBOOKS, voided: true }], paidAmount: 0 })} onClose={() => {}} onDeleted={() => {}} />);

    expect(text()).not.toContain('PaymentsHint');
  });

  it('any other failure says it could not be deleted', async () => {
    vi.mocked(deletePayable).mockRejectedValue(new ApiError(500, 'Error interno.'));
    await render(<DeleteBillDialog bill={bill()} onClose={() => {}} onDeleted={() => {}} />);

    await clickLabel('finance:payable.delete.continue');
    await clickLabel('finance:payable.delete.confirm');

    expect(toast.error).toHaveBeenCalledWith('finance:payable.delete.failed', { description: 'Error interno.' });
  });
});
