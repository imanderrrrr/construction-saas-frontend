import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExpenseReportResponse } from '../services/expenses';
import { fmtDateTime, fmtDate as fmtDateTz } from './dateTime';

/* ═══════════════════════════════════════════════════════════════════
   Brand colours — Excel (ARGB hex, no #)
   ═══════════════════════════════════════════════════════════════════ */
const XL_BRAND_DARK   = '083B6D';
const XL_BRAND_PRIMARY = '0B82C7';
const XL_BRAND_LIGHT  = 'E8F4FD';
const XL_WHITE        = 'FFFFFF';
const XL_GRAY_BG      = 'F5F7FA';
const XL_GRAY_TEXT    = '8B949E';
const XL_BLACK        = '0B0F16';
const XL_EMERALD      = '059669';
const XL_AMBER        = 'D97706';

/* ═══════════════════════════════════════════════════════════════════
   Brand colours — PDF (RGB tuples)
   ═══════════════════════════════════════════════════════════════════ */
const BRAND_DARK: [number, number, number]   = [8, 59, 109];
const BRAND_PRIMARY: [number, number, number] = [11, 130, 199];
const BRAND_LIGHT: [number, number, number]  = [232, 244, 253];
const WHITE: [number, number, number]        = [255, 255, 255];
const GRAY_BG: [number, number, number]      = [245, 247, 250];
const GRAY_TEXT: [number, number, number]    = [139, 148, 158];
const BLACK: [number, number, number]        = [11, 15, 22];
const EMERALD: [number, number, number]      = [5, 150, 105];
const AMBER: [number, number, number]        = [217, 119, 6];
const RED: [number, number, number]          = [220, 38, 38];

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */
export interface ExpenseExportParams {
  report: ExpenseReportResponse;
  dateFrom: string;
  dateTo: string;
  companyName?: string;
  projectFilter?: string;
  typeFilter?: string;
}

/* ═══════════════════════════════════════════════════════════════════
   Shared helpers
   ═══════════════════════════════════════════════════════════════════ */
function fmtMoney(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function fmtMoneyStr(cents: number): string {
  const val = (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${val}`;
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

/* ═══════════════════════════════════════════════════════════════════
   EXCEL EXPORT
   ═══════════════════════════════════════════════════════════════════ */
export async function exportExpenseExcel(params: ExpenseExportParams) {
  const {
    report,
    dateFrom,
    dateTo,
    companyName = 'OFJR Construction',
    projectFilter,
    typeFilter,
  } = params;
  const { kpis, byProject, byWorker } = report;

  const wb = new ExcelJS.Workbook();
  wb.creator = companyName;
  wb.created = new Date();

  /* ═══════════════════ SHEET 1 — By Project ═══════════════════ */
  const ws = wb.addWorksheet('By Project', {
    properties: { defaultColWidth: 16 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  ws.columns = [
    { width: 5 },   // A: #
    { width: 32 },  // B: Project
    { width: 18 },  // C: Approved
    { width: 14 },  // D: Pending
    { width: 14 },  // E: Observed
    { width: 14 },  // F: Rejected
  ];

  // ── Header banner ──
  ws.mergeCells('A1:F1');
  const headerRow = ws.getRow(1);
  headerRow.height = 40;
  headerRow.getCell(1).value = companyName.toUpperCase();
  headerRow.getCell(1).font = { name: 'Calibri', size: 18, bold: true, color: { argb: XL_WHITE } };
  headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_DARK } };
  headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('A2:F2');
  const subtitleRow = ws.getRow(2);
  subtitleRow.height = 28;
  subtitleRow.getCell(1).value = 'Expense Report — By Project';
  subtitleRow.getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: XL_WHITE } };
  subtitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_PRIMARY } };
  subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('A3:F3');
  const periodRow = ws.getRow(3);
  periodRow.height = 22;
  const filterInfo = [
    projectFilter ? `Project: ${projectFilter}` : null,
    typeFilter ? `Type: ${typeFilter}` : null,
  ].filter(Boolean).join('   |   ');
  periodRow.getCell(1).value = `Period: ${dateFrom}  —  ${dateTo}   |   Generated: ${fmtDateTz(new Date().toISOString())}${filterInfo ? `   |   ${filterInfo}` : ''}`;
  periodRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: XL_GRAY_TEXT } };
  periodRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_GRAY_BG } };
  periodRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // ── KPI section ──
  ws.mergeCells('A5:B5');
  ws.getCell('A5').value = 'KEY METRICS';
  ws.getCell('A5').font = { name: 'Calibri', size: 11, bold: true, color: { argb: XL_BRAND_DARK } };

  const kpiData: [string, string][] = [
    ['Total Approved', fmtMoneyStr(kpis.totalApprovedCents)],
    ['Avg per Worker', kpis.avgPerWorkerCents != null ? fmtMoneyStr(kpis.avgPerWorkerCents) : 'N/A'],
    ['Expense Count', String(kpis.expenseCount)],
    ['Top Category', kpis.topCategory ?? 'N/A'],
  ];

  kpiData.forEach((kv, i) => {
    const row = ws.getRow(6 + i);
    ws.mergeCells(`A${6 + i}:C${6 + i}`);
    row.getCell(1).value = kv[0];
    row.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: XL_GRAY_TEXT } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? XL_WHITE : XL_GRAY_BG } };
    ws.mergeCells(`D${6 + i}:E${6 + i}`);
    row.getCell(4).value = kv[1];
    row.getCell(4).font = { name: 'Calibri', size: 11, bold: true, color: { argb: XL_BLACK } };
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? XL_WHITE : XL_GRAY_BG } };
    row.getCell(4).alignment = { horizontal: 'right' };
  });

  // ── Table header ──
  const tableStartRow = 6 + kpiData.length + 2;
  const projectHeaders = ['#', 'Project', 'Approved', 'Pending', 'Observed', 'Rejected'];
  const hRow = ws.getRow(tableStartRow);
  hRow.height = 26;
  projectHeaders.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: XL_WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_DARK } };
    cell.alignment = { vertical: 'middle', horizontal: i >= 2 ? 'right' : 'left' };
    cell.border = borderStyle();
  });

  // ── Data rows with breakdown sub-rows ──
  let currentRow = tableStartRow + 1;
  byProject.forEach((p, idx) => {
    const r = ws.getRow(currentRow);
    const isEven = idx % 2 === 0;
    const bgColor = isEven ? XL_WHITE : XL_GRAY_BG;

    const values: (string | number)[] = [
      idx + 1,
      p.projectName,
      fmtMoney(p.approvedCents),
      p.pendingCount,
      p.observedCount,
      p.rejectedCount,
    ];

    values.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { name: 'Calibri', size: 10, color: { argb: XL_BLACK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = borderStyle();
      if (i >= 2) {
        cell.alignment = { horizontal: 'right' };
        if (i === 2 && typeof v === 'number') cell.numFmt = '$#,##0.00';
      }
    });
    currentRow++;

    // Type breakdown sub-rows
    p.breakdown.forEach(bd => {
      const subR = ws.getRow(currentRow);
      const subBg = XL_BRAND_LIGHT;

      subR.getCell(1).value = '';
      subR.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: subBg } };
      subR.getCell(1).border = borderStyle();

      subR.getCell(2).value = `  \u21B3 ${bd.type}`;
      subR.getCell(2).font = { name: 'Calibri', size: 9, italic: true, color: { argb: XL_GRAY_TEXT } };
      subR.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: subBg } };
      subR.getCell(2).border = borderStyle();

      subR.getCell(3).value = fmtMoney(bd.totalCents);
      subR.getCell(3).numFmt = '$#,##0.00';
      subR.getCell(3).font = { name: 'Calibri', size: 9, italic: true, color: { argb: XL_GRAY_TEXT } };
      subR.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: subBg } };
      subR.getCell(3).alignment = { horizontal: 'right' };
      subR.getCell(3).border = borderStyle();

      subR.getCell(4).value = bd.count;
      subR.getCell(4).font = { name: 'Calibri', size: 9, italic: true, color: { argb: XL_GRAY_TEXT } };
      subR.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: subBg } };
      subR.getCell(4).alignment = { horizontal: 'right' };
      subR.getCell(4).border = borderStyle();

      [5, 6].forEach(col => {
        subR.getCell(col).value = '';
        subR.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: subBg } };
        subR.getCell(col).border = borderStyle();
      });

      currentRow++;
    });
  });

  // ── Totals row ──
  const totalRow = ws.getRow(currentRow);
  totalRow.height = 28;
  ws.mergeCells(`A${currentRow}:B${currentRow}`);
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: XL_WHITE } };
  totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_PRIMARY } };
  totalRow.getCell(1).alignment = { vertical: 'middle' };

  [3, 4, 5, 6].forEach(col => {
    const cell = totalRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_PRIMARY } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: XL_WHITE } };
    cell.border = borderStyle();
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  });
  totalRow.getCell(3).value = fmtMoney(kpis.totalApprovedCents);
  totalRow.getCell(3).numFmt = '$#,##0.00';
  totalRow.getCell(4).value = byProject.reduce((s, p) => s + p.pendingCount, 0);
  totalRow.getCell(5).value = byProject.reduce((s, p) => s + p.observedCount, 0);
  totalRow.getCell(6).value = byProject.reduce((s, p) => s + p.rejectedCount, 0);

  /* ═══════════════════ SHEET 2 — By Worker ═══════════════════ */
  const wsW = wb.addWorksheet('By Worker', {
    properties: { defaultColWidth: 14 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  wsW.columns = [
    { width: 5 },   // A: #
    { width: 28 },  // B: Worker
    { width: 14 },  // C: Submitted
    { width: 14 },  // D: Approved
    { width: 14 },  // E: Pending
    { width: 14 },  // F: Observed
    { width: 14 },  // G: Rejected
    { width: 18 },  // H: Total Approved
  ];

  // ── Header banner ──
  wsW.mergeCells('A1:H1');
  wsW.getRow(1).height = 32;
  wsW.getCell('A1').value = `Expense Report — By Worker`;
  wsW.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: XL_WHITE } };
  wsW.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_DARK } };
  wsW.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

  // ── Table header ──
  const workerHeaders = ['#', 'Worker', 'Submitted', 'Approved', 'Pending', 'Observed', 'Rejected', 'Total Approved'];
  const whRow = wsW.getRow(3);
  whRow.height = 26;
  workerHeaders.forEach((h, i) => {
    const cell = whRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: XL_WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_PRIMARY } };
    cell.alignment = { vertical: 'middle', horizontal: i >= 2 ? 'right' : 'left' };
    cell.border = borderStyle();
  });

  // ── Data rows ──
  byWorker.forEach((w, idx) => {
    const r = wsW.getRow(4 + idx);
    const isEven = idx % 2 === 0;
    const bgColor = isEven ? XL_WHITE : XL_GRAY_BG;

    const values: (string | number)[] = [
      idx + 1,
      w.workerName ?? w.workerUsername,
      w.submittedCount,
      w.approvedCount,
      w.pendingCount,
      w.observedCount,
      w.rejectedCount,
      fmtMoney(w.totalApprovedCents),
    ];

    values.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { name: 'Calibri', size: 10, color: { argb: XL_BLACK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = borderStyle();
      if (i >= 2) {
        cell.alignment = { horizontal: 'right' };
        if (i === 7 && typeof v === 'number') cell.numFmt = '$#,##0.00';
      }
    });
  });

  // ── Totals row ──
  const wTotalRow = wsW.getRow(4 + byWorker.length);
  wTotalRow.height = 28;
  wsW.mergeCells(`A${wTotalRow.number}:B${wTotalRow.number}`);
  wTotalRow.getCell(1).value = 'TOTAL';
  wTotalRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: XL_WHITE } };
  wTotalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_PRIMARY } };
  wTotalRow.getCell(1).alignment = { vertical: 'middle' };

  [3, 4, 5, 6, 7, 8].forEach(col => {
    const cell = wTotalRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_PRIMARY } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: XL_WHITE } };
    cell.border = borderStyle();
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  });
  wTotalRow.getCell(3).value = byWorker.reduce((s, w) => s + w.submittedCount, 0);
  wTotalRow.getCell(4).value = byWorker.reduce((s, w) => s + w.approvedCount, 0);
  wTotalRow.getCell(5).value = byWorker.reduce((s, w) => s + w.pendingCount, 0);
  wTotalRow.getCell(6).value = byWorker.reduce((s, w) => s + w.observedCount, 0);
  wTotalRow.getCell(7).value = byWorker.reduce((s, w) => s + w.rejectedCount, 0);
  wTotalRow.getCell(8).value = fmtMoney(kpis.totalApprovedCents);
  wTotalRow.getCell(8).numFmt = '$#,##0.00';

  /* ═══════════════════ Save ═══════════════════ */
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Expense_Report_${dateFrom}_${dateTo}.xlsx`);
}

/* ═══════════════════════════════════════════════════════════════════
   PDF helpers
   ═══════════════════════════════════════════════════════════════════ */
function drawRoundedRect(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  r: number, fill: [number, number, number],
) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

function drawPieChart(
  doc: jsPDF,
  cx: number, cy: number, radius: number,
  data: { label: string; value: number; color: [number, number, number] }[],
  title: string,
) {
  if (data.length === 0) return;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_DARK);
  doc.text(title, cx - radius, cy - radius - 8);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;
  data.forEach(d => {
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    doc.setFillColor(...d.color);
    const steps = Math.max(Math.ceil(sliceAngle / 0.05), 2);
    for (let s = 0; s < steps; s++) {
      const a1 = startAngle + (s / steps) * sliceAngle;
      const a2 = startAngle + ((s + 1) / steps) * sliceAngle;
      const x1 = cx + radius * Math.cos(a1);
      const y1 = cy + radius * Math.sin(a1);
      const x2 = cx + radius * Math.cos(a2);
      const y2 = cy + radius * Math.sin(a2);
      doc.triangle(cx, cy, x1, y1, x2, y2, 'F');
    }
    startAngle = endAngle;
  });

  // Legend
  const legendX = cx + radius + 8;
  let legendY = cy - radius + 5;
  data.forEach(d => {
    doc.setFillColor(...d.color);
    doc.rect(legendX, legendY - 3, 5, 5, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
    const lbl = d.label.length > 16 ? d.label.slice(0, 15) + '\u2026' : d.label;
    doc.text(`${lbl} (${pct}%)`, legendX + 7, legendY + 1);
    legendY += 9;
  });
}

function addPageHeader(doc: jsPDF, pageW: number, title: string, companyName: string) {
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFillColor(...BRAND_PRIMARY);
  doc.rect(0, 18, pageW, 2, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text(companyName.toUpperCase(), 12, 9);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 12, 15);
}

function addFooter(doc: jsPDF, pageW: number, pageH: number, companyName: string, pageNum: number) {
  const y = pageH - 8;
  doc.setDrawColor(...GRAY_BG);
  doc.setLineWidth(0.3);
  doc.line(12, y - 2, pageW - 12, y - 2);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_TEXT);
  doc.text(`${companyName} — Confidential`, 12, y);
  doc.text(`Page ${pageNum}`, pageW - 12, y, { align: 'right' });
  doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, pageW / 2, y, { align: 'center' });
}

/* ═══════════════════════════════════════════════════════════════════
   PDF EXPORT
   ═══════════════════════════════════════════════════════════════════ */
export function exportExpensePdf(params: ExpenseExportParams) {
  const {
    report,
    dateFrom,
    dateTo,
    companyName = 'OFJR Construction',
    projectFilter,
    typeFilter,
  } = params;
  const { kpis, byProject, byWorker } = report;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  /* ═══════════════════ PAGE 1 — Cover + KPIs + Pie Chart ═══════════════════ */

  // Header bar
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFillColor(...BRAND_PRIMARY);
  doc.rect(0, 28, pageW, 3, 'F');

  // Company name
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text(companyName.toUpperCase(), margin, 14);

  // Report title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Expense Report', margin, 23);

  // Period info
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_TEXT);
  const filterParts = [
    `Period: ${dateFrom}  \u2014  ${dateTo}`,
    `Generated: ${fmtDateTz(new Date().toISOString())}`,
    projectFilter ? `Project: ${projectFilter}` : null,
    typeFilter ? `Type: ${typeFilter}` : null,
  ].filter(Boolean).join('   |   ');
  doc.text(filterParts, margin, 38);

  // ── KPI Cards ──
  const kpiCardW = (pageW - 2 * margin - 3 * 4) / 4;
  const kpiCardH = 24;
  const kpiY = 43;
  const kpiItems = [
    { label: 'Total Approved', value: fmtMoneyStr(kpis.totalApprovedCents), color: EMERALD },
    { label: 'Avg per Worker', value: kpis.avgPerWorkerCents != null ? fmtMoneyStr(kpis.avgPerWorkerCents) : 'N/A', color: BRAND_PRIMARY },
    { label: 'Expense Count', value: String(kpis.expenseCount), color: BRAND_DARK },
    { label: 'Top Category', value: kpis.topCategory ?? 'N/A', color: AMBER },
  ];

  kpiItems.forEach((kpi, i) => {
    const kx = margin + i * (kpiCardW + 4);
    drawRoundedRect(doc, kx, kpiY, kpiCardW, kpiCardH, 3, WHITE);
    doc.setDrawColor(220, 220, 230);
    doc.roundedRect(kx, kpiY, kpiCardW, kpiCardH, 3, 3, 'S');

    // Accent line
    doc.setFillColor(...kpi.color);
    doc.rect(kx, kpiY, 3, kpiCardH, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_TEXT);
    doc.text(kpi.label, kx + 7, kpiY + 9);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, kx + 7, kpiY + 19);
  });

  // ── Pie Chart — Approved by Project ──
  const chartY = kpiY + kpiCardH + 10;
  const chartH = pageH - chartY - 20;

  const pieColors: [number, number, number][] = [
    BRAND_DARK, BRAND_PRIMARY, EMERALD, AMBER, [99, 102, 241],
    [168, 85, 247], [236, 72, 153], [20, 184, 166], [244, 63, 94], [234, 179, 8],
  ];

  const pieData = byProject
    .filter(p => p.approvedCents > 0)
    .sort((a, b) => b.approvedCents - a.approvedCents)
    .slice(0, 8)
    .map((p, i) => ({
      label: p.projectName,
      value: fmtMoney(p.approvedCents),
      color: pieColors[i % pieColors.length],
    }));

  const pieRadius = Math.min(chartH / 2 - 10, 35);
  const pieCx = pageW / 2 - 30;
  const pieCy = chartY + chartH / 2;
  drawPieChart(doc, pieCx, pieCy, pieRadius, pieData, 'Approved Expenses by Project');

  addFooter(doc, pageW, pageH, companyName, 1);

  /* ═══════════════════ PAGE 2 — By Project Table ═══════════════════ */
  doc.addPage('a4', 'landscape');
  addPageHeader(doc, pageW, 'Expense Report — By Project', companyName);

  const projectTableData: string[][] = [];
  byProject.forEach((p, i) => {
    projectTableData.push([
      String(i + 1),
      p.projectName,
      fmtMoneyStr(p.approvedCents),
      String(p.pendingCount),
      String(p.observedCount),
      String(p.rejectedCount),
    ]);
    // Breakdown sub-rows
    p.breakdown.forEach(bd => {
      projectTableData.push([
        '',
        `  \u21B3 ${bd.type}`,
        fmtMoneyStr(bd.totalCents),
        String(bd.count),
        '',
        '',
      ]);
    });
  });

  autoTable(doc, {
    startY: 24,
    head: [['#', 'Project', 'Approved', 'Pending', 'Observed', 'Rejected']],
    body: projectTableData,
    foot: [[
      '',
      'TOTAL',
      fmtMoneyStr(kpis.totalApprovedCents),
      String(byProject.reduce((s, p) => s + p.pendingCount, 0)),
      String(byProject.reduce((s, p) => s + p.observedCount, 0)),
      String(byProject.reduce((s, p) => s + p.rejectedCount, 0)),
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    footStyles: {
      fillColor: BRAND_PRIMARY,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: BLACK,
    },
    alternateRowStyles: {
      fillColor: GRAY_BG,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 60 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 25 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      // Style sub-rows (breakdown) in lighter colour
      if (data.section === 'body' && data.column.index === 1) {
        const raw = String(data.cell.raw);
        if (raw.startsWith('  \u21B3')) {
          data.cell.styles.textColor = GRAY_TEXT;
          data.cell.styles.fontStyle = 'italic';
          data.cell.styles.fontSize = 7;
        }
      }
    },
  });

  // Add footer to page 2 (and any overflow pages)
  let currentPage = 2;
  const pagesAfterProject = doc.getNumberOfPages();
  for (let p = 2; p <= pagesAfterProject; p++) {
    doc.setPage(p);
    addFooter(doc, pageW, pageH, companyName, p);
    currentPage = p;
  }

  /* ═══════════════════ PAGE 3 — By Worker Table ═══════════════════ */
  doc.addPage('a4', 'landscape');
  currentPage++;
  addPageHeader(doc, pageW, 'Expense Report — By Worker', companyName);

  const workerTableData = byWorker.map((w, i) => [
    String(i + 1),
    w.workerName ?? w.workerUsername,
    String(w.submittedCount),
    String(w.approvedCount),
    String(w.pendingCount),
    String(w.observedCount),
    String(w.rejectedCount),
    fmtMoneyStr(w.totalApprovedCents),
  ]);

  autoTable(doc, {
    startY: 24,
    head: [['#', 'Worker', 'Submitted', 'Approved', 'Pending', 'Observed', 'Rejected', 'Total Approved']],
    body: workerTableData,
    foot: [[
      '',
      'TOTAL',
      String(byWorker.reduce((s, w) => s + w.submittedCount, 0)),
      String(byWorker.reduce((s, w) => s + w.approvedCount, 0)),
      String(byWorker.reduce((s, w) => s + w.pendingCount, 0)),
      String(byWorker.reduce((s, w) => s + w.observedCount, 0)),
      String(byWorker.reduce((s, w) => s + w.rejectedCount, 0)),
      fmtMoneyStr(kpis.totalApprovedCents),
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    footStyles: {
      fillColor: BRAND_PRIMARY,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: BLACK,
    },
    alternateRowStyles: {
      fillColor: GRAY_BG,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 50 },
      2: { halign: 'right', cellWidth: 22 },
      3: { halign: 'right', cellWidth: 22 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      // Highlight total approved in emerald
      if (data.section === 'body' && data.column.index === 7) {
        data.cell.styles.textColor = EMERALD;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Add footer to all remaining pages
  const totalPages = doc.getNumberOfPages();
  for (let p = currentPage; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(doc, pageW, pageH, companyName, p);
  }

  doc.save(`Expense_Report_${dateFrom}_${dateTo}.pdf`);
}
