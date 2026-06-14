// BuildTrack — LaborCostReport on-screen costing (latent H4 variant).
//
// PR #7 fixed the PDF/Excel exports so payroll is costed from UNPAID approved
// hours, not totalApprovedHours (which includes already-paid hours and would
// double-bill a prior payroll run). LaborCostReport renders the same figures on
// screen and shared the same latent bug in its fallback paths — masked today
// only because the backend always supplies `projectedCost`.
//
// These tests force `projectedCost: null` (the fallback path) so the screen has
// to derive cost/hours itself, and assert it uses the unpaid figure — the same
// invariant helpers/payroll.test.ts locks in for the exports.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerHoursSummary, HoursReportKpis } from '../services/time';

const mocks = vi.hoisted(() => ({
  getAdminHoursReport: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

vi.mock('../services/time', () => ({
  getAdminHoursReport: mocks.getAdminHoursReport,
}));
vi.mock('../services/projects', () => ({
  listProjects: vi.fn(() => Promise.resolve({ content: [] })),
}));
vi.mock('../services/users', () => ({
  listActiveUsers: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../helpers/exportPayrollExcel', () => ({ exportPayrollExcel: vi.fn() }));
vi.mock('../helpers/exportPayrollPdf', () => ({ exportPayrollPdf: vi.fn() }));
vi.mock('../helpers/dateTime', () => ({ businessToday: () => '2026-06-14' }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Heavy / portal-backed UI — stub so the test renders LaborCostReport's own
// table markup under jsdom, not Radix internals.
vi.mock('./StatCard', () => ({ StatCard: () => null }));
vi.mock('./EmptyState', () => ({ EmptyState: () => null }));
vi.mock('./ui/skeleton', () => ({ Skeleton: () => null }));
vi.mock('./ui/button', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));
vi.mock('./ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));
vi.mock('./ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: React.ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { LaborCostReport } from './LaborCostReport';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── Fixtures ────────────────────────────────────────────────────────────────

function mkWorker(p: Partial<WorkerHoursSummary> & Pick<WorkerHoursSummary, 'workerId'>): WorkerHoursSummary {
  return {
    workerName: `Worker ${p.workerId}`,
    workerUsername: `worker${p.workerId}`,
    workerRole: 'WORKER',
    hourlyRate: null,
    daysWorked: 1,
    totalDays: 1,
    totalApprovedHours: 0,
    avgHoursPerDay: 8,
    lateDays: 0,
    absences: 0,
    dailyEntries: [
      { date: '2026-06-02', projectId: 1, projectName: 'Site A', clockIn: '08:00', lunchMinutes: 30, clockOut: '17:00', totalHours: 8, approvalStatus: 'APPROVED', reviewerName: 'Sup' },
    ],
    ...p,
  };
}

function mkKpis(p: Partial<HoursReportKpis> = {}): HoursReportKpis {
  return { totalApprovedHours: 0, avgHoursPerDay: 8, lateArrivals: 0, absentDays: 0, totalLaborCost: 0, totalPendingHours: 0, ...p };
}

async function renderReport(root: Root) {
  await act(async () => {
    root.render(<LaborCostReport />);
  });
  // Drain the getAdminHoursReport promise + the state update to uiState='data'.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('LaborCostReport — costs from unpaid approved hours (H4)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.getAdminHoursReport.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('derives a partially-paid worker\'s cost from unpaid hours, not total approved', async () => {
    // 100 approved hrs, but only 40 still unpaid; backend omits projectedCost,
    // so the screen must fall back to 40 × $10 = $400 — NOT 100 × $10 = $1,000.
    mocks.getAdminHoursReport.mockResolvedValue({
      kpis: mkKpis({ totalApprovedHours: 100, totalLaborCost: 400 }),
      workers: [mkWorker({ workerId: 1, hourlyRate: 10, totalApprovedHours: 100, unpaidApprovedHours: 40, projectedCost: null })],
    });

    await renderReport(root);
    const text = container.textContent ?? '';

    expect(text).toContain('$400.00');        // 40 unpaid × $10 — reconciles with the cost
    expect(text).not.toContain('$1,000.00');  // the double-paid figure (100 approved × $10)
    expect(text).toContain('40.00 hrs');      // row shows unpaid hours, consistent with the cost basis
  });

  it('omits a fully-paid worker with no rate from the "missing rate" warning', async () => {
    // 20 approved hrs but 0 unpaid (already settled) and no hourly rate. There
    // is nothing left to owe, so the worker must NOT be flagged as blocking
    // payroll — the old `totalApprovedHours > 0` test would have flagged them.
    mocks.getAdminHoursReport.mockResolvedValue({
      kpis: mkKpis({ totalApprovedHours: 20 }),
      workers: [mkWorker({ workerId: 2, hourlyRate: null, totalApprovedHours: 20, unpaidApprovedHours: 0, projectedCost: null })],
    });

    await renderReport(root);
    const text = container.textContent ?? '';

    expect(text).not.toContain('laborCost.workersWithoutRate');
  });
});
