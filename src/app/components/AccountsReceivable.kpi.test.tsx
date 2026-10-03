import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ list: vi.fn(), summary: vi.fn() }));
vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t, i18n: { language: 'en' } }) };
});
vi.mock('../services/finance', () => ({
  listAllReceivables: svc.list, getReceivableSummary: svc.summary,
  recordReceivablePayment: vi.fn(), approveChangeOrder: vi.fn(), updateReceivableInfo: vi.fn(), deleteReceivable: vi.fn(),
}));
vi.mock('../services/auth', () => ({ AuthService: { getCanonicalRole: () => 'ADMIN' } }));
vi.mock('../lib/api', () => ({ ApiError: class extends Error {} }));
vi.mock('../helpers/exportInvoicePdf', () => ({ downloadInvoicePdf: vi.fn() }));
vi.mock('../services/signatures', () => ({ loadSignatureForPdf: vi.fn() }));
vi.mock('../services/invoiceBranding', () => ({ loadInvoiceIssuer: vi.fn() }));
vi.mock('./signatures/SignatureRequestPanel', () => ({ SignatureRequestPanel: () => null }));
vi.mock('./invoices/InvoiceWindow', () => ({ InvoiceWindow: () => <div data-testid="shared-document-form" /> }));
vi.mock('../helpers/dateTime', () => ({ businessToday: () => '2026-10-03', currentMonthLabel: () => 'Oct 2026', fmtDate: (v: string) => v, daysOverdue: () => 0 }));

import { AccountsReceivable } from './AccountsReceivable';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Collections', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    svc.list.mockResolvedValue([]);
    svc.summary.mockResolvedValue({ outstanding: 100, collectedThisMonth: 90, pending: 75, pendingCount: 2, overdue: 25, overdueCount: 1, month: '2026-10' });
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); });
  const render = () => act(async () => root.render(<AccountsReceivable />));

  it('shows server totals even when the list is empty', async () => {
    await render();
    const cards = container.querySelector('[data-tour="sec.accounts-receivable.kpis"]')!;
    expect(cards.textContent).toContain('$100.00');
    expect(cards.textContent).toContain('$90.00');
    expect(cards.textContent).toContain('$75.00');
    expect(cards.textContent).toContain('$25.00');
  });

  it('shows an unavailable total and retry instead of inventing zero when the summary fails', async () => {
    svc.summary.mockRejectedValueOnce(new Error('unavailable'));
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('finance:receivable.summaryError');
    expect(container.querySelector('[data-tour="sec.accounts-receivable.kpis"]')?.textContent).toContain('—');
    await act(async () => (container.querySelector('[role="alert"] button') as HTMLButtonElement).click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain('$100.00');
  });

  it('opens the shared invoice and change-order form', async () => {
    await render();
    const create = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('finance:receivable.newInvoice'))!;
    await act(async () => create.click());
    expect(container.querySelector('[data-testid="shared-document-form"]')).not.toBeNull();
  });
});
