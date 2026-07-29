// BuildTrack — FinanceBudgets load-error tests (audit 2026-07-29 follow-up).
//
// The main fetch only toasted on failure (fading into the "no budgets" empty
// state) and the per-row contract-history fetch was swallowed outright with
// "Silently ignore — history section will show empty". These tests pin the
// fix: banner + retry at both levels, never a fake-empty section. Same
// harness as ExpenseReviews.money.test.tsx.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
  }),
}));

const listFinanceProjects = vi.fn();
const getFinanceContractHistory = vi.fn();
vi.mock('../services/projects', () => ({
  listFinanceProjects: (...a: unknown[]) => listFinanceProjects(...a),
  getFinanceContractHistory: (...a: unknown[]) => getFinanceContractHistory(...a),
}));
const getFinanceExpenseReport = vi.fn();
vi.mock('../services/expenses', () => ({
  getFinanceExpenseReport: (...a: unknown[]) => getFinanceExpenseReport(...a),
}));

import { FinanceBudgets } from './FinanceBudgets';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

const PROJECT = {
  id: 11,
  name: 'Proyecto Once',
  originalContractCents: 100_000_00,
  revisedContractCents: null,
  totalConsumedCents: 5_000_00,
  status: 'ACTIVE',
  createdAt: '2026-07-01T12:00:00',
};

describe('FinanceBudgets — load errors', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    getFinanceExpenseReport.mockResolvedValue({ byProject: [] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('a failed load shows the banner + retry, NEVER the empty state', async () => {
    listFinanceProjects.mockRejectedValueOnce(new Error('boom'));
    await act(async () => root.render(<FinanceBudgets />));
    await flush();

    const banner = container.querySelector('[data-testid="finance-budgets-load-error"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('finance:budget.loadFailed');
    expect(container.textContent).not.toContain('finance:budget.noBudgets');

    // Retry re-invokes the loader and recovers.
    listFinanceProjects.mockResolvedValueOnce({ content: [PROJECT] });
    const bannerButtons = Array.from(banner!.querySelectorAll('button'));
    const retry = bannerButtons[bannerButtons.length - 1];
    await act(async () => retry.click());
    await flush();

    expect(listFinanceProjects).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="finance-budgets-load-error"]')).toBeNull();
    expect(container.textContent).toContain('Proyecto Once');
  });

  it('a failed history fetch marks the row instead of showing fake-empty history', async () => {
    listFinanceProjects.mockResolvedValue({ content: [PROJECT] });
    getFinanceContractHistory.mockRejectedValueOnce(new Error('boom'));
    await act(async () => root.render(<FinanceBudgets />));
    await flush();

    // Expand the desktop row for the project.
    const row = Array.from(container.querySelectorAll('tr'))
      .find(r => r.textContent?.includes('Proyecto Once'));
    expect(row).toBeTruthy();
    await act(async () => row!.click());
    await flush();

    const banner = container.querySelector('[data-testid="budget-history-load-error"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('finance:budget.historyLoadFailed');
    expect(container.textContent).not.toContain('finance:budget.noHistory');
    // The header must not keep pretending the history is still loading.
    expect(container.textContent).not.toContain('finance:budget.loadingHistory');

    // Retry: a genuinely empty history now shows the real empty text.
    getFinanceContractHistory.mockResolvedValueOnce([]);
    const bannerButtons = Array.from(banner!.querySelectorAll('button'));
    const retry = bannerButtons[bannerButtons.length - 1];
    await act(async () => retry.click());
    await flush();

    expect(getFinanceContractHistory).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="budget-history-load-error"]')).toBeNull();
    expect(container.textContent).toContain('finance:budget.noHistory');
  });
});
