// BuildTrack — Cobrar opens on the document another section asked for, and
// the tour's signature stop knows where the block is.
//
// «Ver cómo» on the note Facturas shows after issuing a document sends the
// user here with the document in mind (lib/sectionIntent) and asks the tour
// for its signature stop (lib/tourRequest). The stop's anchor moves: the
// rows lend it a zone while no document is open, the block itself carries
// it once one is, and while the rows the deep link asked for are still
// loading nobody does — the tour waits for the block instead of ringing a
// skeleton. Same harness as the QuickBooks tests: services faked at the
// module boundary, texts as their keys.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Receivable } from '../../services/finance';

const mocks = vi.hoisted(() => ({
  listAllReceivables: vi.fn(),
  listAllPayables: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t, i18n: { language: 'es' } }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('../../services/auth', () => ({ AuthService: { getCanonicalRole: () => 'ADMIN' } }));
vi.mock('../../services/projects', () => ({ listProjects: mocks.listProjects }));
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
// The block's own requests and tests live next to it; here only its place matters.
vi.mock('../signatures/SignatureRequestPanel', () => ({
  SignatureRequestPanel: ({ receivableId }: { receivableId: number }) => <div data-testid="signature-panel" data-id={receivableId} />,
}));
vi.mock('../../helpers/dateTime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../helpers/dateTime')>()),
  businessToday: () => '2026-09-26',
  currentMonth: () => '2026-09',
}));

import { ReceivablesScreen } from './ReceivablesScreen';
import { peekSectionIntent, resetSectionIntents, setSectionIntent } from '../../lib/sectionIntent';

const ANCHOR = '[data-tour="sec.accounts-receivable.signature"]';

function receivable(partial: Partial<Receivable>): Receivable {
  return {
    id: 1, documentType: 'INVOICE', invoiceNumber: 'INV-2026-1', client: 'Cliente Demo', project: 'Torre Norte', projectId: 1,
    description: null, issuedDate: '2026-09-20', dueDate: '2026-10-20', subtotal: 325.5, discount: 0, taxRate: 0, tax: 0,
    amount: 325.5, paidAmount: 0, status: 'PENDING', notes: null, lineItems: [], payments: [],
    createdAt: '2026-09-20T10:00:00Z', updatedAt: '2026-09-25T10:00:00Z', signatureStatus: null,
    ...partial,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  resetSectionIntents();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.listProjects.mockResolvedValue({ content: [] });
  mocks.listAllPayables.mockResolvedValue([]);
  mocks.listAllReceivables.mockImplementation((params?: { status?: string }) => Promise.resolve(params?.status ? [] : [
    receivable({ id: 41, invoiceNumber: 'INV-2026-41', client: 'Grupo Marisol' }),
    receivable({ id: 42, invoiceNumber: 'INV-2026-42', client: 'Cliente Demo' }),
  ]));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

async function render() {
  await act(async () => { root.render(<ReceivablesScreen />); });
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

const anchors = () => Array.from(container.querySelectorAll(ANCHOR));
const selectedView = () => container.querySelector('[role="tab"][aria-selected="true"]')?.textContent;

describe('Cobrar — opened on a document by another section', () => {
  it('opens the by-document view with that document open, and the stop on its signature block', async () => {
    setSectionIntent('accounts-receivable', { openReceivableId: 42 });
    await render();

    expect(selectedView()).toBe('finance:receivable.view.byDocument');
    const panel = container.querySelector('[data-testid="signature-panel"]');
    expect(panel, 'the document is open — its signature block is on screen').not.toBeNull();
    expect(panel!.getAttribute('data-id')).toBe('42');

    // One anchor, and it is the block — not the rows around it.
    expect(anchors()).toHaveLength(1);
    expect(anchors()[0].contains(panel)).toBe(true);
    expect(anchors()[0].querySelector('[data-tour="sec.accounts-receivable.rows"]')).toBeNull();

    // One-shot: the next visit by hand starts clean.
    expect(peekSectionIntent('accounts-receivable')).toBeNull();
  });

  it('without an intent, opens by client with the stop lent the rows', async () => {
    await render();

    expect(selectedView()).toBe('finance:receivable.view.byClient');
    expect(container.querySelector('[data-testid="signature-panel"]')).toBeNull();
    expect(anchors()).toHaveLength(1);
    expect(anchors()[0].querySelector('[data-tour="sec.accounts-receivable.rows"]')).not.toBeNull();
  });

  it('while the document it was sent for is still loading, nobody carries the stop', async () => {
    setSectionIntent('accounts-receivable', { openReceivableId: 42 });
    mocks.listAllReceivables.mockReturnValue(new Promise(() => { /* never answers */ }));
    await render();

    expect(container.querySelector('[data-tour="sec.accounts-receivable.rows"]'), 'the rows zone is drawn').not.toBeNull();
    expect(anchors(), 'the stop waits for the block rather than ringing the skeleton').toHaveLength(0);
  });

  it('closing the document hands the stop back to the rows', async () => {
    setSectionIntent('accounts-receivable', { openReceivableId: 42 });
    await render();
    const toggle = Array.from(container.querySelectorAll('button[aria-expanded="true"]'))
      .find(b => b.textContent?.includes('INV-2026-42')) as HTMLButtonElement;
    expect(toggle).toBeTruthy();

    await act(async () => { toggle.click(); });

    expect(container.querySelector('[data-testid="signature-panel"]')).toBeNull();
    expect(anchors()).toHaveLength(1);
    expect(anchors()[0].querySelector('[data-tour="sec.accounts-receivable.rows"]')).not.toBeNull();
  });
});
