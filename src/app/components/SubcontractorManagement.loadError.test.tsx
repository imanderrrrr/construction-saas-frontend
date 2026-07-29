// BuildTrack — SubcontractorManagement load-error tests (audit 2026-07-29).
//
// Jobs/invoices loads only toasted on failure (a toast fades in seconds and
// leaves the "no jobs" empty state behind), and the detail tabs swallowed
// failures the same way. These tests pin the fix: persistent banner + retry,
// never the innocent empty states. Same harness as
// ExpenseReviews.money.test.tsx.

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
  listUsers: () => Promise.resolve({ content: [] }),
}));
// The component calls api() directly for the create-job project dropdown;
// stub just that export and keep the module's real surface.
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  api: () => Promise.resolve({ content: [] }),
}));

const listJobs = vi.fn();
const listInvoices = vi.fn();
const getJobObservations = vi.fn();
vi.mock('../services/subcontractors', () => ({
  listJobs: (...a: unknown[]) => listJobs(...a),
  listInvoices: (...a: unknown[]) => listInvoices(...a),
  getJobObservations: (...a: unknown[]) => getJobObservations(...a),
  getJobTimeline: vi.fn(() => Promise.resolve([])),
  getJobEvidence: vi.fn(() => Promise.resolve([])),
  addJobObservation: vi.fn(),
  createJob: vi.fn(),
  updateJobStatus: vi.fn(),
  getJob: vi.fn(),
  getEvidenceFileUrl: (id: number) => `/evidence/${id}`,
  getInvoiceFileUrl: (id: number) => `/invoices/${id}`,
  reviewInvoice: vi.fn(),
  registerPayment: vi.fn(),
  ADMIN_JOB_TRANSITIONS: {
    ASSIGNED: [], IN_PROGRESS: [], IN_REVIEW: [], OBSERVED: [], APPROVED: [], CLOSED: [],
  },
  INVOICE_TRANSITIONS: {
    SUBMITTED: [], IN_REVIEW: [], OBSERVED: [], APPROVED: [], PENDING_PAYMENT: [], PAID: [],
  },
}));

import { SubcontractorManagement } from './SubcontractorManagement';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

// The banner keys contain the empty-state keys as prefixes
// (empty.jobsLoadFailed ⊃ empty.jobs), so textContent substring checks would
// lie — assert on whole rendered elements instead.
function hasExactText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll('p'))
    .some(p => p.textContent === text);
}

function job(id: number) {
  return {
    id,
    title: `Trabajo ${id}`,
    subcontractorName: `Sub ${id}`,
    projectName: `Proyecto ${id}`,
    status: 'IN_PROGRESS',
    dueDate: null,
    isOverdue: false,
  };
}

describe('SubcontractorManagement — load errors', () => {
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

  it('a failed jobs load shows the banner + retry, NEVER the empty state', async () => {
    listJobs.mockRejectedValueOnce(new Error('boom'));
    await act(async () => root.render(<SubcontractorManagement />));
    await flush();

    const banner = container.querySelector('[data-testid="subcontractor-jobs-load-error"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('subcontractors:empty.jobsLoadFailed');
    expect(hasExactText(container, 'subcontractors:empty.jobs')).toBe(false);
    expect(container.textContent).not.toContain('subcontractors:empty.createFirst');

    // Retry re-invokes the loader and recovers.
    listJobs.mockResolvedValueOnce({ content: [job(1)], totalPages: 1 });
    const bannerButtons = Array.from(banner!.querySelectorAll('button'));
    const retry = bannerButtons[bannerButtons.length - 1];
    await act(async () => retry.click());
    await flush();

    expect(listJobs).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="subcontractor-jobs-load-error"]')).toBeNull();
    expect(container.textContent).toContain('Trabajo 1');
  });

  it('a failed invoices load shows the banner and recovers on retry', async () => {
    listJobs.mockResolvedValue({ content: [], totalPages: 0 });
    listInvoices.mockRejectedValueOnce(new Error('boom'));
    await act(async () => root.render(<SubcontractorManagement />));
    await flush();

    const invoicesTab = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('subcontractors:tabs.invoices'));
    expect(invoicesTab).toBeTruthy();
    await act(async () => invoicesTab!.click());
    await flush();

    const banner = container.querySelector('[data-testid="subcontractor-invoices-load-error"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('subcontractors:empty.invoicesLoadFailed');
    expect(hasExactText(container, 'subcontractors:empty.invoices')).toBe(false);

    // Retry: a genuinely empty result may now show the real empty state.
    listInvoices.mockResolvedValueOnce({ content: [], totalPages: 0 });
    const bannerButtons = Array.from(banner!.querySelectorAll('button'));
    const retry = bannerButtons[bannerButtons.length - 1];
    await act(async () => retry.click());
    await flush();

    expect(container.querySelector('[data-testid="subcontractor-invoices-load-error"]')).toBeNull();
    expect(hasExactText(container, 'subcontractors:empty.invoices')).toBe(true);
  });

  it('a failed detail-tab load shows the banner, not the fake-empty chat', async () => {
    listJobs.mockResolvedValue({ content: [job(5)], totalPages: 1 });
    getJobObservations.mockRejectedValueOnce(new Error('boom'));
    await act(async () => root.render(<SubcontractorManagement />));
    await flush();

    const viewBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('subcontractors:btn.viewDetails'));
    expect(viewBtn).toBeTruthy();
    await act(async () => viewBtn!.click());
    await flush();

    const banner = container.querySelector('[data-testid="subcontractor-detail-load-error"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('subcontractors:detail.loadFailed');
    expect(container.textContent).not.toContain('subcontractors:detail.noObservations');

    // Retry recovers; an empty chat is now genuinely empty.
    getJobObservations.mockResolvedValue([]);
    const bannerButtons = Array.from(banner!.querySelectorAll('button'));
    const retry = bannerButtons[bannerButtons.length - 1];
    await act(async () => retry.click());
    await flush();

    expect(container.querySelector('[data-testid="subcontractor-detail-load-error"]')).toBeNull();
    expect(container.textContent).toContain('subcontractors:detail.noObservations');
  });
});
