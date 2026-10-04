// Costo de mano de obra and Nómina on the finance panel (`mode="finance"`).
//
// Same screens and figures as the admin's. What changes: hourly rates live in
// Usuarios, which finance does not have, so a missing rate is reported
// instead of offered; the switch's first stop is the supervisors' hours; and
// paying stays — the owner opened /admin/payroll to FINANCE, so «Confirmar
// pago» and «Pagos a Excel» work there exactly as they do for the admin.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminHoursReportResponse, WorkerHoursSummary } from '../../services/time';

const mocks = vi.hoisted(() => ({ report: vi.fn(), confirm: vi.fn(), exportPayments: vi.fn(), navigate: vi.fn() }));
vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t, i18n: { language: 'es' } }), initReactI18next: { type: '3rdParty', init: () => {} } };
});
vi.mock('../../services/time', () => ({ getAdminHoursReport: mocks.report, confirmPayment: mocks.confirm }));
vi.mock('../../services/payroll', () => ({ exportPayrollPayments: mocks.exportPayments }));
vi.mock('../../services/projects', () => ({
  listProjects: () => Promise.resolve({ content: [{ id: 1, name: 'Obra Demo', remainingBudgetCents: 100000 }] }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { resetTourScope, useTourScope } from '../../lib/tourScope';
import { LaborCostScreen } from './LaborCostScreen';
import { LaborPayrollScreen } from './LaborPayrollScreen';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Which tour the screen claimed (lib/tourScope). */
function ScopeProbe() {
  const scope = useTourScope();
  return <span data-testid="scope">{scope?.key ?? 'none'}</span>;
}

// 5 h approved and paid, 3 h approved and unpaid, 4 h still pending.
const ana: WorkerHoursSummary = {
  workerId: 1, workerName: 'Ana Demo', workerUsername: 'ana.demo', workerRole: 'WORKER', hourlyRate: 10,
  daysWorked: 2, totalDays: 3, totalApprovedHours: 8, unpaidApprovedHours: 3, avgHoursPerDay: 4, lateDays: 0, absences: 0,
  dailyEntries: [
    { date: '2026-10-01', projectId: 1, projectName: 'Obra Demo', clockIn: '08:00', clockOut: '13:00', lunchMinutes: 0, totalHours: 5, approvalStatus: 'APPROVED', reviewerName: 'Admin', paid: true, entryCost: 50 },
    { date: '2026-10-02', projectId: 1, projectName: 'Obra Demo', clockIn: '08:00', clockOut: '11:00', lunchMinutes: 0, totalHours: 3, approvalStatus: 'APPROVED', reviewerName: 'Admin', paid: false, entryCost: 30 },
    { date: '2026-10-03', projectId: 1, projectName: 'Obra Demo', clockIn: '08:00', clockOut: '12:00', lunchMinutes: 0, totalHours: 4, approvalStatus: 'PENDING', reviewerName: null, paid: false, entryCost: 40 },
  ],
};
// No hourly rate: 2 approved hours nobody can put a price on.
const marco: WorkerHoursSummary = {
  ...ana, workerId: 2, workerName: 'Marco Demo', workerUsername: 'marco.demo', hourlyRate: null,
  totalApprovedHours: 2, unpaidApprovedHours: 2, dailyEntries: [],
};
const report: AdminHoursReportResponse = {
  kpis: { totalApprovedHours: 10, avgHoursPerDay: 4, lateArrivals: 0, absentDays: 0, totalLaborCost: 30, totalPendingHours: 4 },
  workers: [ana, marco],
};

describe('the labor screens on the finance panel', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    resetTourScope();
    mocks.report.mockResolvedValue(report);
    mocks.confirm.mockResolvedValue({ budgetWarnings: [] });
    mocks.exportPayments.mockResolvedValue(undefined);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  const button = (key: string) => Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes(key));
  const anchor = (name: string) => host.querySelector(`[data-tour="${name}"]`);
  const scope = () => host.querySelector('[data-testid="scope"]')?.textContent;
  const click = async (el: Element | null | undefined) => {
    expect(el).toBeTruthy();
    await act(async () => { (el as HTMLElement).click(); });
  };

  describe('Costo de mano de obra', () => {
    it('costs every approved hour, paid or not, and reports a missing rate instead of offering Usuarios', async () => {
      await act(async () => root.render(<LaborCostScreen mode="finance" onNavigate={mocks.navigate} />));
      // 8 approved hours × $10: the paid ones count, the pending ones do not.
      expect(anchor('sec.labor-cost-finanzas.kpis')?.textContent).toContain('80.00');
      expect(host.textContent).not.toContain('120.00');
      expect(host.textContent).toContain('admin:cost.rateByAdmin');
      expect(button('admin:cost.setRate')).toBeUndefined();

      // The drawer of the person with no rate says the same, without the way to Usuarios.
      await click(Array.from(host.querySelectorAll('span')).find(el => el.textContent === 'Marco Demo'));
      expect(host.textContent).toContain('admin:cost.d.ratelessTitle');
      expect(button('admin:cost.d.ratelessCta')).toBeUndefined();
      expect(mocks.navigate).not.toHaveBeenCalledWith('users');
    });

    it('names itself after the finance group and leads to the supervisors\' hours, not to the workers\' report', async () => {
      await act(async () => root.render(<LaborCostScreen mode="finance" onNavigate={mocks.navigate} />));
      expect(host.textContent).toContain('finance:group.labor');
      expect(host.textContent).not.toContain('admin:lab.kicker.labor-cost');
      expect(button('admin:lab.tab.hours')).toBeUndefined();
      await click(button('finance:nav.supervisorHours'));
      expect(mocks.navigate).toHaveBeenCalledWith('supervisor-hours');
    });

    it('keeps rate management on the admin panel', async () => {
      await act(async () => root.render(<LaborCostScreen onNavigate={mocks.navigate} />));
      expect(host.textContent).toContain('admin:lab.kicker.labor-cost');
      expect(host.textContent).not.toContain('admin:cost.rateByAdmin');
      await click(button('admin:cost.setRate'));
      expect(mocks.navigate).toHaveBeenCalledWith('users');
    });
  });

  describe('Nómina', () => {
    it('owes the unpaid approved hours and reports a missing rate instead of offering Usuarios', async () => {
      await act(async () => root.render(<LaborPayrollScreen mode="finance" onNavigate={mocks.navigate} />));
      // 3 unpaid approved hours × $10.
      expect(anchor('sec.labor-payroll-finanzas.kpis')?.textContent).toContain('30.00');
      expect(host.textContent).toContain('admin:cost.rateByAdmin');
      expect(button('admin:cost.setRate')).toBeUndefined();
    });

    it('confirms a payment', async () => {
      await act(async () => root.render(<LaborPayrollScreen mode="finance" onNavigate={mocks.navigate} />));
      await click(button('admin:pay.confirm'));
      expect(host.textContent).toContain('admin:pay.d.title');
      expect(host.textContent).toContain('Ana Demo');
      expect(mocks.confirm).not.toHaveBeenCalled();

      await click(button('admin:pay.d.confirmCta'));
      expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ workerId: 1, notes: null }));
      const { periodFrom, periodTo } = mocks.confirm.mock.calls[0][0];
      expect(periodFrom <= periodTo).toBe(true);
      // The list reads again once the payment went through.
      expect(mocks.report).toHaveBeenCalledTimes(2);
      expect(host.textContent).not.toContain('admin:pay.d.title');
    });

    it('downloads «Pagos a Excel» for the period on screen', async () => {
      await act(async () => root.render(<LaborPayrollScreen mode="finance" onNavigate={mocks.navigate} />));
      await click(button('admin:pay.exportPayments'));
      expect(mocks.exportPayments).toHaveBeenCalledTimes(1);
      const [{ dateFrom, dateTo }] = mocks.exportPayments.mock.calls[0];
      expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ dateFrom, dateTo }));
    });

    it('keeps rate management on the admin panel', async () => {
      await act(async () => root.render(<LaborPayrollScreen onNavigate={mocks.navigate} />));
      await click(button('admin:cost.setRate'));
      expect(mocks.navigate).toHaveBeenCalledWith('users');
    });

    // Production defect, on both panels: someone with only pending hours has
    // nothing to pay, so `isPaid` called them paid — and with nobody else in
    // the period, the screen announced "Todo pagado".
    it.each(['admin', 'finance'] as const)('on the %s panel, pending-only hours are not reported as a settled payroll', async mode => {
      mocks.report.mockResolvedValue({
        ...report,
        workers: [{ ...ana, totalApprovedHours: 0, unpaidApprovedHours: 0, dailyEntries: ana.dailyEntries.filter(e => e.approvalStatus === 'PENDING') }],
      });
      await act(async () => root.render(<LaborPayrollScreen mode={mode} onNavigate={mocks.navigate} />));
      expect(host.textContent).toContain('admin:pay.emptyTitle');
      expect(host.textContent).not.toContain('admin:pay.allPaidBig');
      expect(host.textContent).not.toContain('admin:pay.groupPaid');
      expect(host.textContent).not.toContain('Ana Demo');
    });
  });

  // Every new screen is discoverable: on the finance panel each one claims a
  // tour of its own, with every stop on screen; the admin keeps the original.
  describe('the guided tours', () => {
    it('Costo claims labor-cost-finanzas on the finance panel', async () => {
      await act(async () => root.render(<><LaborCostScreen mode="finance" onNavigate={mocks.navigate} /><ScopeProbe /></>));
      expect(scope()).toBe('labor-cost-finanzas');
      for (const stop of ['kpis', 'filters', 'list']) expect(anchor(`sec.labor-cost-finanzas.${stop}`)).not.toBeNull();
      expect(host.querySelector('[data-tour^="sec.labor-cost."]')).toBeNull();
    });

    it('Nómina claims labor-payroll-finanzas, with a stop on the two exports', async () => {
      await act(async () => root.render(<><LaborPayrollScreen mode="finance" onNavigate={mocks.navigate} /><ScopeProbe /></>));
      expect(scope()).toBe('labor-payroll-finanzas');
      for (const stop of ['kpis', 'filters', 'list']) expect(anchor(`sec.labor-payroll-finanzas.${stop}`)).not.toBeNull();
      expect(anchor('sec.labor-payroll-finanzas.export')?.textContent).toContain('admin:pay.exportPayments');
      expect(host.querySelector('[data-tour^="sec.labor-payroll."]')).toBeNull();
    });

    it('the admin panel keeps its own tours and claims nothing', async () => {
      await act(async () => root.render(<><LaborPayrollScreen onNavigate={mocks.navigate} /><ScopeProbe /></>));
      expect(scope()).toBe('none');
      for (const stop of ['kpis', 'filters', 'list']) expect(anchor(`sec.labor-payroll.${stop}`)).not.toBeNull();
      expect(host.querySelector('[data-tour*="finanzas"]')).toBeNull();
    });
  });
});
