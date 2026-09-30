// BuildTrack — Facturas says, once the document is issued, where the client's
// signature is asked for.
//
// The owner issued a receivable and did not know the signature comes later,
// from the document in Cuentas por Cobrar: nothing on the screen said so. The
// list still lights the new row up and the PDF still downloads; on top of
// that, a note under the header names the document, says when and where to
// ask, and «Ver cómo» takes the user there with the tour on the block.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => {
  const t = (key: string, opts?: Record<string, unknown>) =>
    opts && typeof opts === 'object' && !Array.isArray(opts)
      ? `${key}|${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')}`
      : key;
  const i18n = { language: 'es' };
  return {
    useTranslation: () => ({ t, i18n }),
    Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    initReactI18next: { type: '3rdParty', init: () => {} },
  };
});
vi.mock('../helpers/exportInvoicePdf', () => ({
  downloadInvoicePdf: vi.fn(),
  invoicePdfPreviewUrl: () => 'blob:preview',
}));
vi.mock('../services/invoiceBranding', () => ({ loadInvoiceIssuer: () => Promise.resolve(undefined) }));
vi.mock('../services/signatures', () => ({ loadSignatureForPdf: () => Promise.resolve(undefined) }));

const listReceivables = vi.fn();
vi.mock('../services/finance', () => ({ listReceivables: (...a: unknown[]) => listReceivables(...a) }));
const listProjects = vi.fn();
vi.mock('../services/projects', () => ({ listProjects: (...a: unknown[]) => listProjects(...a) }));

// The window is the real one's contract only: it hands back what the server
// created. Which document depends on the test, so it is read at click time.
const issued = vi.hoisted(() => ({ document: null as unknown }));
vi.mock('./invoices/InvoiceWindow', () => ({
  InvoiceWindow: ({ onCreated }: { onCreated: (created: unknown) => void }) => (
    <button type="button" data-testid="issue" onClick={() => onCreated(issued.document)}>issue</button>
  ),
}));

import { InvoiceManager } from './InvoiceManager';
import { peekSectionIntent, resetSectionIntents } from '../lib/sectionIntent';
import { peekTourRequest, resetTourRequests } from '../lib/tourRequest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const INVOICE = {
  id: 4, documentType: 'INVOICE', invoiceNumber: 'INV-2026-4', client: 'Grupo Marisol',
  project: 'Torre Norte', projectId: 7, description: null,
  issuedDate: '2026-09-02', dueDate: '2026-10-02',
  subtotal: 12500, discount: 0, taxRate: 0, tax: 0, amount: 12500, paidAmount: 0,
  status: 'pending', notes: null, lineItems: [], payments: [],
  createdAt: '2026-09-02T10:00:00Z', updatedAt: '2026-09-02T10:00:00Z',
};
const CHANGE_ORDER = { ...INVOICE, id: 5, documentType: 'CHANGE_ORDER_REQUEST', invoiceNumber: 'COR-2026-2', status: 'pending_approval' };

function page(content: unknown[], total = content.length) {
  return { content, page: 0, size: 20, totalElements: total, totalPages: 1 };
}

async function flush(times = 3) {
  for (let i = 0; i < times; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  }
}

describe('InvoiceManager — the note after issuing a document', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetSectionIntents();
    resetTourRequests();
    listProjects.mockResolvedValue(page([]));
    listReceivables.mockResolvedValue(page([INVOICE]));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  const notice = () => container.querySelector('[data-testid="invoice-created-notice"]');
  const button = (text: string) =>
    Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

  async function issue(document: unknown, withNavigate = true) {
    issued.document = document;
    await act(async () => { root.render(<InvoiceManager onNavigate={withNavigate ? onNavigate : undefined} />); });
    await flush();
    await act(async () => { container.querySelector<HTMLElement>('[data-tour="sec.invoices.new"]')!.click(); });
    await act(async () => { container.querySelector<HTMLElement>('[data-testid="issue"]')!.click(); });
    await flush();
  }

  it('names the invoice and says the signature is asked for later, from Cobrar', async () => {
    expect(notice(), 'nothing to say before anything is issued').toBeNull();
    await issue(INVOICE);

    expect(notice()).not.toBeNull();
    expect(notice()!.textContent).toContain('finance:invoice.created.invoice|number=INV-2026-4');
    expect(notice()!.textContent).toContain('finance:invoice.created.signatureHint');
    expect(notice()!.textContent).not.toContain('signatureHintChangeOrder');
    // The list still did its part: the new row is there, lit.
    expect(container.querySelector('[data-testid="invoice-row-4"]')).not.toBeNull();
  });

  it('a change order is told it is signed once approved', async () => {
    await issue(CHANGE_ORDER);
    expect(notice()!.textContent).toContain('finance:invoice.created.changeOrder|number=COR-2026-2');
    expect(notice()!.textContent).toContain('finance:invoice.created.signatureHintChangeOrder');
  });

  it('«Ver cómo» opens Cobrar on that document with the tour at its signature stop', async () => {
    await issue(INVOICE);
    const seeHow = button('finance:invoice.created.seeHow');
    expect(seeHow).toBeTruthy();

    await act(async () => { seeHow!.click(); });

    expect(peekSectionIntent('accounts-receivable')).toEqual({ openReceivableId: 4 });
    expect(peekTourRequest()).toEqual({ section: 'accounts-receivable', key: 'signature' });
    expect(onNavigate).toHaveBeenCalledWith('accounts-receivable');
  });

  it('closes on its square close, and offers no way there when the screen has none', async () => {
    await issue(INVOICE, false);
    expect(notice()).not.toBeNull();
    expect(button('finance:invoice.created.seeHow'), 'no onNavigate → no «Ver cómo»').toBeUndefined();

    const close = container.querySelector<HTMLButtonElement>('[data-testid="invoice-created-notice"] button[aria-label="common:buttons.close"]');
    expect(close).not.toBeNull();
    await act(async () => { close!.click(); });
    expect(notice()).toBeNull();
    expect(peekSectionIntent('accounts-receivable'), 'closing asks for nothing').toBeNull();
  });
});
