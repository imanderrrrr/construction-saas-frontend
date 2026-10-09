// BuildTrack — «Cobrar» refused with 409 QUICKBOOKS_PAYMENTS_IN_QBO: the
// document went to QuickBooks (whose payments are read from there) after the
// screen loaded. The dialog hands the screen the document as it is now — its
// «Cobrar» then off, with the reason — and closes, instead of inviting the
// same refused click again (audit B16).
//
// Same harness as PayableDialogs.quickbooks.test.tsx: services faked at the
// module boundary, texts as their keys.

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Receivable } from '../../services/finance';

vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  // The real ApiError's module loads the app's i18n, which plugs this in.
  return { initReactI18next: { type: '3rdParty', init: () => {} }, useTranslation: () => ({ t, i18n: { language: 'es' } }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/finance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/finance')>()),
  recordReceivablePayment: vi.fn(),
  getReceivable: vi.fn(),
}));

import { toast } from 'sonner';
import { CollectDialog } from './ReceivableDialogs';
import { ApiError } from '../../lib/api';
import { getReceivable, recordReceivablePayment } from '../../services/finance';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const DOC = {
  id: 7, documentType: 'INVOICE', invoiceNumber: 'INV-2026-0007', client: 'Cliente Demo', project: 'Torre Norte', projectId: 1,
  description: null, issuedDate: '2026-09-20', dueDate: '2026-10-20', subtotal: 300, discount: 0, taxRate: 0, tax: 0,
  amount: 300, paidAmount: 0, status: 'PENDING', notes: null, lineItems: [], payments: [],
  createdAt: '2026-09-20T10:00:00Z', updatedAt: '2026-09-25T10:00:00Z', paymentsInQuickBooks: false,
} as unknown as Receivable;
const NOW_IN_QUICKBOOKS = { ...DOC, paymentsInQuickBooks: true } as Receivable;

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

async function clickLabel(label: string) {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === label) as HTMLButtonElement | undefined;
  expect(b, label).toBeTruthy();
  await act(async () => { b!.click(); });
  await flush();
}

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(recordReceivablePayment).mockReset();
  vi.mocked(getReceivable).mockReset();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  document.body.innerHTML = '';
});

describe('«Cobrar», refused because the document is in QuickBooks now', () => {
  it('hands the screen the document as it is now, and closes', async () => {
    vi.mocked(recordReceivablePayment).mockRejectedValue(new ApiError(
      409, 'Este documento está en QuickBooks: registra sus cobros allá y aparecerán aquí solos.', undefined, 'QUICKBOOKS_PAYMENTS_IN_QBO',
    ));
    vi.mocked(getReceivable).mockResolvedValue(NOW_IN_QUICKBOOKS);
    const onCollected = vi.fn();
    const onClose = vi.fn();
    await render(<CollectDialog doc={DOC} onClose={onClose} onCollected={onCollected} clientOverdue={0} />);

    await clickLabel('finance:receivable.collect.confirm');

    expect(recordReceivablePayment).toHaveBeenCalledWith(7, expect.objectContaining({ amount: 300 }));
    expect(getReceivable).toHaveBeenCalledWith(7);
    expect(onCollected).toHaveBeenCalledWith(NOW_IN_QUICKBOOKS);
    expect(onClose).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('finance:receivable.collect.failed', {
      description: 'Este documento está en QuickBooks: registra sus cobros allá y aparecerán aquí solos.',
    });
  });

  it('any other refusal leaves the dialog open, to fix what was wrong', async () => {
    vi.mocked(recordReceivablePayment).mockRejectedValue(new ApiError(400, 'El monto supera el saldo.', undefined, 'PAYMENT_EXCEEDS_BALANCE'));
    const onCollected = vi.fn();
    const onClose = vi.fn();
    await render(<CollectDialog doc={DOC} onClose={onClose} onCollected={onCollected} clientOverdue={0} />);

    await clickLabel('finance:receivable.collect.confirm');

    expect(getReceivable).not.toHaveBeenCalled();
    expect(onCollected).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});


it('a lost collection response retries its stable intention, without treating conflict as success', async () => {
  vi.mocked(recordReceivablePayment).mockRejectedValueOnce(new Error('Response lost'))
    .mockRejectedValueOnce(new ApiError(409, 'Different payload', undefined, 'PAYMENT_REQUEST_CONFLICT'));
  const onCollected = vi.fn(); const onClose = vi.fn();
  await render(<CollectDialog doc={DOC} onClose={onClose} onCollected={onCollected} clientOverdue={0} />);
  await clickLabel('finance:receivable.collect.confirm'); await clickLabel('finance:receivable.collect.confirm');
  const calls = vi.mocked(recordReceivablePayment).mock.calls;
  expect(calls[0][1].requestKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(calls[1][1].requestKey).toBe(calls[0][1].requestKey);
  expect(onCollected).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
});
