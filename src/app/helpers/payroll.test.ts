import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';
import type { WorkerHoursSummary, HoursReportKpis } from '../services/time';
import { unpaidApprovedHours, workerRowPay } from './payroll';

// file-saver touches the DOM (anchor click); stub it so we can capture the Blob
// the export hands off, then read the real workbook bytes back out.
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
import { saveAs } from 'file-saver';
import { exportPayrollExcel } from './exportPayrollExcel';

// dateTime.getBusinessTz() reads localStorage, which jsdom does not back here.
// Stub it so the export's period header (fmtDate) falls through to the default TZ.
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
});

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
    avgHoursPerDay: 0,
    lateDays: 0,
    absences: 0,
    dailyEntries: [
      { date: '2026-06-02', projectId: 1, projectName: 'Site A', clockIn: '08:00', lunchMinutes: 30, clockOut: '17:00', totalHours: 8, approvalStatus: 'APPROVED', reviewerName: 'Sup' },
    ],
    ...p,
  };
}

// Dataset where several workers were ALREADY PAID for part of their approved
// hours (totalApprovedHours > unpaidApprovedHours):
//
//   A: rate 10, 100 approved / 40 unpaid, projectedCost 400  → owe 400
//   B: rate 20,  50 approved / 50 unpaid, projectedCost 1000 → owe 1000 (nothing paid yet)
//   C: rate 15,  30 approved / 10 unpaid, NO projectedCost   → owe 10×15 = 150 (fallback path)
//   D: no rate,  20 approved / 20 unpaid                     → N/A (excluded from cost)
//
// kpis.totalLaborCost is the unpaid-only sum the backend reports: 400+1000+150.
const WORKERS: WorkerHoursSummary[] = [
  mkWorker({ workerId: 1, hourlyRate: 10, totalApprovedHours: 100, unpaidApprovedHours: 40, projectedCost: 400 }),
  mkWorker({ workerId: 2, hourlyRate: 20, totalApprovedHours: 50,  unpaidApprovedHours: 50, projectedCost: 1000 }),
  mkWorker({ workerId: 3, hourlyRate: 15, totalApprovedHours: 30,  unpaidApprovedHours: 10 }),
  mkWorker({ workerId: 4, hourlyRate: null, totalApprovedHours: 20, unpaidApprovedHours: 20 }),
];

const KPIS: HoursReportKpis = {
  totalApprovedHours: 200, // 100 + 50 + 30 + 20 (all approved, paid + unpaid)
  avgHoursPerDay: 8,
  lateArrivals: 0,
  absentDays: 0,
  totalLaborCost: 1550, // 400 + 1000 + 150 — UNPAID only
  totalPendingHours: 0,
};

const EXPORT_PARAMS = {
  workers: WORKERS,
  kpis: KPIS,
  dateFrom: '2026-06-01',
  dateTo: '2026-06-14',
  reportTitle: 'Labor Payroll',
};

// ── Pure helper ──────────────────────────────────────────────────────────────

describe('unpaidApprovedHours', () => {
  it('uses unpaidApprovedHours when the backend supplies it', () => {
    expect(unpaidApprovedHours(mkWorker({ workerId: 1, totalApprovedHours: 100, unpaidApprovedHours: 40 }))).toBe(40);
  });

  it('falls back to totalApprovedHours when unpaid is absent', () => {
    expect(unpaidApprovedHours(mkWorker({ workerId: 1, totalApprovedHours: 100 }))).toBe(100);
  });
});

describe('workerRowPay', () => {
  it('prefers projectedCost (already net of paid hours)', () => {
    expect(workerRowPay(mkWorker({ workerId: 1, hourlyRate: 10, totalApprovedHours: 100, unpaidApprovedHours: 40, projectedCost: 400 }))).toBe(400);
  });

  it('derives pay from UNPAID hours when projectedCost is absent (never totalApprovedHours)', () => {
    const w = mkWorker({ workerId: 1, hourlyRate: 15, totalApprovedHours: 30, unpaidApprovedHours: 10 });
    expect(workerRowPay(w)).toBe(150);            // 10 unpaid × 15
    expect(workerRowPay(w)).not.toBe(30 * 15);    // would be 450 if it double-paid
  });

  it('falls back to totalApprovedHours only when unpaid is absent too', () => {
    expect(workerRowPay(mkWorker({ workerId: 1, hourlyRate: 12, totalApprovedHours: 20 }))).toBe(240);
  });

  it('returns null when the worker has no hourly rate', () => {
    expect(workerRowPay(mkWorker({ workerId: 1, hourlyRate: null, totalApprovedHours: 20, unpaidApprovedHours: 20 }))).toBeNull();
  });
});

// ── H4: per-row pay must reconcile with the report TOTAL ─────────────────────

describe('payroll export reconciliation (H4)', () => {
  it('sum of per-row pay equals kpis.totalLaborCost', () => {
    const sum = WORKERS.reduce((acc, w) => acc + (workerRowPay(w) ?? 0), 0);
    expect(sum).toBeCloseTo(KPIS.totalLaborCost, 2);
  });

  it('the OLD formula (totalApprovedHours × rate) over-pays and does NOT reconcile', () => {
    // This is the bug: paying from totalApprovedHours bills already-settled hours.
    const buggySum = WORKERS.reduce(
      (acc, w) => acc + (w.hourlyRate != null ? w.totalApprovedHours * w.hourlyRate : 0),
      0,
    );
    expect(buggySum).toBe(2450);                       // 1000 + 1000 + 450
    expect(buggySum).toBeGreaterThan(KPIS.totalLaborCost);
    expect(buggySum).not.toBeCloseTo(KPIS.totalLaborCost, 2);
  });
});

// ── Faithful check against the real generated .xlsx document ──────────────────

async function loadGeneratedWorkbook(): Promise<ExcelJS.Workbook> {
  vi.mocked(saveAs).mockClear();
  await exportPayrollExcel(EXPORT_PARAMS);
  const blob = vi.mocked(saveAs).mock.calls[0][0] as Blob;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  return wb;
}

describe('exportPayrollExcel — generated document reconciles', () => {
  it('Payroll Summary "Total Pay" rows sum to kpis.totalLaborCost and match the TOTAL row', async () => {
    const wb = await loadGeneratedWorkbook();
    const ws = wb.getWorksheet('Payroll Summary')!;

    // Data rows are the only ones with a numeric index in column A.
    const rowPays: (number | string)[] = [];
    let footerTotalPay: number | undefined;
    ws.eachRow((row) => {
      const a = row.getCell(1).value;
      if (typeof a === 'number') rowPays.push(row.getCell(6).value as number | string);
      if (a === 'TOTAL') footerTotalPay = row.getCell(6).value as number;
    });

    expect(rowPays).toEqual([400, 1000, 150, 'N/A']); // D has no rate → N/A
    const rowSum = rowPays.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
    expect(rowSum).toBeCloseTo(KPIS.totalLaborCost, 2);
    expect(footerTotalPay).toBeCloseTo(KPIS.totalLaborCost, 2);
  });

  it('Charts Data "Total Pay" column also reconciles (3rd call site)', async () => {
    const wb = await loadGeneratedWorkbook();
    const ws = wb.getWorksheet('Charts Data')!;

    // "Hours by Worker" block: header on row 4, one row per worker from row 5.
    let chartSum = 0;
    for (let i = 0; i < WORKERS.length; i++) {
      const v = ws.getRow(5 + i).getCell(3).value;
      if (typeof v === 'number') chartSum += v;
    }
    expect(chartSum).toBeCloseTo(KPIS.totalLaborCost, 2);
  });
});
