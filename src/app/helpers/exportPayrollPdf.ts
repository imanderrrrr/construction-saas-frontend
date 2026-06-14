import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { WorkerHoursSummary, HoursReportKpis } from '../services/time';
import { fmtDateTime, fmtDate as fmtDateTz } from './dateTime';
import { unpaidApprovedHours, workerRowPay } from './payroll';

/* ───────────────────────── Brand colours (RGB) ───────────────────────── */
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

/* ───────────────────────── Types ───────────────────────── */
export interface PayrollPdfParams {
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
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function drawRoundedRect(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  r: number, fill: [number, number, number],
) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

/* ───────────────────────── Chart drawing helpers ───────────────────────── */

function drawBarChart(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  data: { label: string; value: number }[],
  title: string,
  valuePrefix = '',
  valueSuffix = '',
) {
  if (data.length === 0) return;

  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_DARK);
  doc.text(title, x, y - 3);

  // Background
  drawRoundedRect(doc, x, y, w, h, 2, WHITE);
  doc.setDrawColor(220, 220, 230);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barAreaX = x + 50;
  const barAreaW = w - 60;
  const barH = Math.min(12, (h - 10) / data.length - 2);
  const startY = y + 8;

  data.slice(0, 10).forEach((d, i) => {
    const bY = startY + i * (barH + 3);
    const bW = (d.value / maxVal) * barAreaW;

    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_TEXT);
    const label = d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label;
    doc.text(label, barAreaX - 3, bY + barH / 2 + 1, { align: 'right' });

    // Bar
    const color: [number, number, number] = i % 2 === 0 ? BRAND_PRIMARY : BRAND_DARK;
    doc.setFillColor(...color);
    doc.roundedRect(barAreaX, bY, Math.max(bW, 2), barH, 1, 1, 'F');

    // Value
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text(`${valuePrefix}${d.value.toFixed(1)}${valueSuffix}`, barAreaX + bW + 3, bY + barH / 2 + 1);
  });
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

    // Draw pie slice using filled triangles approximation
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
    const lbl = d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label;
    doc.text(`${lbl} (${pct}%)`, legendX + 7, legendY + 1);
    legendY += 9;
  });
}

/* ───────────────────────── Main export ───────────────────────── */
export function exportPayrollPdf(params: PayrollPdfParams) {
  const { workers, kpis, dateFrom, dateTo, companyName = 'OFJR Construction', reportTitle, generatedBy } = params;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  /* ═══════════════════ PAGE 1 — Cover + KPIs + Charts ═══════════════════ */

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
  doc.text(reportTitle, margin, 23);

  // Period info
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_TEXT);
  const periodText = `Period: ${dateFrom}  —  ${dateTo}   |   Generated: ${fmtDateTz(new Date().toISOString())}${generatedBy ? `   |   By: ${generatedBy}` : ''}`;
  doc.text(periodText, margin, 38);

  // ── KPI Cards ──
  const kpiCardW = (pageW - 2 * margin - 3 * 4) / 4;
  const kpiCardH = 24;
  const kpiY = 43;
  const kpiItems = [
    { label: 'Total Workers', value: String(workers.length), color: BRAND_DARK },
    { label: 'Approved Hours', value: `${kpis.totalApprovedHours.toFixed(2)} hrs`, color: EMERALD },
    { label: 'Total Payroll', value: fmtMoney(kpis.totalLaborCost), color: BRAND_PRIMARY },
    { label: 'Late Arrivals', value: String(kpis.lateArrivals), color: AMBER },
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

  // ── Charts ──
  const chartY = kpiY + kpiCardH + 10;
  const chartH = pageH - chartY - 20;
  const halfW = (pageW - 2 * margin - 6) / 2;

  // Bar chart — Hours by worker
  const hoursData = workers
    .sort((a, b) => b.totalApprovedHours - a.totalApprovedHours)
    .slice(0, 10)
    .map(w => ({ label: w.workerName ?? w.workerUsername, value: w.totalApprovedHours }));

  drawBarChart(doc, margin, chartY, halfW, chartH, hoursData, 'TOP 10 — Hours by Worker', '', ' hrs');

  // Pie chart — Cost distribution by project
  const projectCosts = new Map<string, number>();
  workers.forEach(w => {
    w.dailyEntries.forEach(e => {
      const hrs = e.totalHours ?? 0;
      const cost = w.hourlyRate != null ? hrs * w.hourlyRate : 0;
      projectCosts.set(e.projectName, (projectCosts.get(e.projectName) ?? 0) + cost);
    });
  });

  const pieColors: [number, number, number][] = [
    BRAND_DARK, BRAND_PRIMARY, EMERALD, AMBER, [99, 102, 241],
    [168, 85, 247], [236, 72, 153], [20, 184, 166], [244, 63, 94], [234, 179, 8],
  ];

  const pieData = Array.from(projectCosts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map((entry, i) => ({
      label: entry[0],
      value: Number(entry[1].toFixed(2)),
      color: pieColors[i % pieColors.length],
    }));

  const pieX = margin + halfW + 6;
  const pieRadius = Math.min(chartH / 2 - 10, 30);
  drawPieChart(doc, pieX + pieRadius + 5, chartY + chartH / 2, pieRadius, pieData, 'Cost Distribution by Project');

  // Footer
  addFooter(doc, pageW, pageH, companyName, 1);

  /* ═══════════════════ PAGE 2 — Payroll Table ═══════════════════ */
  doc.addPage('a4', 'landscape');
  addPageHeader(doc, pageW, reportTitle + ' — Payroll Detail', companyName);

  const tableData = workers.map((w, i) => {
    // Pay only the UNPAID approved hours — totalApprovedHours includes hours
    // already settled in previous runs and would double-pay. Mirrors the screen
    // and makes the rows reconcile with the TOTAL footer (kpis.totalLaborCost).
    const rowPay = workerRowPay(w);
    const pay = rowPay != null ? fmtMoney(rowPay) : 'N/A';
    const projects = [...new Set(w.dailyEntries.map(e => e.projectName))].join(', ');
    return [
      String(i + 1),
      w.workerName ?? w.workerUsername,
      w.workerRole,
      w.hourlyRate != null ? `$${w.hourlyRate.toFixed(2)}` : 'N/A',
      `${unpaidApprovedHours(w).toFixed(2)} hrs`,
      pay,
      projects,
    ];
  });

  autoTable(doc, {
    startY: 24,
    head: [['#', 'Worker', 'Role', 'Hourly Rate', 'Approved Hours', 'Total Pay', 'Projects']],
    body: tableData,
    foot: [['', 'TOTAL', '', '', `${kpis.totalApprovedHours.toFixed(2)} hrs`, fmtMoney(kpis.totalLaborCost), '']],
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
      1: { cellWidth: 45 },
      2: { cellWidth: 25 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 28 },
      6: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      // Highlight N/A rates in amber
      if (data.section === 'body' && data.column.index === 3 && data.cell.raw === 'N/A') {
        data.cell.styles.textColor = AMBER;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  addFooter(doc, pageW, pageH, companyName, 2);

  /* ═══════════════════ PAGE 3 — Daily Detail ═══════════════════ */
  doc.addPage('a4', 'landscape');
  addPageHeader(doc, pageW, reportTitle + ' — Daily Entries', companyName);

  const detailData: string[][] = [];
  workers.forEach(w => {
    w.dailyEntries.forEach((e, eIdx) => {
      detailData.push([
        eIdx === 0 ? (w.workerName ?? w.workerUsername) : '',
        e.date,
        e.projectName,
        e.clockIn ?? '—',
        e.clockOut ?? '—',
        e.lunchMinutes != null ? `${e.lunchMinutes} min` : '—',
        e.transitMinutes != null && e.transitMinutes > 0 ? `${e.transitMinutes} min` : '—',
        e.totalHours != null ? `${e.totalHours.toFixed(2)} hrs` : '—',
        e.approvalStatus,
        e.reviewerName ?? '—',
      ]);
    });
  });

  autoTable(doc, {
    startY: 24,
    head: [['Worker', 'Date', 'Project', 'In', 'Out', 'Lunch', 'Transit', 'Hours', 'Status', 'Reviewer']],
    body: detailData,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_PRIMARY,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: BLACK,
    },
    alternateRowStyles: {
      fillColor: GRAY_BG,
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      8: { cellWidth: 20 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        const s = String(data.cell.raw).toLowerCase();
        if (s === 'approved') data.cell.styles.textColor = EMERALD;
        else if (s === 'pending') data.cell.styles.textColor = AMBER;
        else if (s === 'rejected') data.cell.styles.textColor = RED;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Add footer to all remaining pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 3; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(doc, pageW, pageH, companyName, p);
  }

  doc.save(`${reportTitle.replace(/\s+/g, '_')}_${dateFrom}_${dateTo}.pdf`);
}

/* ───────────────────────── Page helpers ───────────────────────── */

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
