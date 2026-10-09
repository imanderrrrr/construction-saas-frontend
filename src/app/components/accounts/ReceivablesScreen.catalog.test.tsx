// AUD-055 (FE-FIN-06) — the project filter of «Cobrar» read one page of
// 100 projects, newest first, and took it for all of them: with 230 projects
// the oldest could not be filtered. Every project, closed ones included (they
// keep their history), must be offered.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

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

import { ReceivablesScreen } from './ReceivablesScreen';

const N = 230;
// Newest first, as the server orders them: the oldest (id 1) is the last row;
// a closed project still carries history.
const PROJECTS = [
  { id: 900, name: 'Obra cerrada', status: 'CLOSED' },
  ...Array.from({ length: N }, (_, i) => ({ id: N - i, name: `Obra ${String(N - i).padStart(3, '0')}`, status: 'ACTIVE' })),
];
function servePage(q: { page?: number; size?: number } = {}) {
  const size = Math.min(q.size ?? 20, 100);
  const page = q.page ?? 0;
  return { content: PROJECTS.slice(page * size, page * size + size), page, size, totalElements: PROJECTS.length, totalPages: Math.ceil(PROJECTS.length / size) };
}
const projectValues = (select: HTMLSelectElement | null | undefined) => Array.from(select?.options ?? []).map(o => o.value).filter(v => v && v !== 'all');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.listProjects.mockImplementation(async (q?: { page?: number; size?: number }) => servePage(q));
  mocks.listAllReceivables.mockResolvedValue([]);
  mocks.listAllPayables.mockResolvedValue([]);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

it('offers the oldest project and the closed one in the filter of «Cobrar»', async () => {
  await act(async () => { root.render(<ReceivablesScreen />); });
  for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  const values = projectValues(container.querySelector<HTMLSelectElement>('select[aria-label="common:labels.project"]'));
  expect(values).toContain('1');
  expect(values).toContain('900');
  expect(values.length).toBe(N + 1);
});
