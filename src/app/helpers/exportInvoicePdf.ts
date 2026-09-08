import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import i18n from '../../i18n';

/* ───────────────────────── Ink palette (RGB) ─────────────────────────
   The panel's own colours. The blue #0B82C7 this document used to carry —
   headings plus a 4 mm bar across the foot of every page — belonged to
   nobody: not to BuildTrack, not to the tenant whose invoice it is. It is
   gone. What is left prints identically in colour and in grey, and the one
   accent is the 2 mm orange square next to the BuildTrack footer line.     */
const INK: [number, number, number] = [11, 10, 9];
const GRAY_TEXT: [number, number, number] = [138, 129, 117];
const BLACK: [number, number, number] = [11, 10, 9];
const BORDER_GRAY: [number, number, number] = [219, 208, 187];
const SAND: [number, number, number] = [243, 238, 228];
const ORANGE: [number, number, number] = [249, 115, 22];

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
 * invoiceBranding service, which loads it). BuildTrack is multi-tenant, so
 * there is no hardcoded issuer: when omitted/undefined the header simply
 * carries no issuer identity, and the tenant fills it in from that screen.
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

/* ───────────────────────── Helpers ───────────────────────── */

function fmtMoney(n: number): string {
  return `$${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * A filename fragment that keeps the company's name and loses only what a
 * filesystem cannot store. NFC first, so a decomposed "n + ~" is one ñ and
 * not an ñ that a stripping regex would tear in half.
 */
function safeFilePart(raw: string): string {
  return (raw ?? '')
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f/\\:*?"<>|]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'documento';
}

function fmtMoneySign(n: number): string {
  if (n < 0) return `-${fmtMoney(n)}`;
  return fmtMoney(n);
}

/**
 * The date as the reader's country writes it.
 *
 * This was pinned to `en-US` with numeric month and day, so 7 September 2026
 * printed `09/07/2026` — which a Guatemalan client reads as 9 July, three
 * months early, on the line that says when the money is due. Spanish gets
 * `es-GT` (day/month/year); English keeps a written month, which cannot be
 * read backwards at all.
 */
function fmtDateDisplay(iso: string, lang: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return isEs(lang)
    ? d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isEs(lang: string): boolean {
  return lang.toLowerCase().startsWith('es');
}

/**
 * The document's words, in the panel's language.
 *
 * Everything the client reads used to be English regardless of the panel:
 * `BILL TO`, `RATE`, `QTY`, `BALANCE DUE`, `Customer Signature`, `1 Each`.
 * It is the only artefact of this section that leaves the company, and it is
 * read by whoever pays. The strings live in `finance.json` under
 * `invoice.pdf.*` like the rest of the section; `lang` is resolved from the
 * live i18n instance unless a caller passes one (tests do).
 */
function pdfLabels(lang: string) {
  const lng = isEs(lang) ? 'es' : 'en';
  const s = (key: string, opts?: Record<string, unknown>) =>
    i18n.t(`finance:invoice.pdf.${key}`, { lng, ...opts }) as string;
  return {
    invoice: s('invoice'),
    changeOrder: s('changeOrder'),
    billTo: s('billTo'),
    issuedTo: s('issuedTo'),
    date: s('date'),
    due: s('due'),
    onReceipt: s('onReceipt'),
    balanceDue: s('balanceDue'),
    description: s('description'),
    unitPrice: s('unitPrice'),
    quantity: s('quantity'),
    discount: s('discount'),
    amount: s('amount'),
    subtotal: s('subtotal'),
    tax: s('tax'),
    total: s('total'),
    notes: s('notes'),
    signature: s('signature'),
    approval: s('approval'),
    pendingApproval: s('pendingApproval'),
    signedOn: (when: string) => s('signedOn', { when }),
    fingerprint: (hash: string) => s('fingerprint', { hash }),
    issuedWith: s('issuedWith'),
    units: (n: number) => s('units', { count: n }),
  };
}

/* ───────────────────────── Logo drawing ───────────────────────── */

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

/**
 * A captured customer signature, when the document has one.
 *
 * `imageDataUrl` is the PNG the signer drew (PNG only — see
 * SignatureImageStorage). When absent, the PDF keeps printing the blank ruled
 * line it always did, so an unsigned invoice is unchanged.
 */
export interface InvoiceSignaturePdf {
  imageDataUrl: string;
  signerName: string;
  signerTitle: string;
  signedAt: string;
  documentHash: string;
}

export function generateInvoicePdf(
  data: InvoicePdfData,
  issuer?: InvoiceIssuerPdf,
  signature?: InvoiceSignaturePdf,
  /** Panel language; defaults to whatever i18n currently has. */
  lang: string = i18n.language || 'es',
): { blob: Blob; filename: string } {
  const L = pdfLabels(lang);
  const isCO = data.documentType === 'CHANGE_ORDER_REQUEST';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;

  let y = 18;

  /* ═══════════════════ Header ═══════════════════ */

  // Issuer block: strictly the tenant's own configured template. A tenant that
  // has not filled it in gets an empty issuer block — never another tenant's
  // company name, address or phone number on its invoices.
  if (issuer?.logoDataUrl) {
    drawLogoImage(doc, issuer.logoDataUrl, margin, y - 2, 18);
  }

  const issuerName = issuer?.name ?? '';
  const issuerLines = [issuer?.contact, issuer?.address, issuer?.phone, issuer?.email]
    .filter((line): line is string => Boolean(line && line.trim()));

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
  doc.text((isCO ? L.issuedTo : L.billTo).toUpperCase(), billX, y, { align: 'right' });

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
  const docLabel = (isCO ? L.changeOrder : L.invoice).toUpperCase();
  const metaLabels = [docLabel, L.date.toUpperCase(), L.due.toUpperCase(), L.balanceDue.toUpperCase()];
  const dueLabel = data.dueDate === data.issuedDate ? L.onReceipt : fmtDateDisplay(data.dueDate, lang);
  const metaValues = [
    data.invoiceNumber,
    fmtDateDisplay(data.issuedDate, lang),
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

  // A change order is not an invoice: it asks for money outside the contract
  // and is worth nothing until the client approves it. Printed with the same
  // headline as an invoice, the two are indistinguishable on paper.
  if (isCO) {
    doc.setFillColor(...INK);
    doc.rect(margin, y - 4, contentW, 6, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 241, 232);
    doc.text(L.pendingApproval.toUpperCase(), margin + 3, y);
    y += 6;
  }

  // Horizontal line
  doc.setDrawColor(...BORDER_GRAY);
  doc.line(margin, y, pageW - margin, y);
  y += 3;

  /* ═══════════════════ Line items table ═══════════════════ */

  const tableBody = data.lineItems.map(li => {
    const desc = li.description;
    const rate = fmtMoney(li.unitPrice);
    const qty = L.units(li.quantity);
    const discount = ''; // We show discount in totals section
    const amount = fmtMoney(li.subtotal);
    return [desc, rate, qty, discount, amount];
  });

  autoTable(doc, {
    startY: y,
    head: [[L.description.toUpperCase(), L.unitPrice.toUpperCase(), L.quantity.toUpperCase(), L.discount.toUpperCase(), L.amount.toUpperCase()]],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: SAND,
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
  doc.text(L.subtotal.toUpperCase(), totalsX, y, { align: 'left' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text(fmtMoney(data.subtotal), totalsValX, y, { align: 'right' });
  y += lineH;

  // DISCOUNT (if any)
  if (data.discount > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY_TEXT);
    doc.text(L.discount.toUpperCase(), totalsX, y, { align: 'left' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    doc.text(fmtMoneySign(-data.discount), totalsValX, y, { align: 'right' });
    y += lineH;
  }

  // TAX
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_TEXT);
  doc.text(`${L.tax.toUpperCase()} ${isEs(lang) ? `${data.taxRate} %` : `${data.taxRate}%`}`, totalsX, y, { align: 'left' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text(fmtMoney(data.tax), totalsValX, y, { align: 'right' });
  y += lineH;

  // TOTAL
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_TEXT);
  doc.text(L.total.toUpperCase(), totalsX, y, { align: 'left' });
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
  doc.text(L.balanceDue.toUpperCase(), totalsX, y, { align: 'left' });
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
    doc.text(L.notes.toUpperCase(), margin, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    const noteLines = doc.splitTextToSize(data.notes, contentW * 0.6);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 8;
  }

  /* ═══════════════════ Signature line ═══════════════════ */

  // Unsigned: the blank ruled line this document always printed, for a wet
  // signature. Signed: the captured stroke sits ON that line, with the name,
  // the title and the date underneath — the three things the customer's own
  // contractors ask them for — plus the document fingerprint, so the paper
  // copy carries the same evidence as the record behind it.
  y = Math.max(y, doc.internal.pageSize.getHeight() - (signature ? 52 : 40));

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text(isCO ? L.approval : L.signature, margin, y);

  if (signature) {
    try {
      // 75mm × 18mm over the rule, matching the line's span below.
      doc.addImage(signature.imageDataUrl, 'PNG', margin + 35, y - 16, 75, 18, undefined, 'FAST');
    } catch {
      // A corrupt stored image must not take the whole PDF down; the ruled
      // line and the typed attribution below still tell the story.
    }
  }

  y += 2;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(margin + 35, y, margin + 110, y);

  if (signature) {
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(`${signature.signerName} — ${signature.signerTitle}`, margin + 35, y);
    y += 3.5;
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(L.signedOn(new Date(signature.signedAt).toLocaleString(isEs(lang) ? 'es-GT' : 'en-US')), margin + 35, y);
    y += 3;
    doc.text(L.fingerprint(signature.documentHash), margin + 35, y);
  }

  /* ═══════════════════ Footer ═══════════════════ */

  // Two marks, not fighting: the tenant's letterhead runs the top of the page
  // — the invoice is theirs — and BuildTrack signs the foot, small, with one
  // orange square. No bleed bar, no logotype, nothing in the header.
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 3, pageW - margin, footerY - 3);

  doc.setFillColor(...ORANGE);
  doc.rect(margin, footerY - 1.6, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_TEXT);
  doc.text(L.issuedWith, margin + 3.4, footerY);

  /* ═══════════════════ Generate ═══════════════════ */

  // Who issued it, which document, what day — and the company's own name
  // spelled properly. The old rule stripped everything outside [a-zA-Z0-9 ],
  // so "Constructora Peña" reached the client as "Constructora_Pea" and every
  // accent and ñ in the country came off the same way. Only the characters a
  // filesystem genuinely refuses are replaced now.
  const filedBy = issuer?.name?.trim();
  const filename = `${safeFilePart(filedBy || data.client)}_${safeFilePart(data.invoiceNumber)}_${data.issuedDate}.pdf`;

  const blob = doc.output('blob');
  return { blob, filename };
}

/** Generate and immediately trigger download. */
export function downloadInvoicePdf(data: InvoicePdfData, issuer?: InvoiceIssuerPdf, signature?: InvoiceSignaturePdf, lang?: string) {
  const { blob, filename } = generateInvoicePdf(data, issuer, signature, lang);
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
export function invoicePdfPreviewUrl(data: InvoicePdfData, issuer?: InvoiceIssuerPdf, signature?: InvoiceSignaturePdf, lang?: string): string {
  const { blob } = generateInvoicePdf(data, issuer, signature, lang);
  return URL.createObjectURL(blob);
}
