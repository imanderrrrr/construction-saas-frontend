// BuildTrack — FinanceDashboard (DashboardView) load-error tests
// (audit 2026-07-29 follow-up).
//
// The dashboard fetch swallowed failures ("degrade gracefully — cards show
// '—'"), so a network error rendered dash KPIs of dashes plus the innocent
// "no approved expenses" empty state, with no way to tell and no way to
// retry. These tests pin the fix. Shell/services mocking mirrors
// FinanceDashboard.test.tsx; the banner asserts mirror
// ExpenseReviews.money.test.tsx.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('../services/auth', () => ({
  AuthService: { getUsername: () => 'fin', logout: () => Promise.resolve() },
}));
vi.mock('../components/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));
vi.mock('../components/StatCard', () => ({ StatCard: () => <div data-testid="stat-card" /> }));
vi.mock('../components/ui/sonner', () => ({ Toaster: () => <span data-testid="toaster" /> }));

const getFinanceExpenses = vi.fn();
const getFinanceExpenseReport = vi.fn();
vi.mock('../services/expenses', () => ({
  getFinanceExpenses: (...a: unknown[]) => getFinanceExpenses(...a),
  getFinanceExpenseReport: (...a: unknown[]) => getFinanceExpenseReport(...a),
}));

import { FinanceDashboard } from './FinanceDashboard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function apiExpense(id: number) {
  return {
    id,
    workerName: `Worker ${id}`,
    workerUsername: `worker${id}`,
    expenseDate: '2026-07-20',
    expenseType: 'FUEL',
    projectName: `Proyecto ${id}`,
    amountCents: 12_50,
    status: 'APPROVED',
  };
}

const REPORT = {
  kpis: { totalApprovedCents: 1000, avgPerWorkerCents: 500, expenseCount: 2, topCategory: 'FUEL' },
  byProject: [],
};

describe('FinanceDashboard — dashboard load errors', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders recent expenses without banner or empty state', async () => {
    getFinanceExpenses.mockResolvedValue({ content: [apiExpense(1)] });
    getFinanceExpenseReport.mockResolvedValue(REPORT);
    await act(async () => root.render(<FinanceDashboard />));
    await flush();

    expect(container.textContent).toContain('Worker 1');
    expect(container.querySelector('[data-testid="finance-dash-load-error"]')).toBeNull();
    expect(container.textContent).not.toContain('dash.noApprovedExpenses');
  });

  it('a failed load shows the banner + retry, NEVER the empty state', async () => {
    getFinanceExpenses.mockRejectedValueOnce(new Error('boom'));
    getFinanceExpenseReport.mockRejectedValueOnce(new Error('boom'));
    await act(async () => root.render(<FinanceDashboard />));
    await flush();

    const banner = container.querySelector('[data-testid="finance-dash-load-error"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('dash.loadFailed');
    expect(container.textContent).not.toContain('dash.noApprovedExpenses');

    // Retry re-invokes the loader and recovers.
    getFinanceExpenses.mockResolvedValueOnce({ content: [apiExpense(7)] });
    getFinanceExpenseReport.mockResolvedValueOnce(REPORT);
    const bannerButtons = Array.from(banner!.querySelectorAll('button'));
    const retry = bannerButtons[bannerButtons.length - 1];
    await act(async () => retry.click());
    await flush();

    expect(getFinanceExpenses).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="finance-dash-load-error"]')).toBeNull();
    expect(container.textContent).toContain('Worker 7');
  });
});
