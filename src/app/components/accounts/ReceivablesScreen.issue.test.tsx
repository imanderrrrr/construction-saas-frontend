// BuildTrack — Cobros issues documents too (Anderson's decision, 2026-10-12).
//
// Facturas and Cobrar were two screens; now one issues and collects. What the
// old Facturas did after issuing must survive the move: the new document is
// on screen and lit, a note says where its signature is asked for, «Ver cómo»
// puts the tour on that block, and the PDF with the client's signature can
// still be downloaded. The header's figures are the server's, for the whole
// company, with the rows as the fallback for whatever an older server does
// not send. Same harness as the other Cobros tests: services faked at the
// module boundary, texts as their keys.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Receivable, ReceivableSummary } from '../../services/finance';

const mocks = vi.hoisted(() => ({
  listAllReceivables: vi.fn(),
  listAllPayables: vi.fn(),
  listProjects: vi.fn(),
  getReceivableSummary: vi.fn(),
  loadInvoiceIssuer: vi.fn(),
  loadSignatureForPdf: vi.fn(),
  downloadInvoicePdf: vi.fn(),
  issued: { document: null as unknown },
}));

vi.mock('react-i18next', () => {
  const t = (key: string, opts?: Record<string, unknown>) =>
    opts && typeof opts === 'object' && !Array.isArray(opts)
      ? `${key}|${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')}`
      : key;
  return { useTranslation: () => ({ t, i18n: { language: 'es' } }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('../../services/auth', () => ({ AuthService: { getCanonicalRole: () => 'ADMIN' } }));
vi.mock('../../services/projects', () => ({ listProjects: mocks.listProjects }));
vi.mock('../../services/invoiceBranding', () => ({ loadInvoiceIssuer: mocks.loadInvoiceIssuer }));
vi.mock('../../services/signatures', () => ({ loadSignatureForPdf: mocks.loadSignatureForPdf }));
vi.mock('../../helpers/exportInvoicePdf', () => ({ downloadInvoicePdf: mocks.downloadInvoicePdf }));
vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error { code?: string },
  getBaseUrl: () => '',
}));
vi.mock('../../services/finance', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/finance')>();
  return {
    paymentCounts: real.paymentCounts,
    hasLiveQuickBooksPayment: real.hasLiveQuickBooksPayment,
    listAllReceivables: mocks.listAllReceivables,
    listAllPayables: mocks.listAllPayables,
    getReceivableSummary: mocks.getReceivableSummary,
    voidReceivablePayment: vi.fn(),
    approveChangeOrder: vi.fn(),
    rejectChangeOrder: vi.fn(),
    downloadReceivableDocument: vi.fn(),
    recordReceivablePayment: vi.fn(),
    updateReceivableInfo: vi.fn(),
    deleteReceivable: vi.fn(),
    getReceivable: vi.fn(),
  };
});
// The window is the real one's contract only: it hands back what the server
// created. Which document depends on the test, so it is read at click time.
vi.mock('../invoices/InvoiceWindow', () => ({
  InvoiceWindow: ({ onCreated, onClose }: { onCreated: (c: unknown) => void; onClose: () => void }) => (
    <div data-testid="invoice-window">
      <button type="button" data-testid="issue" onClick={() => onCreated(mocks.issued.document)}>issue</button>
      <button type="button" data-testid="close-window" onClick={onClose}>close</button>
    </div>
  ),
}));
vi.mock('../signatures/SignatureRequestPanel', () => ({
  SignatureRequestPanel: ({ receivableId }: { receivableId: number }) => <div data-testid="signature-panel" data-id={receivableId} />,
}));
vi.mock('../../helpers/dateTime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../helpers/dateTime')>()),
  businessToday: () => '2026-10-03',
  currentMonth: () => '2026-10',
}));

import { ReceivablesScreen } from './ReceivablesScreen';
import { resetSectionIntents, setSectionIntent } from '../../lib/sectionIntent';
import { peekTourRequest, resetTourRequests } from '../../lib/tourRequest';

function receivable(partial: Partial<Receivable>): Receivable {
  return {
    id: 1, documentType: 'INVOICE', invoiceNumber: 'INV-2026-1', client: 'Cliente Demo', project: 'Torre Norte', projectId: 1,
    description: null, issuedDate: '2026-10-01', dueDate: '2026-10-31', subtotal: 1250, discount: 0, taxRate: 0, tax: 0,
    amount: 1250, paidAmount: 0, status: 'pending', notes: null, lineItems: [], payments: [],
    createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', signatureStatus: null,
    ...partial,
  };
}

/** What the server answers today, before the Cobros figures (B3) reach it. */
const OLDER_SUMMARY: ReceivableSummary = {
  issuedThisMonth: 9800, issuedThisMonthCount: 4, outstanding: 15000, overdue: 4000, overdueCount: 2,
  month: '2026-10', asOf: '2026-10-03',
};

const ISSUED = receivable({ id: 77, invoiceNumber: 'INV-2026-77', client: 'Grupo Marisol' });
const CHANGE_ORDER = receivable({ id: 78, documentType: 'CHANGE_ORDER_REQUEST', invoiceNumber: 'COR-2026-3', status: 'pending_approval' });

let container: HTMLDivElement;
let root: Root;
let rows: Receivable[];

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  resetSectionIntents();
  resetTourRequests();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  rows = [receivable({ id: 41, invoiceNumber: 'INV-2026-41' })];
  mocks.listProjects.mockResolvedValue({ content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
  mocks.listAllPayables.mockResolvedValue([]);
  mocks.listAllReceivables.mockImplementation((params?: { status?: string }) => Promise.resolve(params?.status ? [] : rows));
  mocks.getReceivableSummary.mockRejectedValue(new Error('no summary'));
  mocks.loadInvoiceIssuer.mockResolvedValue(undefined);
  mocks.loadSignatureForPdf.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

async function flush(times = 4) {
  for (let i = 0; i < times; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  }
}

async function render() {
  await act(async () => { root.render(<ReceivablesScreen onNavigate={vi.fn()} />); });
  await flush();
}

const notice = () => container.querySelector('[data-testid="invoice-created-notice"]');
const window_ = () => container.querySelector('[data-testid="invoice-window"]');
const button = (text: string) =>
  Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text)) as HTMLButtonElement | undefined;
const figuresText = () => container.querySelector('[data-tour="sec.accounts-receivable.overdue"]')?.parentElement?.parentElement?.textContent ?? '';

async function issue(document: Receivable) {
  mocks.issued.document = document;
  await act(async () => { container.querySelector<HTMLElement>('[data-testid="issue-document"]')!.click(); });
  await flush();
  expect(window_(), 'the window takes the screen').not.toBeNull();
  rows = [...rows, document];
  await act(async () => { container.querySelector<HTMLElement>('[data-testid="issue"]')!.click(); });
  await flush();
}

describe('Cobros — issuing a document', () => {
  it('issues from the header and opens the new document', async () => {
    await render();
    // Closing without issuing comes back where it was, and says nothing.
    await act(async () => { container.querySelector<HTMLElement>('[data-testid="issue-document"]')!.click(); });
    await flush();
    expect(window_()).not.toBeNull();
    await act(async () => { container.querySelector<HTMLElement>('[data-testid="close-window"]')!.click(); });
    await flush();
    expect(window_()).toBeNull();
    expect(notice()).toBeNull();

    await issue(ISSUED);

    expect(window_(), 'issuing closes the window').toBeNull();
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('finance:receivable.view.byDocument');
    const panel = container.querySelector('[data-testid="signature-panel"]');
    expect(panel, 'the new document is open, on its signature block').not.toBeNull();
    expect(panel!.getAttribute('data-id')).toBe('77');
    expect(container.querySelector('.bt-row-flash'), 'and lit for a moment').not.toBeNull();
    expect(notice()!.textContent).toContain('finance:invoice.created.invoice|number=INV-2026-77');
    expect(notice()!.textContent).toContain('finance:invoice.created.signatureHint');
  });

  it('«Ver cómo» sends the tour to the signature stop', async () => {
    await render();
    await issue(ISSUED);
    await act(async () => { button('finance:invoice.created.seeHow')!.click(); });
    expect(peekTourRequest()).toEqual({ section: 'accounts-receivable', key: 'signature' });

    const close = container.querySelector<HTMLButtonElement>('[data-testid="invoice-created-notice"] button[aria-label="common:buttons.close"]');
    await act(async () => { close!.click(); });
    expect(notice()).toBeNull();
  });

  it('a change order waiting for approval is not opened among the rows', async () => {
    await render();
    await issue(CHANGE_ORDER);
    expect(notice()!.textContent).toContain('finance:invoice.created.changeOrder|number=COR-2026-3');
    expect(notice()!.textContent).toContain('finance:invoice.created.signatureHintChangeOrder');
    expect(container.querySelector('[data-testid="signature-panel"]')).toBeNull();
  });

  it('a section or an old «Facturas» link lands here with the window open', async () => {
    setSectionIntent('accounts-receivable', { openIssue: true });
    await render();
    expect(window_()).not.toBeNull();
  });
});

describe('Cobros — the PDF with the client signature', () => {
  it('the menu downloads the signed PDF', async () => {
    const signature = { signerName: 'Ana', imageDataUrl: 'data:image/png,firma' };
    mocks.loadSignatureForPdf.mockResolvedValue(signature);
    setSectionIntent('accounts-receivable', { openReceivableId: 41 });
    await render();

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="common:labels.actions"]');
    expect(trigger).not.toBeNull();
    // Radix opens its menu on pointerdown.
    await act(async () => {
      trigger!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false, pointerType: 'mouse' }));
    });
    await flush();
    const item = Array.from(document.querySelectorAll('[role="menuitem"]'))
      .find(el => el.textContent?.includes('finance:receivable.action.downloadSigned')) as HTMLElement | undefined;
    expect(item, 'the menu offers the signed PDF').toBeTruthy();
    await act(async () => { item!.click(); });
    await flush();

    expect(mocks.loadSignatureForPdf).toHaveBeenCalledWith(41);
    expect(mocks.downloadInvoicePdf).toHaveBeenCalledTimes(1);
    const [data, , sig, lang] = mocks.downloadInvoicePdf.mock.calls[0];
    expect(data).toMatchObject({ invoiceNumber: 'INV-2026-41', documentType: 'INVOICE', client: 'Cliente Demo', amount: 1250 });
    expect(sig).toBe(signature);
    expect(lang).toBe('es');
  });
});

describe('Cobros — the header figures', () => {
  // Rows: one overdue document ($200 owed), one not yet due ($300 owed, $500
  // of it already collected this month).
  const ROWS = () => [
    receivable({ id: 60, amount: 200, dueDate: '2026-09-20' }),
    receivable({
      id: 61, amount: 800, paidAmount: 500, status: 'partial', dueDate: '2026-11-15',
      payments: [{ id: 9, date: '2026-10-02', amount: 500, method: 'TRANSFER' }],
    }),
  ];

  it('figures come from the server summary and fall back to the rows', async () => {
    rows = ROWS();
    mocks.getReceivableSummary.mockResolvedValue({
      ...OLDER_SUMMARY, collectedThisMonth: 2500, collectedThisMonthCount: 3, pending: 11000, pendingCount: 5,
    });
    await render();
    let text = figuresText();
    expect(text, 'overdue, from the server').toContain('$4,000.00');
    expect(text).toContain('finance:receivable.fig.overdueCount|count=2');
    expect(text, 'not yet due, from the server').toContain('$11,000.00');
    expect(text).toContain('finance:receivable.fig.notYetDueMeta|count=5');
    expect(text, 'collected this month, from the server').toContain('$2,500.00');
    expect(text).toContain('$15,000.00');
    expect(container.textContent).toContain('finance:receivable.context.issuedMonth|count=4');
    expect(container.textContent).toContain('$9,800.00');

    // A server without the Cobros figures: those two come from the rows —
    // never NaN, never a false $0.
    await act(async () => root.unmount());
    root = createRoot(container);
    mocks.getReceivableSummary.mockResolvedValue(OLDER_SUMMARY);
    await render();
    text = figuresText();
    expect(text, 'overdue still from the server').toContain('$4,000.00');
    expect(text, 'not yet due from the rows').toContain('$300.00');
    expect(text).toContain('finance:receivable.fig.notYetDueMeta|count=1');
    expect(text, 'collected from the rows').toContain('$500.00');
    expect(text).not.toContain('NaN');

    // No summary at all: everything from the rows.
    await act(async () => root.unmount());
    root = createRoot(container);
    mocks.getReceivableSummary.mockRejectedValue(new Error('older server'));
    await render();
    text = figuresText();
    expect(text, 'overdue from the rows').toContain('$200.00');
    expect(text).toContain('$300.00');
    expect(text).toContain('$500.00');
    expect(container.textContent).not.toContain('finance:receivable.context.issuedMonth');
  });
});

describe('Cobros — filters', () => {
  it('filters by document type', async () => {
    rows = [
      receivable({ id: 70, invoiceNumber: 'INV-2026-70', client: 'Grupo Marisol' }),
      receivable({ id: 71, documentType: 'CHANGE_ORDER_REQUEST', invoiceNumber: 'COR-2026-71', client: 'Cliente Demo' }),
    ];
    await render();
    const list = () => container.querySelector('[data-tour="sec.accounts-receivable.rows"]')?.textContent ?? '';
    expect(list()).toContain('Grupo Marisol');
    expect(list()).toContain('Cliente Demo');

    const select = container.querySelector<HTMLSelectElement>('select[aria-label="finance:receivable.filter.type"]');
    expect(select, 'a document-type filter').not.toBeNull();
    await act(async () => { select!.value = 'CHANGE_ORDER_REQUEST'; select!.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(list()).toContain('Cliente Demo');
    expect(list()).not.toContain('Grupo Marisol');
  });
});
