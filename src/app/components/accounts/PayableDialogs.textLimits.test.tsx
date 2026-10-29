// Second warehouse audit (2026-10-28), web side of "the clients adapt to the
// server". Three ways the payables dialogs sent the server text it refuses:
// - the vendor list offers names saved before the 25 limit (a subcontractor's
//   vendor is its full name or username, up to 200), and choosing one sent it;
// - editing a bill's info sent a shortened-but-still-too-long description
//   (the server writes "Subcontrato: <job> — Factura #<n>", often over 50);
// - editing a payment's date resent its method, which may be a historical
//   "Other" text over 25.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VendorBill } from '../PayableCommon';

vi.mock('react-i18next', () => {
  const t = (key: string, opts?: Record<string, unknown>) =>
    opts && typeof opts === 'object' && 'max' in opts ? `${key}(max=${opts.max})` : key;
  return { initReactI18next: { type: '3rdParty', init: () => {} }, useTranslation: () => ({ t, i18n: { language: 'es' } }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('../../services/finance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/finance')>()),
  updatePayableInfo: vi.fn(),
  updatePayablePayment: vi.fn(),
}));

import { toast } from 'sonner';
import { CreateBillDialog, EditBillInfoDialog, EditPaymentDialog } from './PayableDialogs';
import { updatePayableInfo, updatePayablePayment } from '../../services/finance';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LONG_VENDOR = 'Instalaciones Eléctricas Hernández y Asociados';
const SUB_DESCRIPTION = 'Subcontrato: Instalación eléctrica del segundo nivel — Factura #F-2026-0041';

function bill(partial: Partial<VendorBill> = {}): VendorBill {
  return {
    id: 9, billNumber: 'BILL-9', vendor: 'Ferretería Central', category: 'materials', project: 'Torre Norte', projectId: 1,
    description: null, documentType: 'BILL', invoiceNumber: null, receivedDate: '2026-09-20', dueDate: '2026-10-20',
    amount: 300, paidAmount: 0, status: 'pending', notes: null, payments: [],
    createdAt: '2026-09-20T10:00:00Z', updatedAt: '2026-09-25T10:00:00Z', attachmentCount: 0, firstAttachmentId: null,
    paymentsInQuickBooks: false,
    ...partial,
  };
}

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

function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function clickLabel(label: string) {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === label) as HTMLButtonElement;
  expect(b, label).toBeTruthy();
  await act(async () => { b.click(); });
  await flush();
}

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(updatePayableInfo).mockReset();
  vi.mocked(updatePayablePayment).mockReset();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  document.body.innerHTML = '';
});

describe('payables dialogs never send text over what the server takes', () => {
  it('does not offer a vendor whose saved name is over 25', async () => {
    await render(<CreateBillDialog open vendors={['Ferretería Central', LONG_VENDOR]} projects={[]}
      suggestedNumber="BILL-10" onClose={() => {}} onCreated={() => {}} />);
    const options = [...document.querySelectorAll<HTMLOptionElement>('#ap-new-vendor option')].map(o => o.value);

    expect(options).toContain('Ferretería Central');
    expect(options).not.toContain(LONG_VENDOR);
  });

  it('refuses a bill description still over 50 after a partial edit', async () => {
    await render(<EditBillInfoDialog bill={bill({ description: SUB_DESCRIPTION })} vendors={[]} onClose={() => {}} onSaved={() => {}} />);
    const desc = document.querySelector<HTMLInputElement>('#ap-info-desc')!;
    await act(async () => { typeInto(desc, SUB_DESCRIPTION.slice(0, 60)); });
    await clickLabel('common:buttons.save');

    expect(updatePayableInfo).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('common:validation.maxLength(max=50)');
  });

  it('keeps an untouched long description out of the update', async () => {
    vi.mocked(updatePayableInfo).mockResolvedValue({} as never);
    await render(<EditBillInfoDialog bill={bill({ description: SUB_DESCRIPTION })} vendors={[]} onClose={() => {}} onSaved={() => {}} />);
    await act(async () => { typeInto(document.querySelector<HTMLTextAreaElement>('#ap-info-notes')!, 'Revisada'); });
    await clickLabel('common:buttons.save');

    expect(updatePayableInfo).toHaveBeenCalledWith(9, { notes: 'Revisada' });
  });

  it('changing only a payment date does not resend a historical method', async () => {
    vi.mocked(updatePayablePayment).mockResolvedValue({} as never);
    const longMethod = 'Transferencia interbancaria a cuenta de ahorro';
    const payment = { id: 12, date: '2026-09-20', amount: 50, method: longMethod, voided: false, source: 'SYSTEM' as const, qboPaymentId: null };
    await render(<EditPaymentDialog subject={{ bill: bill({ payments: [payment] }), payment }} onClose={() => {}} onSaved={() => {}} />);
    const date = document.querySelector<HTMLInputElement>('input[type="date"]')!;
    await act(async () => { typeInto(date, '2026-09-21'); });
    await clickLabel('common:buttons.save');

    expect(updatePayablePayment).toHaveBeenCalledWith(9, 12, { date: '2026-09-21' });
  });
});
