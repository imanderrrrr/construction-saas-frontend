// The invoice queue, and the bug it exists to close.
//
// "Registrar pago" used to hang off PENDING_PAYMENT alone — a status nothing
// in the backend wrote then. So an approved invoice could not be paid from the
// panel at all: the row offered "Revisar" instead, and the server answered 409.
// Since approving creates the invoice's bill (2026-10), PENDING_PAYMENT is
// real: a partially paid invoice, which can still be paid.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ listInvoices: vi.fn() }));
vi.mock('../../services/subcontractors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/subcontractors')>()),
  listInvoices: svc.listInvoices,
}));

import i18n from '../../../i18n';
import { InvoicesTab } from './InvoicesTab';
import { buttonByText, flush, invoice, page, SUMMARY } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const REF = { subcontractors: [], projects: [], state: 'ready' as const, reload: () => {} };

describe('InvoicesTab', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onReview = vi.fn();
  const onPay = vi.fn();

  beforeAll(() => i18n.changeLanguage('es'));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onReview.mockReset();
    onPay.mockReset();
    svc.listInvoices.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (rows: ReturnType<typeof invoice>[], summaryState: 'loading' | 'ready' | 'failed' = 'ready') => {
    svc.listInvoices.mockResolvedValue(page(rows));
    await act(async () => root.render(
      <InvoicesTab
        summary={summaryState === 'ready' ? SUMMARY : null}
        summaryState={summaryState}
        refData={REF}
        onReview={onReview}
        onPay={onPay}
        flashInvoiceId={null}
      />,
    ));
    await flush();
  };

  it('offers "Registrar pago" on an APPROVED invoice, not "Revisar"', async () => {
    const approved = invoice({ id: 410, status: 'APPROVED', invoiceNumber: 'F-2026-0410' });
    await render([approved]);

    const row = container.querySelector('[data-testid="invoice-row-410"]')!;
    expect(buttonByText(row, 'Registrar pago')).toBeTruthy();
    expect(buttonByText(row, 'Revisar')).toBeUndefined();

    act(() => buttonByText(row, 'Registrar pago')!.click());
    expect(onPay).toHaveBeenCalledWith(expect.objectContaining({ id: 410 }));
  });

  it('offers "Revisar" only while the invoice waits on a decision', async () => {
    await render([
      invoice({ id: 421, status: 'SUBMITTED' }),
      invoice({ id: 418, status: 'IN_REVIEW' }),
    ]);
    for (const id of [421, 418]) {
      expect(buttonByText(container.querySelector(`[data-testid="invoice-row-${id}"]`)!, 'Revisar')).toBeTruthy();
    }
  });

  it('asks nothing of you on an observed invoice — it is their move', async () => {
    await render([invoice({ id: 402, status: 'OBSERVED' })]);
    const row = container.querySelector('[data-testid="invoice-row-402"]')!;
    expect(row.textContent).toContain('En su cancha');
    expect(row.querySelector('button')).toBeNull();
  });

  it('closes a paid invoice with its reference instead of an action', async () => {
    await render([invoice({ id: 388, status: 'PAID', paymentReference: 'TRF-99421', paidAt: '2026-08-20T10:00:00Z' })]);
    const row = container.querySelector('[data-testid="invoice-row-388"]')!;
    expect(row.textContent).toContain('TRF-99421');
    expect(row.querySelector('button')).toBeNull();
  });

  it('gives exactly one row the primary button — the queue is not six emergencies', async () => {
    await render([
      invoice({ id: 1, status: 'SUBMITTED' }),
      invoice({ id: 2, status: 'IN_REVIEW' }),
      invoice({ id: 3, status: 'SUBMITTED' }),
    ]);
    const primary = Array.from(container.querySelectorAll('[data-testid^="invoice-row-"] button'))
      .filter(b => b.className.includes('bg-[#F97316]') || b.className.includes('bg-[#0A0A0A]'));
    expect(primary).toHaveLength(1);
  });

  it('offers "Pagada en parte" as a filter, now that partial payments write it', async () => {
    await render([invoice({ id: 1 })]);
    const options = Array.from(container.querySelectorAll('option')).map(o => o.value);
    expect(options.filter(v => ['SUBMITTED', 'IN_REVIEW', 'OBSERVED', 'APPROVED', 'PENDING_PAYMENT', 'PAID'].includes(v))).toHaveLength(6);
  });

  it('says what is still owed on a partially paid invoice, and keeps it payable', async () => {
    await render([invoice({ id: 7, status: 'PENDING_PAYMENT', amountCents: 840_000, paidAmountCents: 340_000, outstandingCents: 500_000 })]);
    const row = container.querySelector('[data-testid="invoice-row-7"]')!;
    expect(row.textContent).toContain('Pagada en parte · falta $5,000.00');
    expect(buttonByText(row, 'Registrar pago')).toBeTruthy();
  });

  it('points to QuickBooks instead of offering a payment the server would refuse', async () => {
    await render([invoice({ id: 8, status: 'APPROVED', paymentsInQuickBooks: true })]);
    const row = container.querySelector('[data-testid="invoice-row-8"]')!;
    expect(row.textContent).toContain('Se paga en QuickBooks');
    expect(buttonByText(row, 'Registrar pago')).toBeUndefined();
  });

  it('writes an em dash when the figures never arrive, and never counts the page', async () => {
    await render([invoice({ id: 1 }), invoice({ id: 2 })], 'failed');
    const strip = container.querySelector('[data-testid="invoices-figures"]')!;
    expect(strip.textContent).toContain('—');
    // The two rows on screen must not leak into the figures.
    expect(strip.textContent).not.toMatch(/\b2\b/);
    expect(strip.querySelectorAll('button:not([disabled])')).toHaveLength(0);
  });

  it('sends the search to the server rather than filtering the page', async () => {
    await render([invoice({ id: 1 })]);
    const search = container.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(search, '0418');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush(400);
    expect(svc.listInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ search: '0418' }));
  });
});
