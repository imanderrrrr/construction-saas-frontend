// AUD-055 (FE-FIN-06) — «Pagar» took one page of 100 projects, newest first,
// for everything: the filter, «Registrar cuenta» and the payment's budget
// note. In a company with 230 projects the oldest one — still active, with
// bills — could not be filtered, could not receive a new bill from here, and
// its payment dialog lost the "budget that remains" note. Every project is
// reachable now; the dialogs that write keep the server's rules (no new bill
// on a CLOSED project, a bill moves only to an ACTIVE one).

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

import { PayablesScreen } from './PayablesScreen';

const N = 230;
// Newest first, as the server orders them: the oldest (id 1) is the last row.
const PROJECTS = [
  { id: 900, name: 'Obra cerrada', status: 'CLOSED', remainingBudgetCents: 0, contractAmountCents: 0 },
  { id: 901, name: 'Obra en pausa', status: 'INACTIVE', remainingBudgetCents: 5000, contractAmountCents: 5000 },
  ...Array.from({ length: N }, (_, i) => ({
    id: N - i, name: `Obra ${String(N - i).padStart(3, '0')}`, status: 'ACTIVE', remainingBudgetCents: 1_234_500, contractAmountCents: 2_000_000,
  })),
];

function servePage(q: { page?: number; size?: number } = {}) {
  const size = Math.min(q.size ?? 20, 100);
  const page = q.page ?? 0;
  return { content: PROJECTS.slice(page * size, page * size + size), page, size, totalElements: PROJECTS.length, totalPages: Math.ceil(PROJECTS.length / size) };
}

const BILL = {
  id: 77, projectId: 1, project: 'Obra 001', vendor: 'Ferretería El Martillo', billNumber: 'F-77', documentType: 'BILL',
  category: 'MATERIALS', description: 'Cemento', notes: null, receivedDate: '2026-09-20', issuedDate: '2026-09-20', dueDate: '2026-10-20',
  amount: 500, paidAmount: 0, status: 'PENDING', payments: [], lineItems: [], attachmentCount: 0,
  createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z',
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.listProjects.mockImplementation(async (q?: { page?: number; size?: number }) => servePage(q));
  mocks.listPayableVendors.mockResolvedValue([]);
  mocks.listAllPayables.mockResolvedValue([BILL]);
  mocks.listAllReceivables.mockResolvedValue([]);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

async function render() {
  await act(async () => { root.render(<PayablesScreen />); });
  for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}

const values = (select: HTMLSelectElement | null) => Array.from(select?.options ?? []).map(o => o.value).filter(Boolean);

describe('Pagar — the projects past the first hundred (FE-FIN-06)', () => {
  it('filters by the oldest project, and by closed and paused ones too', async () => {
    await render();
    const filter = container.querySelector<HTMLSelectElement>('select[aria-label="common:labels.project"]');
    expect(values(filter)).toContain('1');
    expect(values(filter)).toContain('900');
    expect(values(filter)).toContain('901');
    expect(values(filter).length).toBe(N + 2);
  });

  it('registers a bill on the oldest project, never on a closed one', async () => {
    await render();
    const create = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('finance:payable.create.action'));
    await act(async () => { create!.click(); });
    const select = document.body.querySelector<HTMLSelectElement>('#ap-new-project');
    expect(values(select)).toContain('1');
    expect(values(select)).toContain('901');
    expect(values(select)).not.toContain('900');
  });

  it('shows the budget that remains when paying a bill of the oldest project', async () => {
    await render();
    const pay = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('finance:payable.action.pay'));
    await act(async () => { pay!.click(); });
    expect(document.body.textContent).toContain('payable.pay.budgetOf');
  });
});
