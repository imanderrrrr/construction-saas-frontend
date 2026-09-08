// BuildTrack — Facturas is a list now, and the list tells the truth about
// what the server did and did not return.
//
// Two server behaviours this pins, both read off `origin/main` of the API:
// the repository query drops PENDING_APPROVAL from any request with no
// status filter, so the screen has to say so; and the three leading figures
// are counts the server produced, never a sum over the loaded page.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `t` must keep one identity across renders: the real hook returns a stable
// function, and the screen puts it in a useCallback dependency list that
// feeds an effect. A fresh closure per render would loop forever.
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
vi.mock('./invoices/InvoiceWindow', () => ({ InvoiceWindow: () => <div data-testid="invoice-window" /> }));
vi.mock('../services/invoiceBranding', () => ({ loadInvoiceIssuer: () => Promise.resolve(undefined) }));
vi.mock('../services/signatures', () => ({ loadSignatureForPdf: () => Promise.resolve(undefined) }));

const listReceivables = vi.fn();
vi.mock('../services/finance', () => ({ listReceivables: (...a: unknown[]) => listReceivables(...a) }));
const listProjects = vi.fn();
vi.mock('../services/projects', () => ({ listProjects: (...a: unknown[]) => listProjects(...a) }));

import { InvoiceManager } from './InvoiceManager';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ROW = {
  id: 4, documentType: 'INVOICE', invoiceNumber: 'INV-2026-4', client: 'Grupo Marisol',
  project: 'Torre Norte', projectId: 7, description: 'Cimentación, fase 2',
  issuedDate: '2026-09-02', dueDate: '2026-10-02',
  subtotal: 12500, discount: 0, taxRate: 0, tax: 0, amount: 12500, paidAmount: 0,
  status: 'pending', notes: null, lineItems: [], payments: [],
  createdAt: '2026-09-02T10:00:00Z', updatedAt: '2026-09-02T10:00:00Z',
};

function page(content: unknown[], total = content.length) {
  return { content, page: 0, size: 20, totalElements: total, totalPages: 1 };
}

async function flush(times = 3) {
  for (let i = 0; i < times; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  }
}

describe('InvoiceManager — the list', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    listProjects.mockResolvedValue(page([]));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  const mount = async () => {
    await act(async () => { root.render(<InvoiceManager />); });
    await flush();
  };

  it('shows the documents the server returned', async () => {
    listReceivables.mockResolvedValue(page([ROW]));
    await mount();
    expect(container.querySelector('[data-testid="invoice-row-4"]')).not.toBeNull();
    expect(container.textContent).toContain('INV-2026-4');
    expect(container.textContent).toContain('Grupo Marisol');
  });

  it('warns that unapproved change orders are missing until you filter for them', async () => {
    listReceivables.mockResolvedValue(page([ROW]));
    await mount();
    expect(container.textContent).toContain('invoice.list.hiddenCors');
  });

  it('takes the three figures from the server, one query each — never from the page', async () => {
    listReceivables.mockImplementation((params: Record<string, unknown> = {}) => {
      if (params.status === 'PENDING') return Promise.resolve(page([], 9));
      if (params.status === 'PARTIAL') return Promise.resolve(page([], 2));
      if (params.status === 'PENDING_APPROVAL') return Promise.resolve(page([], 3));
      if (params.size === 1) return Promise.resolve(page([], 5)); // this month
      return Promise.resolve(page([ROW], 1)); // the list itself: one row
    });
    await mount();

    const figures = container.querySelector('[data-testid="invoice-figures"]')!;
    const numbers = Array.from(figures.querySelectorAll('.font-bt-display')).map(n => n.textContent);
    // 5 issued this month, 9 + 2 receivable, 3 awaiting approval — none of
    // which could have been derived from the single row on the page.
    expect(numbers).toEqual(['5', '11', '3']);
  });

  it('falls back to “—” when the counts fail, and never fills them in from the rows', async () => {
    listReceivables.mockImplementation((params: Record<string, unknown> = {}) =>
      params.size === 1 ? Promise.reject(new Error('down')) : Promise.resolve(page([ROW], 1)));
    await mount();

    const figures = container.querySelector('[data-testid="invoice-figures"]')!;
    expect(Array.from(figures.querySelectorAll('.font-bt-display')).map(n => n.textContent)).toEqual(['—', '—', '—']);
    expect(container.textContent).toContain('invoice.figure.failed');
  });

  it('offers no status the server cannot filter on', async () => {
    listReceivables.mockResolvedValue(page([ROW]));
    await mount();
    const statusSelect = container.querySelector<HTMLSelectElement>('[aria-label="finance:invoice.filter.status"]')!;
    const values = Array.from(statusSelect.options).map(o => o.value);
    // OVERDUE is derived on read and never stored, so ?status=OVERDUE always
    // comes back empty: offering it would be a filter that finds nothing.
    expect(values).not.toContain('OVERDUE');
    expect(values).toEqual(['', 'PENDING', 'PARTIAL', 'PAID', 'PENDING_APPROVAL', 'REJECTED']);
  });

  it('says the list failed instead of showing an empty section', async () => {
    listReceivables.mockRejectedValue(new Error('network'));
    await mount();
    expect(container.textContent).toContain('invoice.list.errorTitle');
    expect(container.textContent).not.toContain('invoice.list.emptyTitle');
  });
});
