// AUD-055 (FE-FIN-06) — the project filter of «Gastos» read one page of 100
// projects, newest first, and took it for all of them: with 230 projects the
// oldest could not be filtered. Every project, closed ones included (they keep
// their expenses), must be offered.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o?.count != null ? `${key}:${o.count}` : key), i18n: { language: 'es' } }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock('../../services/users', () => ({ listActiveUsers: () => Promise.resolve([]) }));
const projects = vi.hoisted(() => ({ listProjects: vi.fn(), listFinanceProjects: vi.fn() }));
vi.mock('../../services/projects', () => projects);
vi.mock('../../services/branding', () => ({ tenantCompanyName: () => Promise.resolve('Constructora Andes') }));

const getAdminExpenses = vi.fn();
const getAdminSummary = vi.fn();
const adminBatchApprove = vi.fn();
vi.mock('../../services/expenses', () => ({
  getAdminExpenses: (...a: unknown[]) => getAdminExpenses(...a),
  getAdminSummary: (...a: unknown[]) => getAdminSummary(...a),
  getFinanceExpenses: (...a: unknown[]) => getAdminExpenses(...a),
  getFinanceSummary: (...a: unknown[]) => getAdminSummary(...a),
  adminBatchApprove: (...a: unknown[]) => adminBatchApprove(...a),
  approveExpense: vi.fn(() => Promise.resolve({})),
  observeExpense: vi.fn(() => Promise.resolve({})),
  rejectExpense: vi.fn(() => Promise.resolve({})),
}));

import { ExpensesSection } from './ExpensesSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const N = 230;
const PROJECTS = [
  { id: 900, name: 'Obra cerrada', status: 'CLOSED' },
  ...Array.from({ length: N }, (_, i) => ({ id: N - i, name: `Obra ${String(N - i).padStart(3, '0')}`, status: 'ACTIVE' })),
];
function servePage(q: { page?: number; size?: number } = {}) {
  const size = Math.min(q.size ?? 20, 100);
  const page = q.page ?? 0;
  return { content: PROJECTS.slice(page * size, page * size + size), page, size, totalElements: PROJECTS.length, totalPages: Math.ceil(PROJECTS.length / size) };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  projects.listProjects.mockImplementation(async (q?: { page?: number; size?: number }) => servePage(q));
  projects.listFinanceProjects.mockImplementation(async (q?: { page?: number; size?: number }) => servePage(q));
  getAdminExpenses.mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  getAdminSummary.mockResolvedValue({ totalSubmitted: 0, totalApprovedCents: 0, pendingCount: 0, observedCount: 0, rejectedCount: 0, approvedCount: 0, pendingCents: 0, observedCents: 0, rejectedCents: 0 });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it('offers the oldest project and the closed one in the filter of «Gastos»', async () => {
  await act(async () => { root.render(<ExpensesSection />); });
  for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  const select = Array.from(container.querySelectorAll<HTMLSelectElement>('select')).find(s => Array.from(s.options).some(o => o.textContent === 'expenses.filters.allProjects'));
  const values = Array.from(select?.options ?? []).map(o => o.value).filter(v => v && v !== 'all');
  expect(values).toContain('1');
  expect(values).toContain('900');
  expect(values.length).toBe(N + 1);
});
