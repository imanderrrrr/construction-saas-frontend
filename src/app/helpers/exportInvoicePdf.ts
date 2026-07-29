import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ───────────────────────── Brand colours (RGB) ───────────────────────── */
const BRAND_DARK: [number, number, number] = [8, 59, 109];
const BRAND_PRIMARY: [number, number, number] = [11, 130, 199];
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_TEXT: [number, number, number] = [139, 148, 158];
const BLACK: [number, number, number] = [11, 15, 22];
const BORDER_GRAY: [number, number, number] = [200, 205, 212];

/* ───────────────────────── Types ───────────────────────── */

export interface InvoiceLineItemPdf {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type PdfDocumentType = 'INVOICE' | 'CHANGE_ORDER_REQUEST';

export interface InvoicePdfData {
  /** Defaults to 'INVOICE' if omitted, preserving prior behaviour. */
  documentType?: PdfDocumentType;
  invoiceNumber: string;
  client: string;
  project: string;
  description?: string | null;
  issuedDate: string;
  dueDate: string;
  lineItems: InvoiceLineItemPdf[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  amount: number;
  notes?: string | null;
}

/**
 * Issuer block printed in the PDF header — the tenant's "invoice template"
 * configured once in Configuración → Plantilla de factura (see the
 * invoiceBranding service, which loads it). When omitted/undefined the
 * legacy hardcoded [COMPANY] header is used, so tenants that never
 * configured a template keep today's PDFs unchanged.
 */
export interface InvoiceIssuerPdf {
  name?: string | null;
  contact?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /** PNG/JPEG data URL; drawn in place of the legacy vector logo. */
  logoDataUrl?: string | null;
}

/* ───────────────────────── Company info (legacy fallback) ───────────────────────── */
const COMPANY = {
  name: 'OFJR Construction LLC',
  contact: 'Oscar Figueroa',
  address: '5601 Hicks Lane, Oklahoma City, Oklahoma, EE. UU.',
  phone: '4056986131',
  email: 'ofjrconstruction@gmail.com',
};

/* ───────────────────────── Helpers ───────────────────────── */

function fmtMoney(n: number): string {
  return `$${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function fmtMoneySign(n: number): string {
  if (n < 0) return `-${fmtMoney(n)}`;
  return fmtMoney(n);
}

function fmtDateDisplay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/* ───────────────────────── Logo drawing ───────────────────────── */

function drawCompanyLogo(doc: jsPDF, x: number, y: number, size: number) {
  // Draw a simplified OFJR Construction logo placeholder
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;

  // Outer circle
  doc.setFillColor(240, 245, 250);
  doc.setDrawColor(...BRAND_DARK);
  doc.setLineWidth(0.8);
  doc.circle(cx, cy, r, 'FD');

  // Inner building icon — simplified version
  const bx = cx - r * 0.5;
  const bw = r * 1;
  const bh = r * 1.1;
  const by = cy - bh * 0.4;

  // Building body
  doc.setFillColor(...BRAND_DARK);
  doc.rect(bx + bw * 0.15, by, bw * 0.7, bh, 'F');

  // White window lines
  doc.setFillColor(...WHITE);
  const windowH = bh * 0.08;
  const windowGap = bh * 0.16;
  for (let i = 0; i < 4; i++) {
    const wy = by + bh * 0.12 + i * windowGap;
    doc.rect(bx + bw * 0.25, wy, bw * 0.2, windowH, 'F');
    doc.rect(bx + bw * 0.55, wy, bw * 0.2, windowH, 'F');
  }

  // Text below circle
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_DARK);
  doc.text('OFJR', cx, cy + r + 3.5, { align: 'center' });
  doc.setFontSize(3.8);
  doc.setFont('helvetica', 'normal');
  doc.text('CONSTRUCTION LLC', cx, cy + r + 6, { align: 'center' });
}

/**
 * Draw the tenant's uploaded logo (PNG/JPEG data URL) aspect-fitted and
 * centered inside a `box`-sized square. A corrupt/unreadable image skips the
 * logo rather than break invoice generation.
 */
function drawLogoImage(doc: jsPDF, dataUrl: string, x: number, y: number, box: number) {
  try {
    const props = doc.getImageProperties(dataUrl);
    const scale = Math.min(box / props.width, box / props.height);
    const w = props.width * scale;
    const h = props.height * scale;
    doc.addImage(dataUrl, props.fileType, x + (box - w) / 2, y + (box - h) / 2, w, h);
  } catch {
    // Bad image data: render the invoice without a logo.
  }
}

/* ───────────────────────── Main export ───────────────────────── */

export function generateInvoicePdf(data: InvoicePdfData, issuer?: InvoiceIssuerPdf): { blob: Blob; filename: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;

  let y = 18;

  /* ═══════════════════ Header ═══════════════════ */

  // Issuer block: the tenant's configured template, or the legacy hardcoded
  // COMPANY block (incl. its vector logo) when no template exists.
  if (issuer?.logoDataUrl) {
    drawLogoImage(doc, issuer.logoDataUrl, margin, y - 2, 18);
  } else if (!issuer) {
    drawCompanyLogo(doc, margin, y - 2, 18);
  }

  const issuerName = issuer ? (issuer.name ?? '') : COMPANY.name;
  const issuerLines = issuer
    ? [issuer.contact, issuer.address, issuer.phone, issuer.email]
        .filter((line): line is string => Boolean(line && line.trim()))
    : [COMPANY.contact, COMPANY.address, COMPANY.phone, COMPANY.email];

  // Company name & info (to the right of logo)
  const infoX = margin + 24;
  if (issuerName) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text(issuerName, infoX, y + 4);
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_TEXT);
  issuerLines.forEach((line, i) => {
    doc.text(line, infoX, y + 10 + i * 4.5);
  });

  // BILL TO (right side)
  const billX = pageW - margin;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_TEXT);
  doc.text('BILL TO', billX, y, { align: 'right' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  doc.text(data.client, billX, y + 6, { align: 'right' });

  if (data.project) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_TEXT);
    doc.text(data.project, billX, y + 11, { align: 'right' });
  }

  y += 32;

  /* ═══════════════════ Invoice meta bar ═══════════════════ */

  // Horizontal line
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // <DOC TYPE> | DATE | DUE | BALANCE DUE
  const colW = contentW / 4;
  const docLabel = data.documentType === 'CHANGE_ORDER_REQUEST'
    ? 'CHANGE ORDER REQUEST'
    : 'INVOICE';
  const metaLabels = [docLabel, 'DATE', 'DUE', 'BALANCE DUE'];
  const dueLabel = data.dueDate === data.issuedDate ? 'On Receipt' : fmtDateDisplay(data.dueDate);
  const metaValues = [
    data.invoiceNumber,
    fmtDateDisplay(data.issuedDate),
    dueLabel,
    `USD ${fmtMoney(data.amount)}`,
  ];

  metaLabels.forEach((label, i) => {
    const lx = margin + i * colW;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY_TEXT);
    doc.text(label, lx, y);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    if (i === 3) {
      doc.setFont('helvetica', 'bold');
    }
    doc.text(metaValues[i], lx, y + 5);
  });

  y += 14;

  // Horizontal line
  doc.setDrawColor(...BORDER_GRAY);
  doc.line(margin, y, pageW - margin, y);
  y += 3;

  /* ═══════════════════ Line items table ═══════════════════ */

  const tableBody = data.lineItems.map(li => {
    const desc = li.description;
    const rate = fmtMoney(li.unitPrice);
    const qty = `${li.quantity} Each`;
    const discount = ''; // We show discount in totals section
    const amount = fmtMoney(li.subtotal);
    return [desc, rate, qty, discount, amount];
  });

  autoTable(doc, {
    startY: y,
    head: [['DESCRIPTION', 'RATE', 'QTY', 'DISCOUNT', 'AMOUNT']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 247, 250],
      textColor: GRAY_TEXT,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: BLACK,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      lineColor: [230, 233, 238],
      lineWidth: { bottom: 0.2 },
    },
    columnStyles: {
      0: { cellWidth: contentW * 0.38 },
      1: { cellWidth: contentW * 0.15, halign: 'right' },
      2: { cellWidth: contentW * 0.12, halign: 'center' },
      3: { cellWidth: contentW * 0.15, halign: 'right' },
      4: { cellWidth: contentW * 0.20, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    tableLineColor: BORDER_GRAY,
    tableLineWidth: 0.3,
    didDrawPage: () => {
      // Border around table
      const tbl = (doc as unknown as Record<string, unknown>).lastAutoTable as {
        finalY: number;
        settings: { startY: number; margin: { left: number } };
      };
      if (tbl) {
        doc.setDrawColor(...BORDER_GRAY);
        doc.setLineWidth(0.3);
        doc.rect(margin, tbl.settings.startY, contentW, tbl.finalY - tbl.settings.startY, 'S');
      }
    },
  });

  const tbl = (doc as unknown as Record<string, unknown>).lastAutoTable as {
    finalY: number;
  };
  y = tbl ? tbl.finalY + 6 : y + 40;

  /* ═══════════════════ Totals section ═══════════════════ */

  const totalsX = pageW - margin - 75;
  const totalsValX = pageW - margin;
  const lineH = 6.5;

  // SUBTOTAL
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_TEXT);
  doc.text('SUBTOTAL', totalsX, y, { align: 'left' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text(fmtMoney(data.subtotal), totalsValX, y, { align: 'right' });
  y += lineH;

  // DISCOUNT (if any)
  if (data.discount > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY_TEXT);
    doc.text('DISCOUNT', totalsX, y, { align: 'left' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    doc.text(fmtMoneySign(-data.discount), totalsValX, y, { align: 'right' });
    y += lineH;
  }

  // TAX
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_TEXT);
  doc.text(`TAX (${data.taxRate}%)`, totalsX, y, { align: 'left' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text(fmtMoney(data.tax), totalsValX, y, { align: 'right' });
  y += lineH;

  // TOTAL
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_TEXT);
  doc.text('TOTAL', totalsX, y, { align: 'left' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  doc.text(fmtMoney(data.amount), totalsValX, y, { align: 'right' });
  y += lineH + 2;

  // Separator line
  doc.setDrawColor(...BORDER_GRAY);
  doc.line(totalsX, y, totalsValX, y);
  y += 5;

  // BALANCE DUE (large)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_TEXT);
  doc.text('BALANCE DUE', totalsX, y, { align: 'left' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  doc.text(`USD ${fmtMoney(data.amount)}`, totalsValX, y, { align: 'right' });

  y += 18;

  /* ═══════════════════ Notes ═══════════════════ */

  if (data.notes) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY_TEXT);
    doc.text('NOTES', margin, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    const noteLines = doc.splitTextToSize(data.notes, contentW * 0.6);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 8;
  }

  /* ═══════════════════ Signature line ═══════════════════ */

  y = Math.max(y, doc.internal.pageSize.getHeight() - 40);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text('Customer Signature', margin, y);
  y += 2;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(margin + 35, y, margin + 110, y);

  /* ═══════════════════ Footer ═══════════════════ */

  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 3, pageW - margin, footerY - 3);

  // Blue accent bar at bottom
  doc.setFillColor(...BRAND_PRIMARY);
  doc.rect(0, doc.internal.pageSize.getHeight() - 4, pageW, 4, 'F');

  /* ═══════════════════ Generate ═══════════════════ */

  const safeClient = data.client.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  const safeProject = data.project.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  const docPrefix = data.documentType === 'CHANGE_ORDER_REQUEST'
    ? 'ChangeOrder'
    : 'Invoice';
  const filename = `${docPrefix}_${safeClient}_${safeProject}_${data.issuedDate}.pdf`;

  const blob = doc.output('blob');
  return { blob, filename };
}

/** Generate and immediately trigger download. */
export function downloadInvoicePdf(data: InvoicePdfData, issuer?: InvoiceIssuerPdf) {
  const { blob, filename } = generateInvoicePdf(data, issuer);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Build a blob: object URL for the same PDF, for inline preview (e.g. an
 * `<iframe>`). The CALLER OWNS the returned url and must
 * `URL.revokeObjectURL` it when it changes or the component unmounts —
 * otherwise the blobs leak. Used by the live invoice preview.
 */
export function invoicePdfPreviewUrl(data: InvoicePdfData, issuer?: InvoiceIssuerPdf): string {
  const { blob } = generateInvoicePdf(data, issuer);
  return URL.createObjectURL(blob);
}
