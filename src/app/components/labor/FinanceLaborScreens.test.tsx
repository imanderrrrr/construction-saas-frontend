import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminHoursReportResponse, WorkerHoursSummary } from '../../services/time';

const mocks = vi.hoisted(() => ({ report: vi.fn(), confirm: vi.fn(), preview: vi.fn(), navigate: vi.fn() }));
vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t, i18n: { language: 'es' } }), initReactI18next: { type: '3rdParty', init: () => {} } };
});
vi.mock('../../services/time', () => ({ getAdminHoursReport: mocks.report, confirmPayment: mocks.confirm, previewPayment: mocks.preview, exportPayrollPayments: vi.fn() }));
vi.mock('../../services/projects', () => ({ listProjects: () => Promise.resolve({ content: [{ id: 1, name: 'Obra Demo', remainingBudgetCents: 100000 }] }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
import { LaborCostScreen } from './LaborCostScreen';
import { LaborPayrollScreen } from './LaborPayrollScreen';
import { HoursReportScreen } from './HoursReportScreen';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const worker: WorkerHoursSummary = {
  workerId: 1, workerName: 'Ana Demo', workerUsername: 'ana.demo', workerRole: 'WORKER', hourlyRate: 10,
  daysWorked: 2, totalDays: 3, totalApprovedHours: 8, unpaidApprovedHours: 3, avgHoursPerDay: 4, lateDays: 0, absences: 0,
  dailyEntries: [
    { date: '2026-10-01', projectId: 1, projectName: 'Obra Demo', clockIn: '08:00', clockOut: '13:00', lunchMinutes: 0, totalHours: 5, approvalStatus: 'APPROVED', reviewerName: 'Admin', paid: true, entryCost: 50 },
    { date: '2026-10-02', projectId: 1, projectName: 'Obra Demo', clockIn: '08:00', clockOut: '11:00', lunchMinutes: 0, totalHours: 3, approvalStatus: 'APPROVED', reviewerName: 'Admin', paid: false, entryCost: 30 },
    { date: '2026-10-03', projectId: 1, projectName: 'Obra Demo', clockIn: '08:00', clockOut: '12:00', lunchMinutes: 0, totalHours: 4, approvalStatus: 'PENDING', reviewerName: null, paid: false, entryCost: 40 },
  ],
};
const report: AdminHoursReportResponse = {
  kpis: { totalApprovedHours: 10, avgHoursPerDay: 4, lateArrivals: 0, absentDays: 0, totalLaborCost: 30, totalPendingHours: 4 },
  workers: [worker, { ...worker, workerId: 2, workerName: 'Marco Demo', workerUsername: 'marco.demo', hourlyRate: null, totalApprovedHours: 2, unpaidApprovedHours: 2, dailyEntries: [] }],
};

describe('new labor screens in Finance', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks(); mocks.report.mockResolvedValue(report);
    mocks.preview.mockResolvedValue({ workerId: 1, totalMinutes: 180, totalAmountCents: 3000, projects: [{ projectId: 1, amountCents: 3000 }], digest: "lab-preview" });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  const button = (key: string) => Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes(key))!;

  it('shows approved cost including paid hours, with a supervisor-hours navigation target', async () => {
    await act(async () => root.render(<LaborCostScreen mode="finance" onNavigate={mocks.navigate} />));
    expect(host.querySelector('[data-tour="sec.labor-cost.kpis"]')?.textContent).toContain('80.00');
    expect(host.textContent).not.toContain('120.00');
    expect(host.textContent).toContain('finance:labor.rateAdmin');
    expect(button('admin:cost.setRate')).toBeUndefined();
    await act(async () => button('finance:nav.supervisorHours').click());
    expect(mocks.navigate).toHaveBeenCalledWith('supervisor-hours');
  });

  it('uses unpaid hours for payroll without offering admin payment actions', async () => {
    await act(async () => root.render(<LaborPayrollScreen mode="finance" onNavigate={mocks.navigate} />));
    expect(host.querySelector('[data-tour="sec.labor-payroll.kpis"]')?.textContent).toContain('30.00');
    expect(host.textContent).toContain('finance:labor.rateAdmin');
    expect(button('admin:cost.setRate')).toBeUndefined();
    expect(button('admin:pay.confirm')).toBeUndefined();
    expect(button('admin:pay.exportPayments')).toBeUndefined();
    expect(host.textContent).not.toContain('admin:pay.d.title');
    expect(host.textContent).toContain('Ana Demo');
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('shows approved unpaid records outside the selected period without adding them to payable totals', async () => {
    mocks.report.mockResolvedValue({...report, approvedUnpaidRecordsOutsidePeriod: 3, approvedUnpaidSegmentsOutsidePeriod: 4, approvedUnpaidMinutesOutsidePeriod: 180});
    await act(async () => root.render(<LaborPayrollScreen onNavigate={mocks.navigate} />));
    expect(host.querySelector('[role="status"]')?.textContent).toContain('admin:pay.outsidePeriod');
    expect(host.querySelector('[data-tour="sec.labor-payroll.kpis"]')?.textContent).toContain('30.00');
  });

  it('says "at least" when the server bounded the outside-period notice', async () => {
    mocks.report.mockResolvedValue({...report, approvedUnpaidRecordsOutsidePeriod: 2000, approvedUnpaidSegmentsOutsidePeriod: 2100,
      approvedUnpaidMinutesOutsidePeriod: 126000, approvedUnpaidOutsidePeriodTruncated: true});
    await act(async () => root.render(<LaborPayrollScreen onNavigate={mocks.navigate} />));
    expect(host.querySelector('[role="status"]')?.textContent).toContain('admin:pay.outsidePeriodAtLeast');
  });

  it('retains Administration rate management', async () => {
    await act(async () => root.render(<LaborCostScreen onNavigate={mocks.navigate} />));
    await act(async () => button('admin:cost.setRate').click());
    expect(mocks.navigate).toHaveBeenCalledWith('users');
  });
  it('does not report unapproved hours as a settled payroll', async () => {
    mocks.report.mockResolvedValue({ ...report, workers: [{ ...worker, totalApprovedHours: 0, unpaidApprovedHours: 0, dailyEntries: worker.dailyEntries.filter(entry => entry.approvalStatus === 'PENDING') }] });
    await act(async () => root.render(<LaborPayrollScreen mode="finance" onNavigate={mocks.navigate} />));
    expect(host.textContent).toContain('admin:pay.emptyTitle');
    expect(host.textContent).not.toContain('admin:pay.allPaidBig');
    expect(host.textContent).not.toContain('admin:pay.groupPaid');
  });
  it('opens an incomplete workday without formatting null hours as a number', async () => {
    mocks.report.mockResolvedValue({ ...report, workers: [{ ...worker, dailyEntries: [{ ...worker.dailyEntries[0], totalHours: null, clockOut: null, approvalStatus: 'PENDING' }] }] });
    await act(async () => root.render(<HoursReportScreen onNavigate={mocks.navigate} />));
    const name = [...host.querySelectorAll('span')].find(d => d.textContent === 'Ana Demo')!;
    await act(async () => name.click());
    expect(host.textContent).toContain('Ana Demo');
    expect(host.textContent).toContain('—');
    expect(host.textContent).not.toContain('NaN');
    expect(host.textContent).toContain('08:00 → —');
  });
});
