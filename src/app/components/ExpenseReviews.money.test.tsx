// BuildTrack — ExpenseReviews money-flow tests.
//
// This screen is where a supervisor approves other people's money, and until
// now it had no tests. Four fat paths:
//   1. load renders rows from the API (not an empty shell),
//   2. a FAILED load shows the error banner + retry — never the innocent
//      "no expenses ✓" empty state (the audit's worst-failure-mode finding),
//   3. approving calls the API with the right id and refetches,
//   4. reject refuses to submit without the mandatory >=10-char comment.
//
// Same harness as the other component tests: raw createRoot + act, services
// mocked at the module boundary, i18n's t() returns the key.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  // src/i18n/index.ts (pulled in via lib/api) initializes the real chain.
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

const getSupervisorExpenses = vi.fn();
const getSupervisorSummary = vi.fn();
const approveExpense = vi.fn();
const observeExpense = vi.fn();
const rejectExpense = vi.fn();
const supervisorBatchApprove = vi.fn();
vi.mock('../services/expenses', () => ({
  getSupervisorExpenses: (...a: unknown[]) => getSupervisorExpenses(...a),
  getSupervisorSummary: (...a: unknown[]) => getSupervisorSummary(...a),
  approveExpense: (...a: unknown[]) => approveExpense(...a),
  observeExpense: (...a: unknown[]) => observeExpense(...a),
  rejectExpense: (...a: unknown[]) => rejectExpense(...a),
  supervisorBatchApprove: (...a: unknown[]) => supervisorBatchApprove(...a),
  receiptUrl: (p: string) => p,
}));

import { ExpenseReviews } from './ExpenseReviews';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

/** One backend expense the mapper understands (mapExpense shape). */
function apiExpense(id: number, overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function page(content: unknown[]) {
  return { content, totalElements: content.length, totalPages: 1 };
}

const SUMMARY = {
  pendingCount: 1, pendingTotalCents: 1250,
  approvedThisMonthCents: 0, rejectedThisMonthCount: 0,
};

describe('ExpenseReviews — money flow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    getSupervisorSummary.mockResolvedValue(SUMMARY);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the fetched expenses as review rows', async () => {
    getSupervisorExpenses.mockResolvedValue(page([apiExpense(1), apiExpense(2)]));
    await act(async () => root.render(<ExpenseReviews />));
    await flush();

    expect(getSupervisorExpenses).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Worker 1');
    expect(container.textContent).toContain('Worker 2');
    // Not the empty state, not the error state.
    expect(container.textContent).not.toContain('review.noExpenses');
    expect(container.querySelector('[data-testid="expenses-load-error"]')).toBeNull();
  });

  it('a failed load shows the error banner + retry, NEVER the empty state', async () => {
    getSupervisorExpenses.mockRejectedValueOnce(new Error('boom'));
    await act(async () => root.render(<ExpenseReviews />));
    await flush();

    // The audit finding: this used to render "no expenses ✓" on failure.
    const banner = container.querySelector('[data-testid="expenses-load-error"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('review.loadFailed');
    expect(container.textContent).not.toContain('review.noExpenses');

    // Retry re-invokes the loader and recovers.
    getSupervisorExpenses.mockResolvedValueOnce(page([apiExpense(7)]));
    const bannerButtons = Array.from(banner!.querySelectorAll('button'));
    const retry = bannerButtons[bannerButtons.length - 1];
    await act(async () => retry.click());
    await flush();

    expect(getSupervisorExpenses).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="expenses-load-error"]')).toBeNull();
    expect(container.textContent).toContain('Worker 7');
  });

  it('approving a pending expense calls the API with its id and refetches', async () => {
    getSupervisorExpenses.mockResolvedValue(page([apiExpense(42)]));
    approveExpense.mockResolvedValue({ budgetWarning: null });
    await act(async () => root.render(<ExpenseReviews />));
    await flush();

    const approveBtn = container.querySelector<HTMLButtonElement>('button[title="review.btn.approve"]');
    expect(approveBtn).not.toBeNull();
    await act(async () => approveBtn!.click());
    await flush();

    // Confirm inside the approve dialog (rendered in a portal → search
    // document). The row button carries the key only as title=, the dialog
    // confirm renders it as visible text — textContent finds just the latter.
    const confirm = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('review.btn.approve'));
    expect(confirm).toBeTruthy();
    await act(async () => confirm!.click());
    await flush();

    expect(approveExpense).toHaveBeenCalledWith(42, 'supervisor', '');
    // The list refetches after a successful approval.
    expect(getSupervisorExpenses.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('reject refuses to submit without the mandatory comment', async () => {
    getSupervisorExpenses.mockResolvedValue(page([apiExpense(9)]));
    await act(async () => root.render(<ExpenseReviews />));
    await flush();

    const rejectBtn = container.querySelector<HTMLButtonElement>('button[title="review.btn.reject"]');
    expect(rejectBtn).not.toBeNull();
    await act(async () => rejectBtn!.click());
    await flush();

    const confirm = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('review.dialog.rejectExpense'));
    expect(confirm).toBeTruthy();

    // Empty comment → the handler must bail out before the API.
    await act(async () => confirm!.click());
    await flush();
    expect(rejectExpense).not.toHaveBeenCalled();

    // A real >=10-char reason unlocks the call.
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
    expect(textarea).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(textarea, 'Recibo ilegible, re-subir por favor');
      textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    rejectExpense.mockResolvedValue(undefined);
    await act(async () => confirm!.click());
    await flush();

    expect(rejectExpense).toHaveBeenCalledWith(9, 'Recibo ilegible, re-subir por favor', 'supervisor');
  });
});
