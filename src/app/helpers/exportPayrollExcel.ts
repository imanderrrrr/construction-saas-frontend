import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { WorkerHoursSummary, HoursReportKpis } from '../services/time';
import { fmtDate as fmtDateTz } from './dateTime';

/* ───────────────────────── Brand colours ───────────────────────── */
const BRAND_DARK   = '083B6D';
const BRAND_PRIMARY = '0B82C7';
const BRAND_LIGHT  = 'E8F4FD';
const WHITE        = 'FFFFFF';
const GRAY_BG      = 'F5F7FA';
const GRAY_TEXT    = '8B949E';
const BLACK        = '0B0F16';
const EMERALD      = '059669';
const AMBER        = 'D97706';

/* ───────────────────────── Types ───────────────────────── */
export interface PayrollExcelParams {
  workers: WorkerHoursSummary[];
  kpis: HoursReportKpis;
  dateFrom: string;
  dateTo: string;
  companyName?: string;
  reportTitle: string;
  generatedBy?: string;
}

/* ───────────────────────── Helpers ───────────────────────── */
function fmtMoney(n: number) {
  return Number(n.toFixed(2));
}

function borderStyle(): Partial<ExcelJS.Borders> {
  const thin: ExcelJS.BorderStyle = 'thin';
  return {
    top: { style: thin, color: { argb: 'D6DCE3' } },
    bottom: { style: thin, color: { argb: 'D6DCE3' } },
    left: { style: thin, color: { argb: 'D6DCE3' } },
    right: { style: thin, color: { argb: 'D6DCE3' } },
  };
}

/* ───────────────────────── Main export ───────────────────────── */
export async function exportPayrollExcel(params: PayrollExcelParams) {
  const { workers, kpis, dateFrom, dateTo, companyName = 'OFJR Construction', reportTitle, generatedBy } = params;

  const wb = new ExcelJS.Workbook();
  wb.creator = companyName;
  wb.created = new Date();

  /* ═══════════════════ SHEET 1 — Payroll Summary ═══════════════════ */
  const ws = wb.addWorksheet('Payroll Summary', {
    properties: { defaultColWidth: 16 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  // Column widths
  ws.columns = [
    { width: 5 },   // A: #
    { width: 28 },  // B: Worker
    { width: 16 },  // C: Role
    { width: 14 },  // D: Hourly Rate
    { width: 16 },  // E: Approved Hours
    { width: 16 },  // F: Total Pay
    { width: 28 },  // G: Projects
    { width: 18 },  // H: Observations
  ];

  // ── Header banner ──
  ws.mergeCells('A1:H1');
  const headerRow = ws.getRow(1);
  headerRow.height = 40;
  headerRow.getCell(1).value = companyName.toUpperCase();
  headerRow.getCell(1).font = { name: 'Calibri', size: 18, bold: true, color: { argb: WHITE } };
  headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DARK } };
  headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('A2:H2');
  const subtitleRow = ws.getRow(2);
  subtitleRow.height = 28;
  subtitleRow.getCell(1).value = reportTitle;
  subtitleRow.getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: WHITE } };
  subtitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_PRIMARY } };
  subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('A3:H3');
  const periodRow = ws.getRow(3);
  periodRow.height = 22;
  periodRow.getCell(1).value = `Period: ${dateFrom}  —  ${dateTo}   |   Generated: ${fmtDateTz(new Date().toISOString())}${generatedBy ? `   |   By: ${generatedBy}` : ''}`;
  periodRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: GRAY_TEXT } };
  periodRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } };
  periodRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // ── KPI section ──
  ws.mergeCells('A5:B5');
  ws.getCell('A5').value = 'KEY METRICS';
  ws.getCell('A5').font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND_DARK } };

  const kpiData = [
    ['Total Workers', String(workers.length)],
    ['Total Approved Hours', `${kpis.totalApprovedHours.toFixed(2)} hrs`],
    ['Total Pending Hours', `${kpis.totalPendingHours.toFixed(2)} hrs`],
    ['Total Labor Cost', `$${fmtMoney(kpis.totalLaborCost).toLocaleString()}`],
    ['Avg Hours/Day', `${kpis.avgHoursPerDay.toFixed(2)} hrs`],
    ['Late Arrivals', String(kpis.lateArrivals)],
    ['Absent Days', String(kpis.absentDays)],
  ];

  kpiData.forEach((kv, i) => {
    const row = ws.getRow(6 + i);
    ws.mergeCells(`A${6 + i}:C${6 + i}`);
    row.getCell(1).value = kv[0];
    row.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: GRAY_TEXT } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? WHITE : GRAY_BG } };
    ws.mergeCells(`D${6 + i}:E${6 + i}`);
    row.getCell(4).value = kv[1];
    row.getCell(4).font = { name: 'Calibri', size: 11, bold: true, color: { argb: BLACK } };
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? WHITE : GRAY_BG } };
    row.getCell(4).alignment = { horizontal: 'right' };
  });

  // ── Table header ──
  const tableStartRow = 6 + kpiData.length + 2;
  const headers = ['#', 'Worker', 'Role', 'Hourly Rate', 'Approved Hours', 'Total Pay', 'Projects', 'Observations'];
  const hRow = ws.getRow(tableStartRow);
  hRow.height = 26;
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DARK } };
    cell.alignment = { vertical: 'middle', horizontal: i >= 3 && i <= 5 ? 'right' : 'left' };
    cell.border = borderStyle();
  });

  // ── Data rows ──
  workers.forEach((w, idx) => {
    const r = ws.getRow(tableStartRow + 1 + idx);
    const pay = w.hourlyRate != null ? fmtMoney(w.totalApprovedHours * w.hourlyRate) : null;
    const projectNames = [...new Set(w.dailyEntries.map(e => e.projectName))].join(', ');
    const obs = w.hourlyRate == null ? 'Rate not defined' : '';
    const isEven = idx % 2 === 0;
    const bgColor = isEven ? WHITE : GRAY_BG;

    const values = [
      idx + 1,
      w.workerName ?? w.workerUsername,
      w.workerRole,
      w.hourlyRate != null ? w.hourlyRate : 'N/A',
      w.totalApprovedHours,
      pay != null ? pay : 'N/A',
      projectNames,
      obs,
    ];

    values.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { name: 'Calibri', size: 10, color: { argb: i === 7 && obs ? AMBER : BLACK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = borderStyle();
      if (i >= 3 && i <= 5) {
        cell.alignment = { horizontal: 'right' };
        if (typeof v === 'number') cell.numFmt = i === 3 || i === 5 ? '$#,##0.00' : '#,##0.0';
      }
    });
  });

  // ── Totals row ──
  const totalRow = ws.getRow(tableStartRow + 1 + workers.length);
  totalRow.height = 28;
  ws.mergeCells(`A${totalRow.number}:C${totalRow.number}`);
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
  totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_PRIMARY } };
  totalRow.getCell(1).alignment = { vertical: 'middle' };

  [4, 5, 6, 7, 8].forEach(col => {
    const cell = totalRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_PRIMARY } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    cell.border = borderStyle();
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  });
  totalRow.getCell(4).value = '';
  totalRow.getCell(5).value = kpis.totalApprovedHours;
  totalRow.getCell(5).numFmt = '#,##0.0';
  totalRow.getCell(6).value = fmtMoney(kpis.totalLaborCost);
  totalRow.getCell(6).numFmt = '$#,##0.00';

  /* ═══════════════════ SHEET 2 — Worker Detail ═══════════════════ */
  const wsDetail = wb.addWorksheet('Worker Detail', {
    properties: { defaultColWidth: 14 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  wsDetail.columns = [
    { width: 24 }, // Worker
    { width: 14 }, // Date
    { width: 22 }, // Project
    { width: 10 }, // Clock In
    { width: 10 }, // Clock Out
    { width: 10 }, // Lunch
    { width: 12 }, // Transit
    { width: 12 }, // Total Hours
    { width: 12 }, // Status
    { width: 16 }, // Reviewer
  ];

  wsDetail.mergeCells('A1:J1');
  wsDetail.getRow(1).height = 32;
  wsDetail.getCell('A1').value = `${reportTitle} — Daily Detail`;
  wsDetail.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: WHITE } };
  wsDetail.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DARK } };
  wsDetail.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

  const detailHeaders = ['Worker', 'Date', 'Project', 'Clock In', 'Clock Out', 'Lunch (min)', 'Transit (min)', 'Total Hours', 'Status', 'Reviewer'];
  const dhRow = wsDetail.getRow(3);
  dhRow.height = 24;
  detailHeaders.forEach((h, i) => {
    const cell = dhRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_PRIMARY } };
    cell.border = borderStyle();
  });

  let detailRowIdx = 4;
  workers.forEach(w => {
    w.dailyEntries.forEach((entry, eIdx) => {
      const r = wsDetail.getRow(detailRowIdx);
      const bg = eIdx % 2 === 0 ? WHITE : GRAY_BG;
      const vals = [
        eIdx === 0 ? (w.workerName ?? w.workerUsername) : '',
        entry.date,
        entry.projectName,
        entry.clockIn ?? '—',
        entry.clockOut ?? '—',
        entry.lunchMinutes ?? 0,
        entry.transitMinutes ?? 0,
        entry.totalHours ?? 0,
        entry.approvalStatus,
        entry.reviewerName ?? '—',
      ];
      vals.forEach((v, i) => {
        const cell = r.getCell(i + 1);
        cell.value = v as ExcelJS.CellValue;
        cell.font = { name: 'Calibri', size: 10, color: { argb: BLACK } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = borderStyle();
        if (i === 8) {
          const status = String(v).toLowerCase();
          cell.font = {
            name: 'Calibri', size: 10, bold: true,
            color: { argb: status === 'approved' ? EMERALD : status === 'pending' ? AMBER : 'DC2626' },
          };
        }
        if (i === 7 && typeof v === 'number') cell.numFmt = '#,##0.0';
      });
      detailRowIdx++;
    });
    // Separator row between workers
    const sep = wsDetail.getRow(detailRowIdx);
    for (let c = 1; c <= 10; c++) {
      sep.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT } };
      sep.getCell(c).border = borderStyle();
    }
    sep.height = 4;
    detailRowIdx++;
  });

  /* ═══════════════════ SHEET 3 — Charts Data ═══════════════════ */
  const wsCharts = wb.addWorksheet('Charts Data', {
    properties: { defaultColWidth: 18 },
  });

  wsCharts.mergeCells('A1:D1');
  wsCharts.getRow(1).height = 30;
  wsCharts.getCell('A1').value = 'Statistical Data for Charts';
  wsCharts.getCell('A1').font = { name: 'Calibri', size: 13, bold: true, color: { argb: WHITE } };
  wsCharts.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DARK } };
  wsCharts.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

  // Hours by worker chart data
  wsCharts.getCell('A3').value = 'Hours by Worker';
  wsCharts.getCell('A3').font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND_DARK } };
  wsCharts.getCell('A4').value = 'Worker';
  wsCharts.getCell('B4').value = 'Approved Hours';
  wsCharts.getCell('C4').value = 'Total Pay';
  [wsCharts.getCell('A4'), wsCharts.getCell('B4'), wsCharts.getCell('C4')].forEach(c => {
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_PRIMARY } };
  });

  workers.forEach((w, i) => {
    const r = wsCharts.getRow(5 + i);
    r.getCell(1).value = w.workerName ?? w.workerUsername;
    r.getCell(2).value = w.totalApprovedHours;
    r.getCell(2).numFmt = '#,##0.0';
    r.getCell(3).value = w.hourlyRate != null ? fmtMoney(w.totalApprovedHours * w.hourlyRate) : 0;
    r.getCell(3).numFmt = '$#,##0.00';
    [1, 2, 3].forEach(c => {
      r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? WHITE : GRAY_BG } };
      r.getCell(c).border = borderStyle();
    });
  });

  // Cost by project chart data
  const projectCosts = new Map<string, { hours: number; cost: number }>();
  workers.forEach(w => {
    w.dailyEntries.forEach(e => {
      const prev = projectCosts.get(e.projectName) ?? { hours: 0, cost: 0 };
      const hrs = e.totalHours ?? 0;
      prev.hours += hrs;
      if (w.hourlyRate != null) prev.cost += hrs * w.hourlyRate;
      projectCosts.set(e.projectName, prev);
    });
  });

  const chartProjStartRow = 5 + workers.length + 2;
  wsCharts.getCell(`A${chartProjStartRow}`).value = 'Cost by Project';
  wsCharts.getCell(`A${chartProjStartRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND_DARK } };
  const hdr2Row = chartProjStartRow + 1;
  wsCharts.getCell(`A${hdr2Row}`).value = 'Project';
  wsCharts.getCell(`B${hdr2Row}`).value = 'Hours';
  wsCharts.getCell(`C${hdr2Row}`).value = 'Cost';
  [wsCharts.getCell(`A${hdr2Row}`), wsCharts.getCell(`B${hdr2Row}`), wsCharts.getCell(`C${hdr2Row}`)].forEach(c => {
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_PRIMARY } };
  });

  let pIdx = 0;
  projectCosts.forEach((val, name) => {
    const r = wsCharts.getRow(hdr2Row + 1 + pIdx);
    r.getCell(1).value = name;
    r.getCell(2).value = Number(val.hours.toFixed(1));
    r.getCell(2).numFmt = '#,##0.0';
    r.getCell(3).value = fmtMoney(val.cost);
    r.getCell(3).numFmt = '$#,##0.00';
    [1, 2, 3].forEach(c => {
      r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pIdx % 2 === 0 ? WHITE : GRAY_BG } };
      r.getCell(c).border = borderStyle();
    });
    pIdx++;
  });

  /* ═══════════════════ Save ═══════════════════ */
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${reportTitle.replace(/\s+/g, '_')}_${dateFrom}_${dateTo}.xlsx`);
}
