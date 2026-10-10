// AUD-055 (FE-FIN-06) — the project filter of «Reporte de gastos» read one page of
// 100 projects, newest first, and took it for all of them: with 230 projects
// the oldest could not be filtered. Every project, closed ones included (they
// keep their history), must be offered.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) => (o?.count != null ? `${key}:${o.count}` : key),
    i18n: { language: 'es', resolvedLanguage: 'es' },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
const projects = vi.hoisted(() => ({ listProjects: vi.fn(), listFinanceProjects: vi.fn() }));
vi.mock('../../services/projects', () => projects);
vi.mock('../../services/branding', () => ({ tenantCompanyName: () => Promise.resolve('Constructora Andes') }));

const getExpenseReport = vi.fn();
const exportExpenseReport = vi.fn();
vi.mock('../../services/expenses', () => ({
  getExpenseReport: (...a: unknown[]) => getExpenseReport(...a),
  getFinanceExpenseReport: (...a: unknown[]) => getExpenseReport(...a),
  exportExpenseReport: (...a: unknown[]) => exportExpenseReport(...a),
}));

import { ExpenseReportSection } from './ExpenseReportSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
  vi.clearAllMocks();
  projects.listProjects.mockImplementation(async (q?: { page?: number; size?: number }) => servePage(q));
  projects.listFinanceProjects.mockImplementation(async (q?: { page?: number; size?: number }) => servePage(q));
  getExpenseReport.mockResolvedValue({ generatedAt: '2026-10-09T12:00:00Z', kpis: null, byProject: [], byWorker: [] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it.each([[false, 'listProjects'], [true, 'listFinanceProjects']] as const)(
  'offers the oldest project and the closed one in the filter (read-only=%s, from %s)',
  async (readOnly, endpoint) => {
    await act(async () => { root.render(<ExpenseReportSection readOnly={readOnly} />); });
    for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    const select = Array.from(container.querySelectorAll<HTMLSelectElement>('select')).find(s => Array.from(s.options).some(o => o.value === 'all' && o.textContent === 'expenseReport.filters.allProjects'));
    const values = projectValues(select);
    expect(values).toContain('1');
    expect(values).toContain('900');
    expect(values.length).toBe(N + 1);
    expect(projects[endpoint]).toHaveBeenCalled();
  },
);
