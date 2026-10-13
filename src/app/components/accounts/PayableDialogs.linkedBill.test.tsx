// BuildTrack — the bill of a subcontractor invoice, in Pagar.
//
// Its amount, vendor, category, number and project follow the invoice, so the
// server refuses to change them (409 SUBCONTRACTOR_PAYABLE_LINKED). Its
// description and notes are the office's own, and the server takes them as
// long as what follows the invoice comes back unchanged — or does not come at
// all. So «Editar info» stays open for that bill, with the invoice's fields
// shown but locked, and the save sends only what the office may change.
// Same harness as the other Pagar tests: services faked at the module
// boundary, texts as their keys.

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VendorBill } from '../PayableCommon';

vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { initReactI18next: { type: '3rdParty', init: () => {} }, useTranslation: () => ({ t, i18n: { language: 'es' } }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('../../services/finance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/finance')>()),
  updatePayableInfo: vi.fn(),
}));
// The photos have their own tests; here only the menu and the window matter.
vi.mock('../PayableAttachmentsPanel', () => ({ PayableAttachmentsPanel: () => null }));

import { EditBillInfoDialog } from './PayableDialogs';
import { PayableDetailPanel } from './PayableDetailPanel';
import { updatePayableInfo, type Payable } from '../../services/finance';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LINKED: VendorBill = {
  id: 31, billNumber: 'SUB-F-2026-0418', vendor: 'Herrería Xelajú', category: 'subcontractor', project: 'Torre Norte', projectId: 1,
  description: 'Subcontrato: Balcones — Factura #F-2026-0418', documentType: 'INVOICE', invoiceNumber: 'F-2026-0418',
  receivedDate: '2026-10-12', dueDate: '2026-10-27', amount: 8400, paidAmount: 0, status: 'pending', notes: null, payments: [],
  createdAt: '2026-10-12T10:00:00Z', updatedAt: '2026-10-12T10:00:00Z', attachmentCount: 0, firstAttachmentId: null,
  paymentsInQuickBooks: false, subcontractorInvoiceId: 418,
};

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

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!;
  act(() => { setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
}

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

describe('Pagar — the bill of a subcontractor invoice', () => {
  it('«Editar info» stays open, while what follows the invoice stays locked', async () => {
    const noop = vi.fn();
    await render(
      <PayableDetailPanel bill={LINKED} project={undefined} canManage today="2026-10-12" dateLocale="es"
        onClose={noop} onPay={noop} onEditAmounts={noop} onEditInfo={noop} onConvert={noop} onReassign={noop}
        onUnpay={noop} onDelete={noop} onVoidPayment={noop} onEditPayment={noop} busy={false} />,
    );
    const more = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('finance:payable.detail.moreActions'))!;
    // Radix opens its menu on pointerdown.
    await act(async () => {
      more.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false, pointerType: 'mouse' }));
    });
    await flush();
    const item = (label: string) => [...document.querySelectorAll('[role="menuitem"]')].find(el => el.textContent?.includes(label))!;
    expect(item('finance:payable.info.action').hasAttribute('data-disabled')).toBe(false);
    expect(item('finance:payable.edit.action').hasAttribute('data-disabled'), 'the amount follows the invoice').toBe(true);
    expect(item('finance:payable.delete.action').hasAttribute('data-disabled')).toBe(true);
  });

  it('a linked bill edits description and notes with its invoice fields locked', async () => {
    vi.mocked(updatePayableInfo).mockResolvedValue({ id: 31 } as Payable);
    await render(<EditBillInfoDialog bill={LINKED} vendors={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    const vendor = document.querySelector<HTMLInputElement>('#ap-info-vendor')!;
    const category = document.querySelector<HTMLSelectElement>('#ap-info-category')!;
    const number = document.querySelector<HTMLInputElement>('#ap-info-invoice')!;
    expect(vendor.readOnly).toBe(true);
    expect(category.disabled).toBe(true);
    expect(number.readOnly).toBe(true);
    expect(document.body.textContent).toContain('finance:payable.info.linkedHint');

    type(document.querySelector<HTMLInputElement>('#ap-info-desc')!, 'Losa nivel 3');
    type(document.querySelector<HTMLTextAreaElement>('#ap-info-notes')!, 'Revisada en obra');
    const save = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'common:buttons.save')!;
    await act(async () => save.click());
    await flush();

    expect(updatePayableInfo).toHaveBeenCalledWith(31, { description: 'Losa nivel 3', notes: 'Revisada en obra' });
  });
});
