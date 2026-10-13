// The figures above the invoice list, and the list they open.
//
// Each figure counts more than one status — «Por revisar» the submitted and
// the corrected ones (IN_REVIEW), «Por pagar» the approved and the ones paid
// in part (PENDING_PAYMENT, which every partial payment writes now). Pressing
// a figure used to filter by a single status, so the list showed fewer
// invoices than the figure counted, and a balance still owed dropped out of
// sight.

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
import { byText, flush, invoice, page, SUMMARY } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const REF = { subcontractors: [], projects: [], state: 'ready' as const, reload: () => {} };

describe('InvoicesTab — the figures and the list they open', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => i18n.changeLanguage('es'));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    svc.listInvoices.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (rows: ReturnType<typeof invoice>[]) => {
    svc.listInvoices.mockResolvedValue(page(rows));
    await act(async () => root.render(
      <InvoicesTab summary={SUMMARY} summaryState="ready" refData={REF} onReview={vi.fn()} onPay={vi.fn()} flashInvoiceId={null} />,
    ));
    await flush();
  };
  const figure = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('[data-testid="invoices-figures"] button'))
    .find(b => b.textContent?.includes(label))!;
  const press = async (label: string) => { await act(async () => figure(label).click()); await flush(); };

  it('«Por pagar» lists every invoice it counts: the approved and the ones paid in part', async () => {
    await render([invoice({ id: 1 })]);
    await press('Por pagar');
    expect(figure('Por pagar').getAttribute('aria-pressed')).toBe('true');
    expect(svc.listInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'APPROVED,PENDING_PAYMENT' }));
  });

  it('«Por revisar» lists the submitted and the corrected ones waiting again', async () => {
    await render([invoice({ id: 1 })]);
    await press('Por revisar');
    expect(figure('Por revisar').getAttribute('aria-pressed')).toBe('true');
    expect(svc.listInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'SUBMITTED,IN_REVIEW' }));
  });

  it('pressing the figure again lists everything', async () => {
    await render([invoice({ id: 1 })]);
    await press('Por pagar');
    await press('Por pagar');
    expect(figure('Por pagar').getAttribute('aria-pressed')).toBe('false');
    expect(svc.listInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }));
  });

  it('the status menu still filters by exactly the status chosen', async () => {
    await render([invoice({ id: 1 })]);
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Estado"]')
      ?? Array.from(container.querySelectorAll('select')).find(s => Array.from(s.options).some(o => o.value === 'APPROVED'))!;
    await act(async () => { select.value = 'APPROVED'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await flush();
    expect(svc.listInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'APPROVED' }));
  });

  it('a linked invoice paid in part says how much is left to pay', async () => {
    await render([invoice({ id: 7, status: 'PENDING_PAYMENT', amountCents: 840_000, paidAmountCents: 240_000, payableId: 77, payableBillNumber: 'SUB-F-0418', payableStatus: 'PARTIAL' })]);
    const row = container.querySelector('[data-testid="invoice-row-7"]')!;
    expect(row.textContent).toContain('Pagada en parte · faltan $6,000.00');
  });

  it('the paid-in-part chip is as solid as the approved one: both still expect money to move', async () => {
    await render([
      invoice({ id: 1, status: 'APPROVED' }),
      invoice({ id: 2, status: 'PENDING_PAYMENT', payableId: 77, paidAmountCents: 100_000 }),
    ]);
    const approved = byText(container.querySelector('[data-testid="invoice-row-1"]')!, 'Aprobada', 'span')!;
    const partial = byText(container.querySelector('[data-testid="invoice-row-2"]')!, 'Pago parcial', 'span')!;
    expect(partial.className).toBe(approved.className);
  });
});
