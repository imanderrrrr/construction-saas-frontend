// BuildTrack — Cobros issues documents too (owner decision, 2026-10).
//
// Facturas and Cobrar were two screens; now one issues and collects. What the
// old Facturas did after issuing must survive the move: the new document is
// on screen and lit, a note says where its signature is asked for, «Ver cómo»
// puts the tour on that block, the PDF with the client's signature can still
// be downloaded, and a section that asks for Facturas lands here with the
// window open. The header's figures are the server's, for the whole company,
// with the rows as the fallback. Same harness as the other Cobros tests:
// services faked at the module boundary, texts as their keys.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Receivable } from '../../services/finance';

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
  mocks.listProjects.mockResolvedValue({ content: [] });
  mocks.listAllPayables.mockResolvedValue([]);
  mocks.listAllReceivables.mockImplementation((params?: { status?: string }) => Promise.resolve(params?.status ? [] : rows));
  mocks.getReceivableSummary.mockRejectedValue(new Error('older server'));
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
const button = (text: string) =>
  Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

async function issue(document: Receivable) {
  mocks.issued.document = document;
  await act(async () => { container.querySelector<HTMLElement>('[data-tour="sec.accounts-receivable.new"]')!.click(); });
  await flush();
  expect(container.querySelector('[data-testid="invoice-window"]'), 'the window takes the screen').not.toBeNull();
  rows = [...rows, document];
  await act(async () => { container.querySelector<HTMLElement>('[data-testid="issue"]')!.click(); });
  await flush();
}

describe('Cobros — issuing a document', () => {
  it('opens the issue window from the header, and comes back where it was', async () => {
    await render();
    await act(async () => { container.querySelector<HTMLElement>('[data-testid="issue-document"]')!.click(); });
    await flush();
    expect(container.querySelector('[data-testid="invoice-window"]')).not.toBeNull();
    await act(async () => { container.querySelector<HTMLElement>('[data-testid="close-window"]')!.click(); });
    await flush();
    expect(container.querySelector('[data-testid="invoice-window"]')).toBeNull();
    expect(notice(), 'closing without issuing says nothing').toBeNull();
  });

  it('opens the new invoice right here, lit, with the note about its signature', async () => {
    await render();
    await issue(ISSUED);

    expect(notice()!.textContent).toContain('finance:invoice.created.invoice|number=INV-2026-77');
    expect(notice()!.textContent).toContain('finance:invoice.created.signatureHint');
    const panel = container.querySelector('[data-testid="signature-panel"]');
    expect(panel, 'the document is open on its signature block').not.toBeNull();
    expect(panel!.getAttribute('data-id')).toBe('77');
    expect(container.querySelector('.bt-row-flash')).not.toBeNull();
  });

  it('a change order waiting for approval is told it is signed once approved, and not opened among the rows', async () => {
    await render();
    await issue(CHANGE_ORDER);
    expect(notice()!.textContent).toContain('finance:invoice.created.changeOrder|number=COR-2026-3');
    expect(notice()!.textContent).toContain('finance:invoice.created.signatureHintChangeOrder');
    expect(container.querySelector('[data-testid="signature-panel"]')).toBeNull();
  });

  it('«Ver cómo» asks the tour for its signature stop, here, and the note closes on its square', async () => {
    await render();
    await issue(ISSUED);
    await act(async () => { button('finance:invoice.created.seeHow')!.click(); });
    expect(peekTourRequest()).toEqual({ section: 'accounts-receivable', key: 'signature' });

    const close = container.querySelector<HTMLButtonElement>('[data-testid="invoice-created-notice"] button[aria-label="common:buttons.close"]');
    await act(async () => { close!.click(); });
    expect(notice()).toBeNull();
  });

  it('a section that asks for Facturas lands here with the window open', async () => {
    setSectionIntent('accounts-receivable', { openIssue: true });
    await render();
    expect(container.querySelector('[data-testid="invoice-window"]')).not.toBeNull();
  });
});

describe('Cobros — the PDF with the client signature', () => {
  it('is in each document menu, with the signature fetched on the click', async () => {
    const signature = { signerName: 'Ana', imageDataUrl: 'data:image/png;base64,AAAA' };
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
    expect(data).toMatchObject({ invoiceNumber: 'INV-2026-41', documentType: 'INVOICE' });
    expect(sig).toBe(signature);
    expect(lang).toBe('es');
  });
});

describe('Cobros — the header figures', () => {
  it('reads the server figures for the whole company, and says what was issued this month', async () => {
    mocks.getReceivableSummary.mockResolvedValue({
      issuedThisMonth: 9800, issuedThisMonthCount: 4, outstanding: 15000, overdue: 4000, overdueCount: 2,
      month: '2026-10', asOf: '2026-10-03',
      collectedThisMonth: 2500, collectedThisMonthCount: 3, pending: 11000, pendingCount: 5,
    });
    await render();
    const text = container.textContent ?? '';
    expect(text).toContain('$4,000.00');
    expect(text).toContain('finance:receivable.fig.overdueCount|count=2');
    expect(text).toContain('$11,000.00');
    expect(text).toContain('finance:receivable.fig.notYetDueMeta|count=5');
    expect(text).toContain('$2,500.00');
    expect(text).toContain('$15,000.00');
    expect(text).toContain('finance:receivable.context.issuedMonth|count=4');
    expect(text).toContain('$9,800.00');
  });

  it('falls back to the rows when the server has no summary', async () => {
    rows = [receivable({ id: 50, amount: 1250, dueDate: '2026-11-15' })];
    await render();
    const text = container.textContent ?? '';
    expect(text).toContain('$1,250.00');
    expect(text).not.toContain('finance:receivable.context.issuedMonth');
  });
});
