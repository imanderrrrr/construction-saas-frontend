import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { todayStamp, fmtDateTime, fmtDate as fmtDateTz } from './dateTime';

/* ───────────────────────── Types ───────────────────────── */

export interface BudgetExportRow {
  project: string;
  totalBudget: number;
  consumed: number;
  available: number;
  executionPct: number;
  deviation: string;
  status: string;
  breakdown: { type: string; label: string; amount: number; pct: number }[];
}

export interface AlertExportRow {
  project: string;
  pct: number;
  level: string;
  remaining: number;
  estimatedDays: number | null;
}

export interface BudgetExportParams {
  rows: BudgetExportRow[];
  alerts: AlertExportRow[];
  kpis: { totalBudget: number; totalConsumed: number; totalAvailable: number; projectsOver90: number };
  companyName?: string;
}

/* ═══════════════════════════════════════════════════════════════════
   EXCEL EXPORT
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
const XL_RED_HEX      = 'DC2626';

function borderStyle(): Partial<ExcelJS.Borders> {
  const thin: ExcelJS.BorderStyle = 'thin';
  return {
    top: { style: thin, color: { argb: 'D6DCE3' } },
    bottom: { style: thin, color: { argb: 'D6DCE3' } },
    left: { style: thin, color: { argb: 'D6DCE3' } },
    right: { style: thin, color: { argb: 'D6DCE3' } },
  };
}

function fmtMoneyExcel(n: number) {
  return Number(n.toFixed(2));
}

function deviationColor(dev: string): string {
  switch (dev) {
    case 'severe-over':   return XL_RED_HEX;
    case 'moderate-over': return XL_AMBER;
    case 'on-track':      return XL_EMERALD;
    case 'under':         return XL_BRAND_PRIMARY;
    default:              return XL_BLACK;
  }
}

function deviationLabel(dev: string): string {
  switch (dev) {
    case 'severe-over':   return 'Severe Over';
    case 'moderate-over': return 'Moderate Over';
    case 'on-track':      return 'On Track';
    case 'under':         return 'Under Budget';
    default:              return dev;
  }
}

export async function exportBudgetExcel(params: BudgetExportParams) {
  const { rows, alerts, kpis, companyName = 'OFJR Construction' } = params;
  const dateStr = todayStamp();

  const wb = new ExcelJS.Workbook();
  wb.creator = companyName;
  wb.created = new Date();

  /* ═══════════════════ SHEET 1 — Budget Overview ═══════════════════ */
  const ws = wb.addWorksheet('Budget Overview', {
    properties: { defaultColWidth: 16 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  ws.columns = [
    { width: 5 },   // A: #
    { width: 30 },  // B: Project
    { width: 18 },  // C: Budget
    { width: 18 },  // D: Consumed
    { width: 18 },  // E: Available
    { width: 14 },  // F: Execution %
    { width: 16 },  // G: Deviation
    { width: 12 },  // H: Status
  ];

  // ── Header banner ──
  ws.mergeCells('A1:H1');
  const headerRow = ws.getRow(1);
  headerRow.height = 40;
  headerRow.getCell(1).value = companyName.toUpperCase();
  headerRow.getCell(1).font = { name: 'Calibri', size: 18, bold: true, color: { argb: XL_WHITE } };
  headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_DARK } };
  headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('A2:H2');
  const subtitleRow = ws.getRow(2);
  subtitleRow.height = 28;
  subtitleRow.getCell(1).value = 'Budget Report';
  subtitleRow.getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: XL_WHITE } };
  subtitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_PRIMARY } };
  subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('A3:H3');
  const periodRow = ws.getRow(3);
  periodRow.height = 22;
  periodRow.getCell(1).value = `Generated: ${fmtDateTz(new Date().toISOString())}`;
  periodRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: XL_GRAY_TEXT } };
  periodRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_GRAY_BG } };
  periodRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // ── KPI section ──
  ws.mergeCells('A5:B5');
  ws.getCell('A5').value = 'KEY METRICS';
  ws.getCell('A5').font = { name: 'Calibri', size: 11, bold: true, color: { argb: XL_BRAND_DARK } };

  const kpiData: [string, string][] = [
    ['Total Budget', `$${fmtMoneyExcel(kpis.totalBudget).toLocaleString()}`],
    ['Total Consumed', `$${fmtMoneyExcel(kpis.totalConsumed).toLocaleString()}`],
    ['Total Available', `$${fmtMoneyExcel(kpis.totalAvailable).toLocaleString()}`],
    ['Projects >90%', String(kpis.projectsOver90)],
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
  const headers = ['#', 'Project', 'Budget', 'Consumed', 'Available', 'Execution %', 'Deviation', 'Status'];
  const hRow = ws.getRow(tableStartRow);
  hRow.height = 26;
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: XL_WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_DARK } };
    cell.alignment = { vertical: 'middle', horizontal: i >= 2 && i <= 5 ? 'right' : 'left' };
    cell.border = borderStyle();
  });

  // ── Data rows with breakdown sub-rows ──
  let currentRow = tableStartRow + 1;
  rows.forEach((r, idx) => {
    const dataRow = ws.getRow(currentRow);
    const isEven = idx % 2 === 0;
    const bgColor = isEven ? XL_WHITE : XL_GRAY_BG;

    const values: (string | number)[] = [
      idx + 1,
      r.project,
      fmtMoneyExcel(r.totalBudget),
      fmtMoneyExcel(r.consumed),
      fmtMoneyExcel(r.available),
      r.executionPct / 100,
      deviationLabel(r.deviation),
      r.status,
    ];

    values.forEach((v, i) => {
      const cell = dataRow.getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { name: 'Calibri', size: 10, color: { argb: XL_BLACK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = borderStyle();

      if (i >= 2 && i <= 4) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '$#,##0.00';
      }
      if (i === 5) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#0.0%';
        const pctColor = r.executionPct >= 90 ? XL_RED_HEX : r.executionPct >= 70 ? XL_AMBER : XL_EMERALD;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: pctColor } };
      }
      if (i === 6) {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: deviationColor(r.deviation) } };
      }
      if (i === 7) {
        const statusColor = r.status === 'Active' ? XL_EMERALD : XL_GRAY_TEXT;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: statusColor } };
      }
    });
    currentRow++;

    // Breakdown sub-rows
    r.breakdown.forEach(b => {
      const subRow = ws.getRow(currentRow);
      subRow.getCell(1).value = '';
      subRow.getCell(2).value = `  \u21B3 ${b.label}`;
      subRow.getCell(2).font = { name: 'Calibri', size: 9, italic: true, color: { argb: XL_GRAY_TEXT } };
      subRow.getCell(3).value = '';
      subRow.getCell(4).value = fmtMoneyExcel(b.amount);
      subRow.getCell(4).numFmt = '$#,##0.00';
      subRow.getCell(4).alignment = { horizontal: 'right' };
      subRow.getCell(5).value = '';
      subRow.getCell(6).value = b.pct / 100;
      subRow.getCell(6).numFmt = '#0.0%';
      subRow.getCell(6).alignment = { horizontal: 'right' };
      subRow.getCell(7).value = b.type;
      subRow.getCell(8).value = '';

      for (let c = 1; c <= 8; c++) {
        const cell = subRow.getCell(c);
        if (!cell.font) cell.font = { name: 'Calibri', size: 9, color: { argb: XL_GRAY_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_LIGHT } };
        cell.border = borderStyle();
      }
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

  for (let col = 3; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_PRIMARY } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: XL_WHITE } };
    cell.border = borderStyle();
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  }
  totalRow.getCell(3).value = fmtMoneyExcel(kpis.totalBudget);
  totalRow.getCell(3).numFmt = '$#,##0.00';
  totalRow.getCell(4).value = fmtMoneyExcel(kpis.totalConsumed);
  totalRow.getCell(4).numFmt = '$#,##0.00';
  totalRow.getCell(5).value = fmtMoneyExcel(kpis.totalAvailable);
  totalRow.getCell(5).numFmt = '$#,##0.00';

  /* ═══════════════════ SHEET 2 — Alerts ═══════════════════ */
  const wsAlerts = wb.addWorksheet('Alerts', {
    properties: { defaultColWidth: 16 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  wsAlerts.columns = [
    { width: 30 },  // Project
    { width: 16 },  // Execution %
    { width: 16 },  // Alert Level
    { width: 18 },  // Remaining
    { width: 18 },  // Estimated Days
  ];

  wsAlerts.mergeCells('A1:E1');
  wsAlerts.getRow(1).height = 32;
  wsAlerts.getCell('A1').value = 'Budget Alerts — Projects \u226570% Consumption';
  wsAlerts.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: XL_WHITE } };
  wsAlerts.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_DARK } };
  wsAlerts.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

  const alertHeaders = ['Project', 'Execution %', 'Alert Level', 'Remaining', 'Estimated Days'];
  const ahRow = wsAlerts.getRow(3);
  ahRow.height = 24;
  alertHeaders.forEach((h, i) => {
    const cell = ahRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: XL_WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_BRAND_PRIMARY } };
    cell.border = borderStyle();
  });

  const filteredAlerts = alerts.filter(a => a.pct >= 70);
  filteredAlerts.forEach((a, idx) => {
    const row = wsAlerts.getRow(4 + idx);
    const bg = idx % 2 === 0 ? XL_WHITE : XL_GRAY_BG;
    const levelColor = a.level === 'critical' ? XL_RED_HEX : a.level === 'warning' ? XL_AMBER : XL_EMERALD;

    const values: (string | number)[] = [
      a.project,
      a.pct / 100,
      a.level.charAt(0).toUpperCase() + a.level.slice(1),
      fmtMoneyExcel(a.remaining),
      a.estimatedDays != null ? a.estimatedDays : 'N/A' as unknown as number,
    ];

    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { name: 'Calibri', size: 10, color: { argb: XL_BLACK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = borderStyle();

      if (i === 1) {
        cell.numFmt = '#0.0%';
        cell.alignment = { horizontal: 'right' };
        const pctColor = a.pct >= 90 ? XL_RED_HEX : XL_AMBER;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: pctColor } };
      }
      if (i === 2) {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: levelColor } };
      }
      if (i === 3) {
        cell.numFmt = '$#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
      if (i === 4) {
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  /* ═══════════════════ Save ═══════════════════ */
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Budget_Report_${dateStr}.xlsx`);
}

/* ═══════════════════════════════════════════════════════════════════
   PDF EXPORT
   ═══════════════════════════════════════════════════════════════════ */

const PDF_BRAND_DARK: [number, number, number]   = [8, 59, 109];
const PDF_BRAND_PRIMARY: [number, number, number] = [11, 130, 199];
const PDF_WHITE: [number, number, number]        = [255, 255, 255];
const PDF_GRAY_BG: [number, number, number]      = [245, 247, 250];
const PDF_GRAY_TEXT: [number, number, number]    = [139, 148, 158];
const PDF_BLACK: [number, number, number]        = [11, 15, 22];
const PDF_EMERALD: [number, number, number]      = [5, 150, 105];
const PDF_AMBER: [number, number, number]        = [217, 119, 6];
const PDF_RED: [number, number, number]          = [220, 38, 38];

function fmtMoneyPdf(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function drawRoundedRect(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  r: number, fill: [number, number, number],
) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

function drawHorizontalBarChart(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  data: { label: string; value: number }[],
  title: string,
) {
  if (data.length === 0) return;

  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_BRAND_DARK);
  doc.text(title, x, y - 3);

  // Background
  drawRoundedRect(doc, x, y, w, h, 2, PDF_WHITE);
  doc.setDrawColor(220, 220, 230);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barAreaX = x + 55;
  const barAreaW = w - 70;
  const barH = Math.min(12, (h - 10) / data.length - 2);
  const startY = y + 8;

  data.slice(0, 10).forEach((d, i) => {
    const bY = startY + i * (barH + 3);
    const bW = (d.value / maxVal) * barAreaW;

    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_GRAY_TEXT);
    const label = d.label.length > 16 ? d.label.slice(0, 15) + '\u2026' : d.label;
    doc.text(label, barAreaX - 3, bY + barH / 2 + 1, { align: 'right' });

    // Bar color based on value
    const color: [number, number, number] = d.value >= 90 ? PDF_RED : d.value >= 70 ? PDF_AMBER : PDF_EMERALD;
    doc.setFillColor(...color);
    doc.roundedRect(barAreaX, bY, Math.max(bW, 2), barH, 1, 1, 'F');

    // Value label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_BLACK);
    doc.text(`${d.value.toFixed(1)}%`, barAreaX + bW + 3, bY + barH / 2 + 1);
  });
}

function addPdfPageHeader(doc: jsPDF, pageW: number, title: string, companyName: string) {
  doc.setFillColor(...PDF_BRAND_DARK);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFillColor(...PDF_BRAND_PRIMARY);
  doc.rect(0, 18, pageW, 2, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_WHITE);
  doc.text(companyName.toUpperCase(), 12, 9);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 12, 15);
}

function addPdfFooter(doc: jsPDF, pageW: number, pageH: number, companyName: string, pageNum: number) {
  const y = pageH - 8;
  doc.setDrawColor(...PDF_GRAY_BG);
  doc.setLineWidth(0.3);
  doc.line(12, y - 2, pageW - 12, y - 2);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_GRAY_TEXT);
  doc.text(`${companyName} \u2014 Confidential`, 12, y);
  doc.text(`Page ${pageNum}`, pageW - 12, y, { align: 'right' });
  doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, pageW / 2, y, { align: 'center' });
}

export function exportBudgetPdf(params: BudgetExportParams) {
  const { rows, alerts, kpis, companyName = 'OFJR Construction' } = params;
  const dateStr = todayStamp();

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  /* ═══════════════════ PAGE 1 — Cover + KPIs + Chart ═══════════════════ */

  // Header bar
  doc.setFillColor(...PDF_BRAND_DARK);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFillColor(...PDF_BRAND_PRIMARY);
  doc.rect(0, 28, pageW, 3, 'F');

  // Company name
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_WHITE);
  doc.text(companyName.toUpperCase(), margin, 14);

  // Report title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Budget Report', margin, 23);

  // Generated date
  doc.setFontSize(9);
  doc.setTextColor(...PDF_GRAY_TEXT);
  doc.text(`Generated: ${fmtDateTz(new Date().toISOString())}`, margin, 38);

  // ── KPI Cards ──
  const kpiCardW = (pageW - 2 * margin - 3 * 4) / 4;
  const kpiCardH = 24;
  const kpiY = 43;
  const kpiItems = [
    { label: 'Total Budget', value: fmtMoneyPdf(kpis.totalBudget), color: PDF_BRAND_DARK },
    { label: 'Total Consumed', value: fmtMoneyPdf(kpis.totalConsumed), color: PDF_BRAND_PRIMARY },
    { label: 'Total Available', value: fmtMoneyPdf(kpis.totalAvailable), color: PDF_EMERALD },
    { label: 'Critical Projects (>90%)', value: String(kpis.projectsOver90), color: PDF_RED },
  ];

  kpiItems.forEach((kpi, i) => {
    const kx = margin + i * (kpiCardW + 4);
    drawRoundedRect(doc, kx, kpiY, kpiCardW, kpiCardH, 3, PDF_WHITE);
    doc.setDrawColor(220, 220, 230);
    doc.roundedRect(kx, kpiY, kpiCardW, kpiCardH, 3, 3, 'S');

    // Accent line
    doc.setFillColor(...kpi.color);
    doc.rect(kx, kpiY, 3, kpiCardH, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_GRAY_TEXT);
    doc.text(kpi.label, kx + 7, kpiY + 9);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, kx + 7, kpiY + 19);
  });

  // ── Horizontal bar chart — Top projects by consumption % ──
  const chartY = kpiY + kpiCardH + 10;
  const chartH = pageH - chartY - 20;

  const barData = [...rows]
    .sort((a, b) => b.executionPct - a.executionPct)
    .slice(0, 10)
    .map(r => ({ label: r.project, value: r.executionPct }));

  drawHorizontalBarChart(
    doc, margin, chartY, pageW - 2 * margin, chartH,
    barData, 'TOP PROJECTS \u2014 Budget Consumption %',
  );

  addPdfFooter(doc, pageW, pageH, companyName, 1);

  /* ═══════════════════ PAGE 2 — Budget Table ═══════════════════ */
  doc.addPage('a4', 'landscape');
  addPdfPageHeader(doc, pageW, 'Budget Report \u2014 Project Detail', companyName);

  const budgetTableData = rows.map((r, i) => [
    String(i + 1),
    r.project,
    fmtMoneyPdf(r.totalBudget),
    fmtMoneyPdf(r.consumed),
    fmtMoneyPdf(r.available),
    `${r.executionPct.toFixed(1)}%`,
    deviationLabel(r.deviation),
    r.status,
  ]);

  autoTable(doc, {
    startY: 24,
    head: [['#', 'Project', 'Budget', 'Consumed', 'Available', 'Execution %', 'Deviation', 'Status']],
    body: budgetTableData,
    theme: 'grid',
    headStyles: {
      fillColor: PDF_BRAND_DARK,
      textColor: PDF_WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: PDF_BLACK,
    },
    alternateRowStyles: {
      fillColor: PDF_GRAY_BG,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 50 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 },
      5: { halign: 'right', cellWidth: 25 },
      6: { cellWidth: 28 },
      7: { cellWidth: 20 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === 'body') {
        // Color execution % column
        if (data.column.index === 5) {
          const pctStr = String(data.cell.raw).replace('%', '');
          const pct = parseFloat(pctStr);
          if (pct >= 90) data.cell.styles.textColor = PDF_RED;
          else if (pct >= 70) data.cell.styles.textColor = PDF_AMBER;
          else data.cell.styles.textColor = PDF_EMERALD;
          data.cell.styles.fontStyle = 'bold';
        }
        // Color deviation column
        if (data.column.index === 6) {
          const devText = String(data.cell.raw).toLowerCase();
          if (devText.includes('severe')) data.cell.styles.textColor = PDF_RED;
          else if (devText.includes('moderate')) data.cell.styles.textColor = PDF_AMBER;
          else if (devText.includes('on track')) data.cell.styles.textColor = PDF_EMERALD;
          else if (devText.includes('under')) data.cell.styles.textColor = PDF_BRAND_PRIMARY;
          data.cell.styles.fontStyle = 'bold';
        }
        // Color status column
        if (data.column.index === 7) {
          const status = String(data.cell.raw).toLowerCase();
          data.cell.styles.textColor = status === 'active' ? PDF_EMERALD : PDF_GRAY_TEXT;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Add footer to page 2 (and any overflow pages from the table)
  const pagesAfterTable = doc.getNumberOfPages();
  for (let p = 2; p <= pagesAfterTable; p++) {
    doc.setPage(p);
    addPdfFooter(doc, pageW, pageH, companyName, p);
  }

  /* ═══════════════════ PAGE 3 — Alerts Table ═══════════════════ */
  doc.addPage('a4', 'landscape');
  const alertPageNum = doc.getNumberOfPages();
  addPdfPageHeader(doc, pageW, 'Budget Report \u2014 Alerts', companyName);

  const alertTableData = alerts
    .filter(a => a.pct >= 70)
    .map(a => [
      a.project,
      `${a.pct.toFixed(1)}%`,
      a.level.charAt(0).toUpperCase() + a.level.slice(1),
      fmtMoneyPdf(a.remaining),
      a.estimatedDays != null ? String(a.estimatedDays) : 'N/A',
    ]);

  if (alertTableData.length > 0) {
    autoTable(doc, {
      startY: 24,
      head: [['Project', 'Execution %', 'Alert Level', 'Remaining', 'Estimated Days']],
      body: alertTableData,
      theme: 'grid',
      headStyles: {
        fillColor: PDF_BRAND_DARK,
        textColor: PDF_WHITE,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: PDF_BLACK,
      },
      alternateRowStyles: {
        fillColor: PDF_GRAY_BG,
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { halign: 'right', cellWidth: 30 },
        2: { cellWidth: 30 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === 'body') {
          // Color execution % column
          if (data.column.index === 1) {
            const pctStr = String(data.cell.raw).replace('%', '');
            const pct = parseFloat(pctStr);
            data.cell.styles.textColor = pct >= 90 ? PDF_RED : PDF_AMBER;
            data.cell.styles.fontStyle = 'bold';
          }
          // Color alert level cells
          if (data.column.index === 2) {
            const level = String(data.cell.raw).toLowerCase();
            if (level === 'critical') {
              data.cell.styles.textColor = PDF_RED;
              data.cell.styles.fontStyle = 'bold';
            } else if (level === 'warning') {
              data.cell.styles.textColor = PDF_AMBER;
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = PDF_EMERALD;
            }
          }
        }
      },
    });
  } else {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_GRAY_TEXT);
    doc.text('No projects with consumption \u226570%.', margin, 34);
  }

  // Add footer to all alert pages
  const totalPages = doc.getNumberOfPages();
  for (let p = alertPageNum; p <= totalPages; p++) {
    doc.setPage(p);
    addPdfFooter(doc, pageW, pageH, companyName, p);
  }

  doc.save(`Budget_Report_${dateStr}.pdf`);
}
