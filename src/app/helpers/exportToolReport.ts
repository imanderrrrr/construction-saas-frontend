import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ───────────────────────── Brand colours (Excel hex) ───────────────────────── */
const BRAND_DARK   = '083B6D';
const BRAND_PRIMARY = '0B82C7';
const WHITE        = 'FFFFFF';
const GRAY_BG      = 'F5F7FA';
const GRAY_TEXT    = '8B949E';
const BLACK        = '0B0F16';
const EMERALD      = '059669';
const AMBER        = 'D97706';
const RED_HEX      = 'DC2626';

/* ───────────────────────── Brand colours (PDF RGB) ───────────────────────── */
const PDF_BRAND_DARK: [number, number, number]   = [8, 59, 109];
const PDF_BRAND_PRIMARY: [number, number, number] = [11, 130, 199];
const PDF_WHITE: [number, number, number]        = [255, 255, 255];
const PDF_GRAY_BG: [number, number, number]      = [245, 247, 250];
const PDF_GRAY_TEXT: [number, number, number]    = [139, 148, 158];
const PDF_BLACK: [number, number, number]        = [11, 15, 22];
const PDF_EMERALD: [number, number, number]      = [5, 150, 105];
const PDF_AMBER: [number, number, number]        = [217, 119, 6];
const PDF_RED: [number, number, number]          = [220, 38, 38];

/* ───────────────────────── Types ───────────────────────── */
export interface ToolStatusRow {
  status: string;    // Available, Assigned, In Review, Damaged, Lost
  count: number;
  pct: number;
}

export interface ToolCategoryRow {
  category: string;
  total: number;
  available: number;
  assigned: number;
  other: string;
  utilization: number;  // percentage
}

export interface ConsumableCategoryRow {
  category: string;
  total: number;
  totalStock: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export interface ToolExportParams {
  statusBreakdown: ToolStatusRow[];
  categoryBreakdown: ToolCategoryRow[];
  consumableBreakdown: ConsumableCategoryRow[];
  kpis: { totalTools: number; utilization: string; avgDaysOut: string; needsAttention: number };
  companyName?: string;
}

/* ───────────────────────── Excel Helpers ───────────────────────── */
function borderStyle(): Partial<ExcelJS.Borders> {
  const thin: ExcelJS.BorderStyle = 'thin';
  return {
    top: { style: thin, color: { argb: 'D6DCE3' } },
    bottom: { style: thin, color: { argb: 'D6DCE3' } },
    left: { style: thin, color: { argb: 'D6DCE3' } },
    right: { style: thin, color: { argb: 'D6DCE3' } },
  };
}

import { todayStamp, fmtDateTime, fmtDate as fmtDateTz } from './dateTime';

function formatDate(): string {
  return todayStamp();
}

/* ───────────────────────── PDF Helpers ───────────────────────── */
function drawRoundedRect(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  r: number, fill: [number, number, number],
) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

function addPageHeader(doc: jsPDF, pageW: number, title: string, companyName: string) {
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

function addFooter(doc: jsPDF, pageW: number, pageH: number, companyName: string, pageNum: number) {
  const y = pageH - 8;
  doc.setDrawColor(...PDF_GRAY_BG);
  doc.setLineWidth(0.3);
  doc.line(12, y - 2, pageW - 12, y - 2);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_GRAY_TEXT);
  doc.text(`${companyName} — Confidential`, 12, y);
  doc.text(`Page ${pageNum}`, pageW - 12, y, { align: 'right' });
  doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, pageW / 2, y, { align: 'center' });
}

/* ═══════════════════════════════════════════════════════════════════
   EXCEL EXPORT
   ═══════════════════════════════════════════════════════════════════ */
export async function exportToolExcel(params: ToolExportParams) {
  const {
    statusBreakdown, categoryBreakdown, consumableBreakdown,
    kpis, companyName = 'OFJR Construction',
  } = params;

  const wb = new ExcelJS.Workbook();
  wb.creator = companyName;
  wb.created = new Date();
  const date = formatDate();

  /* ═══════════════════ SHEET 1 — Tool Summary ═══════════════════ */
  const ws = wb.addWorksheet('Tool Summary', {
    properties: { defaultColWidth: 16 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  ws.columns = [
    { width: 6 },   // A: #
    { width: 24 },  // B: Status / Category
    { width: 14 },  // C: Count / Total
    { width: 14 },  // D: Percentage / Available
    { width: 14 },  // E: Assigned
    { width: 18 },  // F: Other
    { width: 16 },  // G: Utilization %
  ];

  // ── Header banner ──
  ws.mergeCells('A1:G1');
  const headerRow = ws.getRow(1);
  headerRow.height = 40;
  headerRow.getCell(1).value = companyName.toUpperCase();
  headerRow.getCell(1).font = { name: 'Calibri', size: 18, bold: true, color: { argb: WHITE } };
  headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DARK } };
  headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('A2:G2');
  const subtitleRow = ws.getRow(2);
  subtitleRow.height = 28;
  subtitleRow.getCell(1).value = 'Tool & Inventory Report';
  subtitleRow.getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: WHITE } };
  subtitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_PRIMARY } };
  subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('A3:G3');
  const periodRow = ws.getRow(3);
  periodRow.height = 22;
  periodRow.getCell(1).value = `Generated: ${fmtDateTz(new Date().toISOString())}`;
  periodRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: GRAY_TEXT } };
  periodRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } };
  periodRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // ── KPI section ──
  ws.mergeCells('A5:B5');
  ws.getCell('A5').value = 'KEY METRICS';
  ws.getCell('A5').font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND_DARK } };

  const kpiData: [string, string][] = [
    ['Total Tools', String(kpis.totalTools)],
    ['Utilization Rate', kpis.utilization],
    ['Avg Days Out', kpis.avgDaysOut],
    ['Needs Attention', String(kpis.needsAttention)],
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

  // ── Status Breakdown table ──
  const statusStartRow = 6 + kpiData.length + 2;
  ws.mergeCells(`A${statusStartRow - 1}:D${statusStartRow - 1}`);
  ws.getCell(`A${statusStartRow - 1}`).value = 'STATUS BREAKDOWN';
  ws.getCell(`A${statusStartRow - 1}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND_DARK } };

  const statusHeaders = ['#', 'Status', 'Count', 'Percentage'];
  const shRow = ws.getRow(statusStartRow);
  shRow.height = 26;
  statusHeaders.forEach((h, i) => {
    const cell = shRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DARK } };
    cell.alignment = { vertical: 'middle', horizontal: i >= 2 ? 'right' : 'left' };
    cell.border = borderStyle();
  });

  statusBreakdown.forEach((s, idx) => {
    const r = ws.getRow(statusStartRow + 1 + idx);
    const isEven = idx % 2 === 0;
    const bgColor = isEven ? WHITE : GRAY_BG;

    const values: (string | number)[] = [idx + 1, s.status, s.count, `${s.pct.toFixed(1)}%`];
    values.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { name: 'Calibri', size: 10, color: { argb: BLACK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = borderStyle();
      if (i >= 2) cell.alignment = { horizontal: 'right' };
      // Color-code statuses
      if (i === 1) {
        const st = s.status.toLowerCase();
        if (st === 'available') cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EMERALD } };
        else if (st === 'damaged' || st === 'lost') cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: RED_HEX } };
        else if (st === 'in review') cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: AMBER } };
      }
    });
  });

  // ── Category Breakdown table ──
  const catStartRow = statusStartRow + 1 + statusBreakdown.length + 2;
  ws.mergeCells(`A${catStartRow - 1}:G${catStartRow - 1}`);
  ws.getCell(`A${catStartRow - 1}`).value = 'CATEGORY BREAKDOWN';
  ws.getCell(`A${catStartRow - 1}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND_DARK } };

  const catHeaders = ['#', 'Category', 'Total', 'Available', 'Assigned', 'Other', 'Utilization %'];
  const chRow = ws.getRow(catStartRow);
  chRow.height = 26;
  catHeaders.forEach((h, i) => {
    const cell = chRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DARK } };
    cell.alignment = { vertical: 'middle', horizontal: i >= 2 ? 'right' : 'left' };
    cell.border = borderStyle();
  });

  categoryBreakdown.forEach((c, idx) => {
    const r = ws.getRow(catStartRow + 1 + idx);
    const isEven = idx % 2 === 0;
    const bgColor = isEven ? WHITE : GRAY_BG;

    const values: (string | number)[] = [
      idx + 1, c.category, c.total, c.available, c.assigned, c.other, `${c.utilization.toFixed(1)}%`,
    ];
    values.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { name: 'Calibri', size: 10, color: { argb: BLACK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = borderStyle();
      if (i >= 2) cell.alignment = { horizontal: 'right' };
      // Color-code utilization
      if (i === 6) {
        const util = c.utilization;
        if (util >= 80) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: RED_HEX } };
        else if (util >= 50) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: AMBER } };
        else cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EMERALD } };
      }
    });
  });

  /* ═══════════════════ SHEET 2 — Consumables ═══════════════════ */
  const wsC = wb.addWorksheet('Consumables', {
    properties: { defaultColWidth: 16 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  wsC.columns = [
    { width: 6 },   // A: #
    { width: 26 },  // B: Category
    { width: 12 },  // C: Items
    { width: 14 },  // D: Total Stock
    { width: 14 },  // E: In Stock
    { width: 14 },  // F: Low Stock
    { width: 14 },  // G: Out of Stock
  ];

  // ── Header banner ──
  wsC.mergeCells('A1:G1');
  const cHeaderRow = wsC.getRow(1);
  cHeaderRow.height = 36;
  cHeaderRow.getCell(1).value = 'Consumables Inventory';
  cHeaderRow.getCell(1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: WHITE } };
  cHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DARK } };
  cHeaderRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  wsC.mergeCells('A2:G2');
  const cSubRow = wsC.getRow(2);
  cSubRow.height = 22;
  cSubRow.getCell(1).value = `Generated: ${fmtDateTz(new Date().toISOString())}`;
  cSubRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: GRAY_TEXT } };
  cSubRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } };
  cSubRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // ── Table header ──
  const consHeaders = ['#', 'Category', 'Items', 'Total Stock', 'In Stock', 'Low Stock', 'Out of Stock'];
  const consHRow = wsC.getRow(4);
  consHRow.height = 26;
  consHeaders.forEach((h, i) => {
    const cell = consHRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DARK } };
    cell.alignment = { vertical: 'middle', horizontal: i >= 2 ? 'right' : 'left' };
    cell.border = borderStyle();
  });

  consumableBreakdown.forEach((c, idx) => {
    const r = wsC.getRow(5 + idx);
    const isEven = idx % 2 === 0;
    const bgColor = isEven ? WHITE : GRAY_BG;

    const values: (string | number)[] = [
      idx + 1, c.category, c.total, c.totalStock, c.inStock, c.lowStock, c.outOfStock,
    ];
    values.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { name: 'Calibri', size: 10, color: { argb: BLACK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = borderStyle();
      if (i >= 2) cell.alignment = { horizontal: 'right' };
      // Color-code low stock in amber
      if (i === 5 && typeof v === 'number' && v > 0) {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: AMBER } };
      }
      // Color-code out of stock in red
      if (i === 6 && typeof v === 'number' && v > 0) {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: RED_HEX } };
      }
    });
  });

  // ── Totals row ──
  const totalRowNum = 5 + consumableBreakdown.length;
  const cTotalRow = wsC.getRow(totalRowNum);
  cTotalRow.height = 28;
  wsC.mergeCells(`A${totalRowNum}:B${totalRowNum}`);
  cTotalRow.getCell(1).value = 'TOTAL';
  cTotalRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
  cTotalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_PRIMARY } };
  cTotalRow.getCell(1).alignment = { vertical: 'middle' };

  const sumItems = consumableBreakdown.reduce((s, c) => s + c.total, 0);
  const sumStock = consumableBreakdown.reduce((s, c) => s + c.totalStock, 0);
  const sumIn = consumableBreakdown.reduce((s, c) => s + c.inStock, 0);
  const sumLow = consumableBreakdown.reduce((s, c) => s + c.lowStock, 0);
  const sumOut = consumableBreakdown.reduce((s, c) => s + c.outOfStock, 0);
  const totals = [sumItems, sumStock, sumIn, sumLow, sumOut];

  for (let col = 3; col <= 7; col++) {
    const cell = cTotalRow.getCell(col);
    cell.value = totals[col - 3];
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_PRIMARY } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    cell.border = borderStyle();
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  }

  /* ═══════════════════ Save ═══════════════════ */
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Tool_Report_${date}.xlsx`);
}

/* ═══════════════════════════════════════════════════════════════════
   PDF EXPORT
   ═══════════════════════════════════════════════════════════════════ */
export function exportToolPdf(params: ToolExportParams) {
  const {
    statusBreakdown, categoryBreakdown, consumableBreakdown,
    kpis, companyName = 'OFJR Construction',
  } = params;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const date = formatDate();

  /* ═══════════════════ PAGE 1 — Cover + KPIs + Charts ═══════════════════ */

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
  doc.text('Tool & Inventory Report', margin, 23);

  // Generated info
  doc.setFontSize(9);
  doc.setTextColor(...PDF_GRAY_TEXT);
  doc.text(`Generated: ${fmtDateTz(new Date().toISOString())}`, margin, 38);

  // ── KPI Cards ──
  const kpiCardW = (pageW - 2 * margin - 3 * 4) / 4;
  const kpiCardH = 24;
  const kpiY = 43;
  const kpiItems = [
    { label: 'Total Tools', value: String(kpis.totalTools), color: PDF_BRAND_DARK },
    { label: 'Utilization Rate', value: kpis.utilization, color: PDF_EMERALD },
    { label: 'Avg Days Out', value: kpis.avgDaysOut, color: PDF_BRAND_PRIMARY },
    { label: 'Needs Attention', value: String(kpis.needsAttention), color: kpis.needsAttention > 0 ? PDF_RED : PDF_EMERALD },
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

  // ── Charts area ──
  const chartY = kpiY + kpiCardH + 10;
  const halfW = (pageW - 2 * margin - 6) / 2;
  const chartH = pageH - chartY - 20;

  // Pie chart — Status breakdown
  drawStatusPieChart(doc, margin, chartY, halfW, chartH, statusBreakdown);

  // Bar chart — Category utilization
  drawUtilizationBarChart(doc, margin + halfW + 6, chartY, halfW, chartH, categoryBreakdown);

  addFooter(doc, pageW, pageH, companyName, 1);

  /* ═══════════════════ PAGE 2 — Category Breakdown Table ═══════════════════ */
  doc.addPage('a4', 'landscape');
  addPageHeader(doc, pageW, 'Tool & Inventory Report — Category Breakdown', companyName);

  const catTableData = categoryBreakdown.map((c, i) => [
    String(i + 1),
    c.category,
    String(c.total),
    String(c.available),
    String(c.assigned),
    c.other,
    `${c.utilization.toFixed(1)}%`,
  ]);

  autoTable(doc, {
    startY: 24,
    head: [['#', 'Category', 'Total', 'Available', 'Assigned', 'Other', 'Utilization %']],
    body: catTableData,
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
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 50 },
      2: { halign: 'right', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
      5: { cellWidth: 'auto' },
      6: { halign: 'right', cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const raw = String(data.cell.raw).replace('%', '');
        const util = parseFloat(raw);
        if (!isNaN(util)) {
          if (util >= 80) data.cell.styles.textColor = PDF_RED;
          else if (util >= 50) data.cell.styles.textColor = PDF_AMBER;
          else data.cell.styles.textColor = PDF_EMERALD;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  addFooter(doc, pageW, pageH, companyName, 2);

  /* ═══════════════════ PAGE 3 — Consumables Table ═══════════════════ */
  doc.addPage('a4', 'landscape');
  addPageHeader(doc, pageW, 'Tool & Inventory Report — Consumables', companyName);

  const consTableData = consumableBreakdown.map((c, i) => [
    String(i + 1),
    c.category,
    String(c.total),
    String(c.totalStock),
    String(c.inStock),
    String(c.lowStock),
    String(c.outOfStock),
  ]);

  autoTable(doc, {
    startY: 24,
    head: [['#', 'Category', 'Items', 'Total Stock', 'In Stock', 'Low Stock', 'Out of Stock']],
    body: consTableData,
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
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 55 },
      2: { halign: 'right', cellWidth: 22 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 28 },
      6: { halign: 'right', cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === 'body') {
        // Low stock in amber
        if (data.column.index === 5) {
          const val = parseInt(String(data.cell.raw), 10);
          if (!isNaN(val) && val > 0) {
            data.cell.styles.textColor = PDF_AMBER;
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Out of stock in red
        if (data.column.index === 6) {
          const val = parseInt(String(data.cell.raw), 10);
          if (!isNaN(val) && val > 0) {
            data.cell.styles.textColor = PDF_RED;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    },
  });

  // Add footer to all remaining pages (autoTable may have added extra pages)
  const totalPages = doc.getNumberOfPages();
  for (let p = 3; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(doc, pageW, pageH, companyName, p);
  }

  doc.save(`Tool_Report_${date}.pdf`);
}

/* ───────────────────────── Chart helpers for PDF ───────────────────────── */

function drawStatusPieChart(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  data: ToolStatusRow[],
) {
  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_BRAND_DARK);
  doc.text('Status Breakdown', x, y - 3);

  // Background card
  drawRoundedRect(doc, x, y, w, h, 2, PDF_WHITE);
  doc.setDrawColor(220, 220, 230);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');

  if (data.length === 0) return;

  const statusColors: Record<string, [number, number, number]> = {
    available: PDF_EMERALD,
    assigned: PDF_BRAND_PRIMARY,
    'in review': PDF_AMBER,
    damaged: PDF_RED,
    lost: [100, 100, 100],
  };

  const pieData = data.map(d => ({
    label: d.status,
    value: d.count,
    color: statusColors[d.status.toLowerCase()] ?? PDF_BRAND_DARK,
  }));

  const total = pieData.reduce((s, d) => s + d.value, 0);
  if (total === 0) return;

  const radius = Math.min(h / 2 - 12, w / 4 - 5);
  const cx = x + radius + 10;
  const cy = y + h / 2;

  let startAngle = -Math.PI / 2;
  pieData.forEach(d => {
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
  const legendX = cx + radius + 10;
  let legendY = cy - radius + 5;
  pieData.forEach(d => {
    doc.setFillColor(...d.color);
    doc.rect(legendX, legendY - 3, 5, 5, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_BLACK);
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
    const lbl = d.label.length > 16 ? d.label.slice(0, 15) + '...' : d.label;
    doc.text(`${lbl} (${pct}%)`, legendX + 7, legendY + 1);
    legendY += 9;
  });
}

function drawUtilizationBarChart(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  data: ToolCategoryRow[],
) {
  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_BRAND_DARK);
  doc.text('Category Utilization', x, y - 3);

  // Background card
  drawRoundedRect(doc, x, y, w, h, 2, PDF_WHITE);
  doc.setDrawColor(220, 220, 230);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');

  if (data.length === 0) return;

  const maxVal = 100; // utilization is a percentage, max 100
  const barAreaX = x + 50;
  const barAreaW = w - 65;
  const barH = Math.min(12, (h - 10) / data.length - 2);
  const startY = y + 8;

  data.slice(0, 10).forEach((d, i) => {
    const bY = startY + i * (barH + 3);
    const bW = (d.utilization / maxVal) * barAreaW;

    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_GRAY_TEXT);
    const label = d.category.length > 14 ? d.category.slice(0, 13) + '...' : d.category;
    doc.text(label, barAreaX - 3, bY + barH / 2 + 1, { align: 'right' });

    // Bar color based on utilization
    let color: [number, number, number];
    if (d.utilization >= 80) color = PDF_RED;
    else if (d.utilization >= 50) color = PDF_AMBER;
    else color = PDF_EMERALD;

    doc.setFillColor(...color);
    doc.roundedRect(barAreaX, bY, Math.max(bW, 2), barH, 1, 1, 'F');

    // Value
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_BLACK);
    doc.text(`${d.utilization.toFixed(1)}%`, barAreaX + bW + 3, bY + barH / 2 + 1);
  });
}
