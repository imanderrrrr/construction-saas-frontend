// BuildTrack — ExpenseManagement load-error tests (audit 2026-07-29 follow-up).
//
// The admin approves money off this list and fetchExpenses used to swallow
// failures (`catch { /* silent */ }`) into the "no expenses" empty state.
// These tests pin the fix: banner + retry on failure, never the empty state.
// Same harness as ExpenseReviews.money.test.tsx.

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
vi.mock('../services/users', () => ({
  listActiveUsers: () => Promise.resolve([]),
}));
vi.mock('../services/projects', () => ({
  listProjects: () => Promise.resolve({ content: [] }),
}));

const getAdminExpenses = vi.fn();
const getAdminSummary = vi.fn();
vi.mock('../services/expenses', () => ({
  getAdminExpenses: (...a: unknown[]) => getAdminExpenses(...a),
  getAdminSummary: (...a: unknown[]) => getAdminSummary(...a),
  adminBatchApprove: vi.fn(),
  approveExpense: vi.fn(),
  observeExpense: vi.fn(),
  rejectExpense: vi.fn(),
  receiptUrl: (id: number) => `/receipts/${id}`,
}));

import { ExpenseManagement } from './ExpenseManagement';

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
    status: 'PENDING',
    description: null,
    reviewerName: null,
    reviewerComment: null,
    receiptUrl: null,
  };
}

function page(content: unknown[]) {
  return { content, totalElements: content.length, totalPages: 1 };
}

const SUMMARY = {
  totalSubmitted: 1, totalApprovedCents: 0,
  pendingCount: 1, observedCount: 0, rejectedCount: 0,
};

describe('ExpenseManagement — load errors', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    getAdminSummary.mockResolvedValue(SUMMARY);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the fetched expenses without banner or empty state', async () => {
    getAdminExpenses.mockResolvedValue(page([apiExpense(1), apiExpense(2)]));
    await act(async () => root.render(<ExpenseManagement />));
    await flush();

    expect(container.textContent).toContain('Worker 1');
    expect(container.textContent).toContain('Worker 2');
    expect(container.querySelector('[data-testid="admin-expenses-load-error"]')).toBeNull();
    expect(container.textContent).not.toContain('admin:expenseMgmt.table.emptyTitle');
  });

  it('a failed load shows the banner + retry, NEVER the empty state', async () => {
    getAdminExpenses.mockRejectedValueOnce(new Error('boom'));
    await act(async () => root.render(<ExpenseManagement />));
    await flush();

    const banner = container.querySelector('[data-testid="admin-expenses-load-error"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('admin:expenseMgmt.table.loadFailed');
    expect(container.textContent).not.toContain('admin:expenseMgmt.table.emptyTitle');

    // Retry re-invokes the loader and recovers.
    getAdminExpenses.mockResolvedValueOnce(page([apiExpense(7)]));
    const bannerButtons = Array.from(banner!.querySelectorAll('button'));
    const retry = bannerButtons[bannerButtons.length - 1];
    await act(async () => retry.click());
    await flush();

    expect(getAdminExpenses).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="admin-expenses-load-error"]')).toBeNull();
    expect(container.textContent).toContain('Worker 7');
  });
});
