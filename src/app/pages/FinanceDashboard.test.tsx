// BuildTrack — FinanceDashboard deep-link (initialSection) tests.
//
// The /finance/expenses and /finance/budgets routes render the finance
// dashboard pre-opened on a section (instead of the old ComingSoon stub),
// keeping the full shell. These tests verify the `initialSection` prop maps
// to the right section. Heavy section components + services are stubbed so we
// exercise FinanceDashboard's own section switching, not their data fetching.

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
vi.mock('../services/expenses', () => ({
  getFinanceExpenses: () => Promise.resolve({ content: [] }),
  getFinanceExpenseReport: () => Promise.resolve({
    kpis: { totalApprovedCents: 0, avgPerWorkerCents: 0, expenseCount: 0, topCategory: null },
    byProject: [],
  }),
}));
// The two sections the new routes deep-link to — stubbed to identifiable nodes.
vi.mock('../components/FinanceExpenses', () => ({
  FinanceExpenses: () => <div data-testid="section-expenses">EXPENSES</div>,
}));
vi.mock('../components/FinanceBudgets', () => ({
  FinanceBudgets: () => <div data-testid="section-budgets">BUDGETS</div>,
}));

import { FinanceDashboard } from './FinanceDashboard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Let lazy()/Suspense + effect promises settle.
async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('FinanceDashboard – initialSection deep-linking', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('opens the approved-expenses section when initialSection="approved-expenses"', async () => {
    await act(async () => {
      root.render(<FinanceDashboard initialSection="approved-expenses" />);
    });
    await flush();

    expect(container.querySelector('[data-testid="section-expenses"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="section-budgets"]')).toBeNull();
  });

  it('opens the budgets section when initialSection="budgets"', async () => {
    await act(async () => {
      root.render(<FinanceDashboard initialSection="budgets" />);
    });
    await flush();

    expect(container.querySelector('[data-testid="section-budgets"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="section-expenses"]')).toBeNull();
  });

  it('defaults to the dashboard home (no deep-linked section) when no prop is given', async () => {
    await act(async () => {
      root.render(<FinanceDashboard />);
    });
    await flush();

    expect(container.querySelector('[data-testid="app-shell"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="section-expenses"]')).toBeNull();
    expect(container.querySelector('[data-testid="section-budgets"]')).toBeNull();
  });
});
