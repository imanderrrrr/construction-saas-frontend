// BuildTrack — a load that fails must SAY so, on both screens.
//
// The screens these replace caught the failure with a toast: it faded after
// four seconds and left an empty table behind, which reads as "you have no
// invoices" — indistinguishable from a brand-new account. The repo's rule
// since then is a persistent banner with a retry, and the empty state
// suppressed while the error stands. These tests are that rule, enforced.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listAllReceivables: vi.fn(),
  listAllPayables: vi.fn(),
  listPayableVendors: vi.fn(),
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
vi.mock('../../services/finance', () => ({
  listAllReceivables: mocks.listAllReceivables,
  listAllPayables: mocks.listAllPayables,
  listPayableVendors: mocks.listPayableVendors,
  // Phase 2. Rejecting is the pre-phase-2 server (404), which is also the case
  // that must leave the screen exactly as it was: figures from the rows.
  getPayableSummary: vi.fn(() => Promise.reject(new Error('404'))),
  payableAttachmentUrl: vi.fn(() => 'blob:stub'),
  voidReceivablePayment: vi.fn(),
  approveChangeOrder: vi.fn(),
  rejectChangeOrder: vi.fn(),
  downloadReceivableDocument: vi.fn(),
  recordReceivablePayment: vi.fn(),
  updateReceivableInfo: vi.fn(),
  deleteReceivable: vi.fn(),
  recordPayablePayment: vi.fn(),
  createPayable: vi.fn(),
  deletePayable: vi.fn(),
  markPayableUnpaid: vi.fn(),
  reassignPayableProject: vi.fn(),
  convertPayableToInvoice: vi.fn(),
  updatePayableAmount: vi.fn(),
  updatePayableDates: vi.fn(),
  updatePayableInfo: vi.fn(),
  updatePayablePayment: vi.fn(),
  voidPayablePayment: vi.fn(),
  uploadPayableAttachment: vi.fn(),
  listPayableAttachments: vi.fn(() => Promise.resolve([])),
  deletePayableAttachment: vi.fn(),
  payableAttachmentUrl: () => '',
}));
// Portal- and network-backed children: not what these tests are about.
vi.mock('../signatures/SignatureRequestPanel', () => ({ SignatureRequestPanel: () => null }));

import { ReceivablesScreen } from './ReceivablesScreen';
import { PayablesScreen } from './PayablesScreen';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.listProjects.mockResolvedValue({ content: [] });
  mocks.listPayableVendors.mockResolvedValue([]);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

async function render(node: React.ReactElement) {
  await act(async () => { root.render(node); });
  await act(async () => { await Promise.resolve(); });
}

describe('Cobrar — el fallo de carga', () => {
  it('muestra la banda con reintento, no un vacío que parece una cuenta nueva', async () => {
    mocks.listAllReceivables.mockRejectedValue(new Error('Service Unavailable'));
    mocks.listAllPayables.mockRejectedValue(new Error('Service Unavailable'));

    await render(<ReceivablesScreen />);

    expect(container.querySelector('[data-testid="accounts-receivable-load-error"]')).not.toBeNull();
    // The empty word would be the lie: it says nobody owes you anything.
    expect(container.textContent).not.toContain('receivable.empty.word');
    // And the figures must not read as zeroes.
    expect(container.textContent).toContain('—');
  });

  it('reintenta cuando se pulsa reintentar', async () => {
    mocks.listAllReceivables.mockRejectedValue(new Error('nope'));
    mocks.listAllPayables.mockRejectedValue(new Error('nope'));
    await render(<ReceivablesScreen />);
    const before = mocks.listAllReceivables.mock.calls.length;

    const retry = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('budgets.retry'));
    expect(retry, 'el botón de reintentar tiene que existir').toBeTruthy();
    await act(async () => { retry!.click(); });
    await act(async () => { await Promise.resolve(); });

    expect(mocks.listAllReceivables.mock.calls.length).toBeGreaterThan(before);
  });
});

describe('Pagar — el fallo de carga', () => {
  it('muestra la banda con reintento y ninguna cifra en cero', async () => {
    mocks.listAllPayables.mockRejectedValue(new Error('Service Unavailable'));
    mocks.listAllReceivables.mockRejectedValue(new Error('Service Unavailable'));

    await render(<PayablesScreen />);

    expect(container.querySelector('[data-testid="accounts-payable-load-error"]')).not.toBeNull();
    expect(container.textContent).not.toContain('payable.empty.word');
    expect(container.textContent).toContain('—');
  });

  it('un catálogo caído no tumba la pantalla', async () => {
    // Vendors and jobsites feed the selects; the list is what the screen is for.
    mocks.listAllPayables.mockResolvedValue([]);
    mocks.listAllReceivables.mockResolvedValue([]);
    mocks.listPayableVendors.mockRejectedValue(new Error('vendors down'));
    mocks.listProjects.mockRejectedValue(new Error('projects down'));

    await render(<PayablesScreen />);

    expect(container.querySelector('[data-testid="accounts-payable-load-error"]')).toBeNull();
    expect(container.textContent).toContain('payable.empty.word');
  });
});
