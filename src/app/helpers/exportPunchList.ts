// BuildTrack — Punch-list export (fase 3): CSV + PDF of the INTERNAL punch
// list as currently filtered on screen. Client-side on purpose: the rows are
// already loaded and authorized in the view, so no new endpoint is needed.
// CSV follows exportAuditCsv (escaped fields + BOM + saveAs); PDF follows
// exportExpenseReport (jsPDF landscape + autoTable + brand header/footer).
// All human-readable labels arrive pre-translated from the component so the
// files come out in the user's language.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { fmtDate, fmtDateTime, todayStamp } from './dateTime';
import type { PunchItem, PunchItemOrigin, PunchItemStatus } from '../services/punchItems';

/* ───────────────────────── Brand colours (exportExpenseReport palette) ───────────────────────── */
const BRAND_DARK: [number, number, number] = [8, 59, 109];
const BRAND_PRIMARY: [number, number, number] = [11, 130, 199];
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_BG: [number, number, number] = [245, 247, 250];
const GRAY_TEXT: [number, number, number] = [139, 148, 158];
const BLACK: [number, number, number] = [11, 15, 22];

/* ───────────────────────── Params ───────────────────────── */

/** Pre-translated strings — pass them from the component via t(). */
export interface PunchListExportLabels {
  /** Document title, e.g. "Punch list". */
  docTitle: string;
  /** One line describing what's exported, e.g. "Casa Roble · Todos · 12 ítems". */
  filterLine: string;
  columns: {
    number: string;
    title: string;
    status: string;
    origin: string;
    assignee: string;
    location: string;
    createdAt: string;
    readyAt: string;
    closedAt: string;
    resolution: string;
  };
  status: Record<PunchItemStatus, string>;
  origin: Record<PunchItemOrigin, string>;
}

export interface PunchListExportParams {
  items: PunchItem[];
  projectName: string;
  labels: PunchListExportLabels;
  companyName?: string;
}

/* ───────────────────────── Shared row shape ───────────────────────── */

function headerRow(labels: PunchListExportLabels): string[] {
  const c = labels.columns;
  return [
    c.number, c.title, c.status, c.origin, c.assignee,
    c.location, c.createdAt, c.readyAt, c.closedAt, c.resolution,
  ];
}

function itemToRow(item: PunchItem, labels: PunchListExportLabels): string[] {
  return [
    item.displayNumber,
    item.title,
    labels.status[item.status],
    labels.origin[item.origin],
    item.assigneeName ?? '—',
    item.location ?? '',
    fmtDate(item.createdAt),
    item.readyAt ? fmtDate(item.readyAt) : '',
    item.closedAt ? fmtDate(item.closedAt) : '',
    item.closeNote ?? '',
  ];
}

function baseFilename(projectName: string): string {
  const slug = projectName.trim().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'Project';
  return `Punch_List_${slug}_${todayStamp()}`;
}

/* ───────────────────────── CSV ───────────────────────── */

/** Escape a value for CSV: wrap in quotes if it contains commas, quotes, or newlines. */
function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportPunchListCsv(params: PunchListExportParams): void {
  const { items, projectName, labels } = params;
  const lines: string[] = [];
  lines.push(headerRow(labels).map(escapeCsvField).join(','));
  for (const item of items) {
    lines.push(itemToRow(item, labels).map(escapeCsvField).join(','));
  }
  const csvContent = lines.join('\r\n');
  // BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${baseFilename(projectName)}.csv`);
}

/* ───────────────────────── PDF ───────────────────────── */

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

export function exportPunchListPdf(params: PunchListExportParams): void {
  const { items, projectName, labels, companyName = 'BuildTrack' } = params;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  addPageHeader(doc, pageW, `${labels.docTitle} — ${projectName}`, companyName);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_TEXT);
  doc.text(labels.filterLine, margin, 26);

  autoTable(doc, {
    startY: 30,
    head: [headerRow(labels)],
    body: items.map((item) => itemToRow(item, labels)),
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
    },
    bodyStyles: { fontSize: 7.5, textColor: BLACK, valign: 'top' },
    alternateRowStyles: { fillColor: GRAY_BG },
    columnStyles: {
      0: { cellWidth: 13, halign: 'right' }, // number
      1: { cellWidth: 52 },                  // title
      2: { cellWidth: 26 },                  // status
      3: { cellWidth: 20 },                  // origin
      4: { cellWidth: 30 },                  // assignee
      5: { cellWidth: 30 },                  // location
      6: { cellWidth: 20 },                  // created
      7: { cellWidth: 20 },                  // ready
      8: { cellWidth: 20 },                  // closed
      // 9 (resolution) flexes into the remaining width
    },
    margin: { left: margin, right: margin, top: 24 },
    didDrawPage: () => {
      // Repeated header on table page-breaks (footer numbering added below).
      if (doc.getNumberOfPages() > 1) {
        addPageHeader(doc, pageW, `${labels.docTitle} — ${projectName}`, companyName);
      }
    },
  });

  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    addFooter(doc, pageW, pageH, companyName, p);
  }

  doc.save(`${baseFilename(projectName)}.pdf`);
}
