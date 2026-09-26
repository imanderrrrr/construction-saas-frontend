// BuildTrack — Cobrar and Pagar with a document whose payments come from the
// tenant's QuickBooks (phase 4): its "Cobrar" / "Pagar" stays, off, and says
// why; a payment read from QuickBooks is never voided here; a bill of that kind
// never joins a batch run (the server would refuse each one with 409); and the
// month figure counts what the server counts. Same harness as the load-error
// tests: services faked at the module boundary, texts as their keys.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payable, Receivable } from '../../services/finance';

const mocks = vi.hoisted(() => ({
  listAllReceivables: vi.fn(),
  listAllPayables: vi.fn(),
  listPayableVendors: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t, i18n: { language: 'es' } }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('../../services/auth', () => ({ AuthService: { getCanonicalRole: () => 'ADMIN' } }));
vi.mock('../../services/projects', () => ({ listProjects: mocks.listProjects }));
vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error { code?: string },
  getBaseUrl: () => '',
}));
vi.mock('../../services/finance', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/finance')>();
  return {
    // The two rules under test are the real ones.
    paymentCounts: real.paymentCounts,
    hasLiveQuickBooksPayment: real.hasLiveQuickBooksPayment,
    listAllReceivables: mocks.listAllReceivables,
    listAllPayables: mocks.listAllPayables,
    listPayableVendors: mocks.listPayableVendors,
    getPayableSummary: vi.fn(() => Promise.reject(new Error('404'))),
    voidReceivablePayment: vi.fn(),
    approveChangeOrder: vi.fn(),
    rejectChangeOrder: vi.fn(),
    downloadReceivableDocument: vi.fn(),
    recordReceivablePayment: vi.fn(),
    updateReceivableInfo: vi.fn(),
    deleteReceivable: vi.fn(),
    recordPayablePayment: vi.fn(),
    createPayable: vi.fn(),
    deletePayable: vi.fn(),
    markPayableUnpaid: vi.fn(),
    reassignPayableProject: vi.fn(),
    convertPayableToInvoice: vi.fn(),
    updatePayableAmount: vi.fn(),
    updatePayableDates: vi.fn(),
    updatePayableInfo: vi.fn(),
    updatePayablePayment: vi.fn(),
    voidPayablePayment: vi.fn(),
    uploadPayableAttachment: vi.fn(),
    listPayableAttachments: vi.fn(() => Promise.resolve([])),
    deletePayableAttachment: vi.fn(),
    payableAttachmentUrl: () => '',
  };
});
vi.mock('../signatures/SignatureRequestPanel', () => ({ SignatureRequestPanel: () => null }));
// The screens' own clock: every figure below is measured against this month.
vi.mock('../../helpers/dateTime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../helpers/dateTime')>()),
  businessToday: () => '2026-09-26',
  currentMonth: () => '2026-09',
}));

import { ReceivablesScreen } from './ReceivablesScreen';
import { PayablesScreen } from './PayablesScreen';

const QBO_PAYMENT = {
  id: 11, date: '2026-09-25', amount: 100, method: 'Check', reference: 'CHK-1001', voided: false,
  source: 'QUICKBOOKS' as const, qboPaymentId: '157',
};
const LOCAL_PAYMENT = {
  id: 12, date: '2026-09-20', amount: 50, method: 'Cash', voided: false, source: 'SYSTEM' as const, qboPaymentId: null,
};

function receivable(partial: Partial<Receivable>): Receivable {
  return {
    id: 1, documentType: 'INVOICE', invoiceNumber: 'INV-QB-1', client: 'Cliente Demo', project: 'Torre Norte', projectId: 1,
    description: null, issuedDate: '2026-09-20', dueDate: '2026-10-20', subtotal: 325.5, discount: 0, taxRate: 0, tax: 0,
    amount: 325.5, paidAmount: 100, status: 'PARTIAL', notes: null, lineItems: [], payments: [],
    createdAt: '2026-09-20T10:00:00Z', updatedAt: '2026-09-25T10:00:00Z', signatureStatus: null,
    ...partial,
  };
}

function payable(partial: Partial<Payable>): Payable {
  return {
    id: 9, billNumber: 'BILL-QB-9', vendor: 'Ferretería Central', category: 'materials', project: 'Torre Norte', projectId: 1,
    description: null, documentType: 'BILL', invoiceNumber: null, receivedDate: '2026-09-20', dueDate: '2026-09-29',
    amount: 123.45, paidAmount: 0, status: 'pending', notes: null, payments: [],
    createdAt: '2026-09-20T10:00:00Z', updatedAt: '2026-09-25T10:00:00Z', attachmentCount: 0, firstAttachmentId: null,
    ...partial,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.listProjects.mockResolvedValue({ content: [] });
  mocks.listPayableVendors.mockResolvedValue([]);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

async function render(node: React.ReactElement) {
  await act(async () => { root.render(node); });
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

async function click(el: Element | undefined | null, what: string) {
  expect(el, what).toBeTruthy();
  await act(async () => { (el as HTMLElement).click(); });
  await act(async () => { await Promise.resolve(); });
}

const buttons = (label: string) =>
  [...container.querySelectorAll('button')].filter(b => b.textContent?.trim() === label) as HTMLButtonElement[];

describe('Cobrar — un documento cuyos cobros vienen de QuickBooks', () => {
  beforeEach(() => {
    mocks.listAllReceivables.mockImplementation((params?: { status?: string }) => Promise.resolve(params?.status ? [] : [
      receivable({ paymentsInQuickBooks: true, payments: [QBO_PAYMENT, LOCAL_PAYMENT] }),
      receivable({ id: 2, invoiceNumber: 'INV-HERE-2', paidAmount: 7, payments: [{ ...LOCAL_PAYMENT, id: 13, amount: 7 }] }),
    ]));
    mocks.listAllPayables.mockResolvedValue([]);
  });

  it('keeps «Cobrar» off with the reason, the other document as before', async () => {
    await render(<ReceivablesScreen />);
    await click(buttons('finance:receivable.view.byDocument')[0], 'the by-document view');

    const collect = buttons('finance:receivable.action.collect');
    // Two layouts per document (desk and phone), both in the DOM.
    expect(collect).toHaveLength(4);
    const [qbDesk, , hereDesk] = collect;
    expect(qbDesk.disabled).toBe(true);
    expect(qbDesk.parentElement!.getAttribute('title')).toBe('finance:paymentOrigin.registerInQuickBooks');
    expect(hereDesk.disabled).toBe(false);
    expect(hereDesk.parentElement!.getAttribute('title')).toBeNull();
  });

  it('counts in «Cobrado este mes» only what the server counts', async () => {
    await render(<ReceivablesScreen />);

    // 100 read from QuickBooks + 7 recorded on a plain document; the 50
    // recorded here on the QuickBooks one no longer counts.
    expect(container.textContent).toContain('107.00');
    expect(container.textContent).not.toContain('157.00');
  });

  it('shows where each collection came from, and never offers to void one read from QuickBooks', async () => {
    await render(<ReceivablesScreen />);
    await click(buttons('finance:receivable.view.byDocument')[0], 'the by-document view');
    await click(buttons('INV-QB-1')[0], 'open the document');

    const rows = [...container.querySelectorAll('[data-testid="receivable-payment"]')] as HTMLElement[];
    expect(rows).toHaveLength(2);
    const [qbo, local] = rows;
    expect(qbo.querySelector('[data-origin="quickbooks"]')).toBeTruthy();
    expect(qbo.querySelector('[title="paymentOrigin.qboId"]')).toBeTruthy();
    expect([...qbo.querySelectorAll('button')]).toHaveLength(0);
    expect(local.querySelector('[data-origin="local"]')).toBeTruthy();
    expect(local.querySelector('.line-through')).toBeTruthy();
    // Recorded here: it can still be filed away here.
    expect([...local.querySelectorAll('button')].map(b => b.textContent)).toEqual(['finance:receivable.void.action']);
    // Where «Cobrar» is off, the history says where to record it instead.
    expect(container.textContent).toContain('paymentOrigin.registerInQuickBooks');
  });
});

describe('Pagar — una cuenta cuyos pagos vienen de QuickBooks', () => {
  beforeEach(() => {
    mocks.listAllReceivables.mockResolvedValue([]);
    mocks.listAllPayables.mockResolvedValue([
      payable({ paymentsInQuickBooks: true }),
      payable({ id: 10, billNumber: 'BILL-HERE-10', vendor: 'Rentadora XYZ' }),
    ]);
  });

  it('keeps «Pagar» off with the reason and leaves it out of a batch run', async () => {
    await render(<PayablesScreen />);

    const pay = buttons('finance:payable.action.pay');
    // Desk and phone layouts of both bills.
    expect(pay).toHaveLength(4);
    const qbDesk = pay.find(b => b.closest('[role="button"]')?.textContent?.includes('BILL-QB-9'))!;
    const hereDesk = pay.find(b => b.closest('[role="button"]')?.textContent?.includes('BILL-HERE-10'))!;
    expect(qbDesk.disabled).toBe(true);
    expect(qbDesk.parentElement!.getAttribute('title')).toBe('finance:paymentOrigin.registerInQuickBooks');
    expect(hereDesk.disabled).toBe(false);

    // One tick per payable bill (desk + phone), none for the QuickBooks one.
    const ticks = [...container.querySelectorAll('input[type="checkbox"][aria-label="finance:payable.batch.selectOne"]')];
    expect(ticks).toHaveLength(2);
    expect(ticks.every(t => t.closest('[role="button"]')?.textContent?.includes('BILL-HERE-10'))).toBe(true);

    // Ticking the whole lane selects only what can be paid here: the run's
    // bar adds up one bill, not both.
    const lane = container.querySelector('input[type="checkbox"][aria-label="finance:payable.batch.selectLane"]');
    await click(lane, 'the lane tick');
    const run = [...container.querySelectorAll('div')].find(d => d.className.includes('sticky'));
    expect(run?.textContent).toContain('finance:payable.batch.selected');
    expect(run?.textContent).toContain('$123.45');
    expect(run?.textContent).not.toContain('$246.90');
  });
});
