import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/* ───────────────────────── Types ───────────────────────── */
export interface AuditEvent {
  id: number;
  actorUserId: number | null;
  actorUsername: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  outcome: string; // SUCCESS | FAILURE | WARNING
  message: string;
  metadata: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  createdAt: string; // ISO-8601
}

/* ───────────────────────── Brand colours ───────────────────────── */
const BRAND_DARK    = '083B6D';
const BRAND_PRIMARY = '0B82C7';
const WHITE         = 'FFFFFF';
const GRAY_BG       = 'F5F7FA';
const GRAY_TEXT     = '8B949E';
const BLACK         = '0B0F16';
const EMERALD       = '059669';
const RED           = 'DC2626';
const AMBER         = 'D97706';

/* ───────────────────────── Helpers ───────────────────────── */
import { todayStamp, fmtDateTime } from './dateTime';

function formatTimestamp(iso: string): string {
  try { return fmtDateTime(iso); } catch { return iso; }
}

/** Escape a value for CSV: wrap in quotes if it contains commas, quotes, or newlines. */
function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function borderStyle(): Partial<ExcelJS.Borders> {
  const thin: ExcelJS.BorderStyle = 'thin';
  return {
    top:    { style: thin, color: { argb: 'D6DCE3' } },
    bottom: { style: thin, color: { argb: 'D6DCE3' } },
    left:   { style: thin, color: { argb: 'D6DCE3' } },
    right:  { style: thin, color: { argb: 'D6DCE3' } },
  };
}

function outcomeColor(outcome: string): string {
  switch (outcome.toUpperCase()) {
    case 'SUCCESS': return EMERALD;
    case 'FAILURE': return RED;
    case 'WARNING': return AMBER;
    default:        return BLACK;
  }
}

/* ───────────────────────── CSV columns ───────────────────────── */
const CSV_HEADERS = ['ID', 'Timestamp', 'Actor', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Outcome', 'Message', 'IP Address', 'Correlation ID'];

function eventToRow(e: AuditEvent): string[] {
  return [
    String(e.id),
    formatTimestamp(e.createdAt),
    e.actorUsername ?? '',
    e.actorRole ?? '',
    e.action,
    e.entityType ?? '',
    e.entityId ?? '',
    e.outcome,
    e.message,
    e.ipAddress ?? '',
    e.correlationId ?? '',
  ];
}

/* ───────────────────────── CSV Export ───────────────────────── */
export function exportAuditCsv(events: AuditEvent[], filename?: string): void {
  const lines: string[] = [];

  // Header row
  lines.push(CSV_HEADERS.map(escapeCsvField).join(','));

  // Data rows
  for (const event of events) {
    lines.push(eventToRow(event).map(escapeCsvField).join(','));
  }

  const csvContent = lines.join('\r\n');
  // BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  const name = filename ?? `Audit_Log_${todayStamp()}.csv`;
  saveAs(blob, name);
}

/* ───────────────────────── Excel Export ───────────────────────── */
export async function exportAuditExcel(events: AuditEvent[], filename?: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OFJR Construction';
  wb.created = new Date();

  const ws = wb.addWorksheet('Audit Log', {
    properties: { defaultColWidth: 16 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  /* ── Column widths ── */
  ws.columns = [
    { width: 8 },   // A: ID
    { width: 22 },  // B: Timestamp
    { width: 18 },  // C: Actor
    { width: 14 },  // D: Role
    { width: 22 },  // E: Action
    { width: 16 },  // F: Entity Type
    { width: 14 },  // G: Entity ID
    { width: 12 },  // H: Outcome
    { width: 40 },  // I: Message
    { width: 16 },  // J: IP Address
    { width: 28 },  // K: Correlation ID
  ];

  const colCount = CSV_HEADERS.length; // 11
  const lastCol = String.fromCharCode(64 + colCount); // 'K'

  /* ── Header banner — Row 1: Company ── */
  ws.mergeCells(`A1:${lastCol}1`);
  const headerRow = ws.getRow(1);
  headerRow.height = 40;
  headerRow.getCell(1).value = 'OFJR CONSTRUCTION';
  headerRow.getCell(1).font = { name: 'Calibri', size: 18, bold: true, color: { argb: WHITE } };
  headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DARK } };
  headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  /* ── Header banner — Row 2: Title ── */
  ws.mergeCells(`A2:${lastCol}2`);
  const subtitleRow = ws.getRow(2);
  subtitleRow.height = 28;
  subtitleRow.getCell(1).value = 'Audit Log Export';
  subtitleRow.getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: WHITE } };
  subtitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_PRIMARY } };
  subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  /* ── Header banner — Row 3: Date ── */
  ws.mergeCells(`A3:${lastCol}3`);
  const periodRow = ws.getRow(3);
  periodRow.height = 22;
  periodRow.getCell(1).value = `Generated: ${fmtDateTime(new Date().toISOString())}   |   ${events.length} event${events.length !== 1 ? 's' : ''}`;
  periodRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: GRAY_TEXT } };
  periodRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } };
  periodRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  /* ── Table header — Row 5 ── */
  const tableStartRow = 5;
  const hRow = ws.getRow(tableStartRow);
  hRow.height = 26;
  CSV_HEADERS.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_DARK } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = borderStyle();
  });

  /* ── Data rows ── */
  events.forEach((event, idx) => {
    const r = ws.getRow(tableStartRow + 1 + idx);
    const values = eventToRow(event);
    const isEven = idx % 2 === 0;
    const bgColor = isEven ? WHITE : GRAY_BG;

    values.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      // Use the numeric ID for the first column
      cell.value = i === 0 ? event.id : v;
      cell.font = { name: 'Calibri', size: 10, color: { argb: BLACK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = borderStyle();
      cell.alignment = { vertical: 'middle', wrapText: i === 8 }; // wrap Message column

      // Outcome column gets status coloring
      if (i === 7) {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: outcomeColor(v) } };
      }
    });
  });

  /* ── Auto-width: widen columns if content is longer than default ── */
  ws.columns.forEach((col, colIdx) => {
    const defaultWidth = (col.width as number) ?? 16;
    let maxLen = CSV_HEADERS[colIdx]?.length ?? 10;
    events.forEach(event => {
      const val = eventToRow(event)[colIdx] ?? '';
      // Only measure first line for multi-line content
      const lineLen = val.split('\n')[0].length;
      if (lineLen > maxLen) maxLen = lineLen;
    });
    const computed = Math.min(maxLen + 4, 60);
    col.width = Math.max(defaultWidth, computed);
  });

  /* ── Save ── */
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const name = filename ?? `Audit_Log_${todayStamp()}.xlsx`;
  saveAs(blob, name);
}
