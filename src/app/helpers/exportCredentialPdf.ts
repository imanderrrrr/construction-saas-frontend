import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { InvoiceIssuerPdf } from './exportInvoicePdf';

/**
 * Printable access credential — the sheet an admin hands a new user, and the
 * one they download again from the user drawer when the first copy is lost.
 *
 * Two things shape this file:
 *
 *  - The PIN is the secret of the QR + PIN scheme and only its BCrypt hash is
 *    stored (User.pinHash), so NOTHING here can ever read a PIN back. A PIN is
 *    printed only when the caller has just set one (first hand-over, or the
 *    "reset PIN and download" path) and passes it in; otherwise the sheet says
 *    in so many words that the PIN cannot be recovered. The QR, by contrast,
 *    is a durable non-secret identifier, so re-printing it is safe.
 *
 *  - The QR is drawn as vector rectangles straight from the module matrix
 *    (`QRCode.create`), not as a raster image, so it stays crisp at any print
 *    size and the helper works without a canvas (jsdom included).
 *
 * Visual identity mirrors the remodelled Usuarios screens: ink header with
 * the blueprint grid, orange accent, Courier upper-case tracked labels for
 * the Mono role, square cards — no rounded corners anywhere.
 */

/* ───────────────────────── Panel palette (RGB) ───────────────────────── */
type RGB = [number, number, number];
const INK: RGB = [10, 10, 10];            // #0A0A0A
const CREAM: RGB = [245, 241, 232];       // #F5F1E8
const CREAM_DIM: RGB = [176, 170, 158];   // cream at ~60% on ink
const ORANGE: RGB = [249, 115, 22];       // #F97316
const ORANGE_DEEP: RGB = [194, 65, 12];   // #C2410C
const PAPER: RGB = [250, 247, 240];       // #FAF7F0
const SAND: RGB = [205, 191, 166];        // #CDBFA6
const SAND_LIGHT: RGB = [237, 231, 219];  // #EDE7DB
const TAUPE: RGB = [138, 129, 117];       // #8A8175
const TAUPE_LIGHT: RGB = [166, 156, 141]; // #A69C8D
const BROWN: RGB = [67, 48, 31];          // #43301F
const PEACH: RGB = [251, 237, 224];       // #FBEDE0
const PEACH_BORDER: RGB = [246, 207, 166];// #F6CFA6
const WHITE: RGB = [255, 255, 255];
const GRID_ON_INK: RGB = [31, 30, 28];    // the GRID_INK motif, flattened

/* ───────────────────────── Types ───────────────────────── */

export type CredentialAccess = 'FIELD' | 'OFFICE';

/**
 * What the sheet prints in the secret slot.
 *  - `pin`: a PIN the caller has JUST stored (hashed) through the API. `replaced`
 *    adds the "the previous PIN no longer works" note for the reset path.
 *  - `pinUnavailable`: re-download of an existing credential — the PIN is not
 *    recoverable, and the sheet says so instead of pretending.
 *  - `password`: office users, who sign in on the web panel with a temporary
 *    password instead of a QR.
 */
export type CredentialSecret =
  | { kind: 'pin'; value: string; replaced: boolean }
  | { kind: 'pinUnavailable' }
  | { kind: 'password'; value: string };

export interface CredentialPdfData {
  fullName: string | null;
  username: string;
  /** Already translated (`common:roles.*`). */
  roleLabel: string;
  /**
   * The company identifier typed on the login screens. `null` omits the row —
   * the legacy single-tenant deployment's users are told to leave that field
   * blank, so printing "default" would instruct them to type the wrong thing.
   */
  workspaceSlug: string | null;
  /** Signed QR-login token; `null` for office users (no QR). */
  qrToken: string | null;
  secret: CredentialSecret;
}

/** Every string the sheet prints — resolved by the caller in the panel's language. */
export interface CredentialPdfLabels {
  title: string;
  generatedOn: string;
  sensitiveTitle: string;
  sensitiveBody: string;
  qrCaption: string;
  workspace: string;
  username: string;
  pin: string;
  pinReplaced: string;
  pinUnavailable: string;
  password: string;
  passwordNote: string;
  howTitle: string;
  steps: string[];
  howHint: string;
  footer: string;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Labels for [generateCredentialPdf] from the `admin` namespace. The workspace,
 * username and PIN labels are the drawer's own keys, so the paper says exactly
 * what the screens say.
 */
export function credentialPdfLabels(
  t: Translate,
  opts: { access: CredentialAccess; date: string; panelUrl?: string },
): CredentialPdfLabels {
  const field = opts.access === 'FIELD';
  return {
    title: t('admin:usr.pdf.title'),
    generatedOn: t('admin:usr.pdf.generatedOn', { date: opts.date }),
    sensitiveTitle: t('admin:usr.pdf.sensitiveTitle'),
    sensitiveBody: t('admin:usr.pdf.sensitiveBody'),
    qrCaption: t('admin:usr.pdf.qrCaption'),
    workspace: t('admin:usr.new.workspace'),
    username: t('admin:usr.d.username'),
    pin: t('admin:usr.d.pin'),
    pinReplaced: t('admin:usr.pdf.pinReplaced'),
    pinUnavailable: t('admin:usr.pdf.pinUnavailable'),
    password: t('admin:usr.pdf.tempPassword'),
    passwordNote: t('admin:usr.pdf.passwordNote'),
    howTitle: t(field ? 'admin:usr.pdf.howField' : 'admin:usr.pdf.howOffice'),
    steps: field
      ? [t('admin:usr.pdf.stepField1'), t('admin:usr.pdf.stepField2'), t('admin:usr.pdf.stepField3')]
      : [
        t('admin:usr.pdf.stepOffice1', { url: opts.panelUrl ?? '' }),
        t('admin:usr.pdf.stepOffice2'),
        t('admin:usr.pdf.stepOffice3'),
      ],
    howHint: t(field ? 'admin:usr.pdf.hintField' : 'admin:usr.pdf.hintOffice'),
    footer: t('admin:usr.pdf.footer'),
  };
}

/* ───────────────────────── Drawing helpers ───────────────────────── */

const PT_PER_MM = 72 / 25.4;
/** Courier advances 0.6 em per glyph, whatever the glyph. */
const courierGlyphMm = (sizePt: number) => (sizePt * 0.6) / PT_PER_MM;
const lineHeightMm = (sizePt: number) => (sizePt * 1.35) / PT_PER_MM;

/** The Mono role: Courier, upper-case, tracked. `keepCase` for values that must survive verbatim (usernames). */
function mono(doc: jsPDF, text: string, x: number, y: number, o: {
  size: number; color: RGB; tracking?: number; bold?: boolean;
  align?: 'left' | 'center' | 'right'; keepCase?: boolean;
}) {
  doc.setFont('courier', o.bold ? 'bold' : 'normal');
  doc.setFontSize(o.size);
  doc.setTextColor(...o.color);
  const s = o.keepCase ? text : text.toUpperCase();
  const tracking = o.tracking ?? 0;
  // jsPDF measures the standard (AFM) fonts without the character spacing,
  // so a right- or centre-aligned tracked label would overshoot its anchor
  // by one tracking per glyph. Measure untracked and add the tracking by hand.
  const width = doc.getTextWidth(s) + tracking * Math.max(0, s.length - 1);
  const left = o.align === 'right' ? x - width : o.align === 'center' ? x - width / 2 : x;
  doc.setCharSpace(tracking);
  doc.text(s, left, y);
  doc.setCharSpace(0);
}

/** Body text; wraps to `maxWidth` and returns the height it used. */
function sans(doc: jsPDF, text: string, x: number, y: number, o: {
  size: number; color: RGB; bold?: boolean; maxWidth: number;
}): number {
  doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
  doc.setFontSize(o.size);
  doc.setTextColor(...o.color);
  const lines: string[] = doc.splitTextToSize(text, o.maxWidth);
  doc.text(lines, x, y);
  return lines.length * lineHeightMm(o.size);
}

/** Height `sans` will need, without drawing — for boxes sized around text. */
function sansHeight(doc: jsPDF, text: string, size: number, maxWidth: number): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  return (doc.splitTextToSize(text, maxWidth) as string[]).length * lineHeightMm(size);
}

/**
 * Vector QR: one filled rectangle per horizontal run of dark modules, inside
 * a white square with a two-module quiet zone. Level M is what the phone's
 * scanner is tuned for and keeps the symbol small enough to read from a
 * creased sheet.
 */
function drawQr(doc: jsPDF, token: string, x: number, y: number, size: number) {
  const qr = QRCode.create(token, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const bits = qr.modules.data;
  const quiet = 2;
  const cell = size / (n + quiet * 2);

  doc.setFillColor(...WHITE);
  doc.rect(x, y, size, size, 'F');
  doc.setFillColor(...INK);
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!bits[r * n + c]) { c++; continue; }
      let end = c;
      while (end < n && bits[r * n + end]) end++;
      // A hair of overlap hides the anti-aliasing seams some viewers draw
      // between adjacent rectangles.
      doc.rect(x + (quiet + c) * cell, y + (quiet + r) * cell, (end - c) * cell + 0.02, cell + 0.02, 'F');
      c = end;
    }
  }
}

/** Tenant logo aspect-fitted in a white tile; a corrupt image skips the logo, never the sheet. */
function drawLogoTile(doc: jsPDF, dataUrl: string, x: number, y: number, box: number) {
  try {
    const props = doc.getImageProperties(dataUrl);
    const inner = box - 4;
    const scale = Math.min(inner / props.width, inner / props.height);
    const w = props.width * scale;
    const h = props.height * scale;
    doc.setFillColor(...WHITE);
    doc.rect(x, y, box, box, 'F');
    doc.addImage(dataUrl, props.fileType, x + (box - w) / 2, y + (box - h) / 2, w, h);
  } catch {
    // Bad image data: the header simply carries no logo.
  }
}

/* ───────────────────────── Main export ───────────────────────── */

export function generateCredentialPdf(
  data: CredentialPdfData,
  labels: CredentialPdfLabels,
  issuer?: InvoiceIssuerPdf,
): { blob: Blob; filename: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  const displayName = (data.fullName && data.fullName.trim()) || data.username;

  /* ═══════════════════ Header — ink band ═══════════════════ */

  const headerH = 42;
  doc.setFillColor(...INK);
  doc.rect(0, 0, pageW, headerH, 'F');
  doc.setDrawColor(...GRID_ON_INK);
  doc.setLineWidth(0.15);
  for (let gx = 6.5; gx < pageW; gx += 6.5) doc.line(gx, 0, gx, headerH);
  for (let gy = 6.5; gy < headerH; gy += 6.5) doc.line(0, gy, pageW, gy);
  doc.setFillColor(...ORANGE);
  doc.rect(0, headerH, pageW, 1.6, 'F');

  mono(doc, 'BuildTrack', margin, 15, { size: 8.5, color: ORANGE, tracking: 0.9, bold: true });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...CREAM);
  doc.text(labels.title, margin, 26.5);

  // Issuer identity: strictly the tenant's own configured template (the same
  // block the invoice header prints). Unconfigured → no company name at all,
  // never another tenant's.
  const issuerName = issuer?.name?.trim();
  if (issuerName) {
    mono(doc, issuerName, margin, 34.5, { size: 7.5, color: CREAM_DIM, tracking: 0.5 });
  }
  if (issuer?.logoDataUrl) {
    drawLogoTile(doc, issuer.logoDataUrl, pageW - margin - 20, 7, 20);
  }
  mono(doc, labels.generatedOn, pageW - margin, 37.5, {
    size: 6.5, color: CREAM_DIM, tracking: 0.25, align: 'right', keepCase: true,
  });

  /* ═══════════════════ Sensitive-document notice ═══════════════════ */

  let y = headerH + 1.6 + 8;
  const noticeTextX = margin + 8;
  const noticeTextW = contentW - 12;
  const noticeBodyH = sansHeight(doc, labels.sensitiveBody, 8.5, noticeTextW);
  const noticeH = 13 + noticeBodyH + 2;

  doc.setFillColor(...PEACH);
  doc.setDrawColor(...PEACH_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentW, noticeH, 'FD');
  doc.setFillColor(...ORANGE);
  doc.rect(margin, y, 2.2, noticeH, 'F');
  mono(doc, labels.sensitiveTitle, noticeTextX, y + 7, { size: 8.5, color: ORANGE_DEEP, tracking: 0.5, bold: true });
  sans(doc, labels.sensitiveBody, noticeTextX, y + 12.5, { size: 8.5, color: BROWN, maxWidth: noticeTextW });
  y += noticeH + 8;

  /* ═══════════════════ Credential card ═══════════════════ */

  const cardTop = y;
  const hasQr = Boolean(data.qrToken);
  const qrPanelW = hasQr ? 78 : 0;
  const qrSize = 58;
  const rx = margin + qrPanelW + 10;
  const rw = contentW - qrPanelW - 20;

  if (data.qrToken) {
    const qx = margin + (qrPanelW - qrSize) / 2;
    drawQr(doc, data.qrToken, qx, cardTop + 10, qrSize);
    mono(doc, labels.qrCaption, margin + qrPanelW / 2, cardTop + 10 + qrSize + 6, {
      size: 6.5, color: TAUPE_LIGHT, tracking: 0.35, align: 'center',
    });
  }

  // Name — shrink rather than wrap: a two-line name pushes every row down.
  let nameSize = 17;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(nameSize);
  while (doc.getTextWidth(displayName) > rw && nameSize > 11) {
    nameSize -= 1;
    doc.setFontSize(nameSize);
  }
  doc.setTextColor(...INK);
  doc.text(displayName, rx, cardTop + 16);
  mono(doc, `@${data.username} · ${data.roleLabel}`, rx, cardTop + 22.5, {
    size: 8.5, color: TAUPE_LIGHT, keepCase: true,
  });

  let ry = cardTop + 34;
  const detailRow = (label: string, value: string) => {
    mono(doc, label, rx, ry, { size: 6.8, color: TAUPE, tracking: 0.4 });
    mono(doc, value, rx, ry + 6, { size: 11.5, color: INK, keepCase: true });
    ry += 13.5;
  };
  if (data.workspaceSlug) detailRow(labels.workspace, data.workspaceSlug);
  detailRow(labels.username, data.username);

  const secret = data.secret;
  if (secret.kind === 'pin') {
    mono(doc, labels.pin, rx, ry, { size: 6.8, color: TAUPE, tracking: 0.4 });
    const boxW = 9, boxH = 11, gap = 2.2, by = ry + 3;
    const digits = secret.value;
    doc.setDrawColor(...SAND);
    doc.setLineWidth(0.3);
    for (let i = 0; i < digits.length; i++) {
      doc.setFillColor(...PAPER);
      doc.rect(rx + i * (boxW + gap), by, boxW, boxH, 'FD');
    }
    // One tracked string, not six glyphs: Courier is monospace, so the
    // per-glyph advance plus the tracking lands each digit in its own box —
    // and the PIN survives as one string in the document.
    const digitPt = 17;
    const glyph = courierGlyphMm(digitPt);
    doc.setFont('courier', 'bold');
    doc.setFontSize(digitPt);
    doc.setTextColor(...INK);
    doc.setCharSpace(boxW + gap - glyph);
    doc.text(digits, rx + (boxW - glyph) / 2, by + 7.2);
    doc.setCharSpace(0);
    ry = by + boxH + 6;
    if (secret.replaced) {
      ry += sans(doc, labels.pinReplaced, rx, ry, { size: 8, color: ORANGE_DEEP, bold: true, maxWidth: rw });
    }
  } else if (secret.kind === 'pinUnavailable') {
    mono(doc, labels.pin, rx, ry, { size: 6.8, color: TAUPE, tracking: 0.4 });
    const calloutTextW = rw - 8;
    const calloutH = sansHeight(doc, labels.pinUnavailable, 8.5, calloutTextW) + 7;
    doc.setFillColor(...PAPER);
    doc.setDrawColor(...SAND_LIGHT);
    doc.setLineWidth(0.3);
    doc.rect(rx, ry + 3, rw, calloutH, 'FD');
    doc.setFillColor(...SAND);
    doc.rect(rx, ry + 3, 1.5, calloutH, 'F');
    sans(doc, labels.pinUnavailable, rx + 5, ry + 3 + 6, { size: 8.5, color: BROWN, maxWidth: calloutTextW });
    ry += 3 + calloutH + 4;
  } else {
    mono(doc, labels.password, rx, ry, { size: 6.8, color: TAUPE, tracking: 0.4 });
    mono(doc, secret.value, rx, ry + 8, { size: 15, color: INK, bold: true, keepCase: true });
    ry += 13;
    ry += sans(doc, labels.passwordNote, rx, ry, { size: 8, color: TAUPE, maxWidth: rw });
  }

  const leftH = hasQr ? 10 + qrSize + 6 + 8 : 0;
  const cardH = Math.max(leftH, ry - cardTop + 4, 60);
  doc.setDrawColor(...SAND);
  doc.setLineWidth(0.4);
  doc.rect(margin, cardTop, contentW, cardH, 'S');
  if (hasQr) {
    doc.setDrawColor(...SAND_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(margin + qrPanelW, cardTop, margin + qrPanelW, cardTop + cardH);
  }
  // Wordmark in the card corner, like the on-screen credential card.
  mono(doc, 'BuildTrack', margin + contentW - 3, cardTop + cardH - 3, {
    size: 5.5, color: SAND, tracking: 0.6, align: 'right',
  });
  y = cardTop + cardH + 12;

  /* ═══════════════════ How to sign in ═══════════════════ */

  doc.setFillColor(...ORANGE);
  doc.rect(margin, y - 1.4, 5, 0.5, 'F');
  mono(doc, labels.howTitle, margin + 8, y, { size: 7.5, color: TAUPE, tracking: 0.7 });
  y += 8.5;

  labels.steps.forEach((step, i) => {
    doc.setFillColor(...INK);
    doc.rect(margin, y - 4.3, 6, 6, 'F');
    mono(doc, String(i + 1), margin + 3, y, { size: 8, color: CREAM, bold: true, align: 'center' });
    const h = sans(doc, step, margin + 10, y, { size: 10, color: INK, maxWidth: contentW - 10 });
    y += Math.max(h, 6) + 3.5;
  });
  y += 1.5;
  sans(doc, labels.howHint, margin + 10, y, { size: 8.5, color: TAUPE, maxWidth: contentW - 10 });

  /* ═══════════════════ Footer ═══════════════════ */

  const footerY = pageH - 12;
  doc.setDrawColor(...SAND_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4.5, pageW - margin, footerY - 4.5);
  mono(doc, labels.footer, margin, footerY, { size: 6.5, color: TAUPE_LIGHT, tracking: 0.4 });
  mono(doc, 'BuildTrack', pageW - margin, footerY, { size: 6.5, color: TAUPE_LIGHT, tracking: 0.6, bold: true, align: 'right' });
  doc.setFillColor(...ORANGE);
  doc.rect(0, pageH - 4, pageW, 4, 'F');

  /* ═══════════════════ Generate ═══════════════════ */

  const safeUser = data.username.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamp = new Date().toISOString().slice(0, 10);
  return { blob: doc.output('blob'), filename: `Credencial_${safeUser}_${stamp}.pdf` };
}

/** Generate and immediately trigger the browser download. */
export function downloadCredentialPdf(
  data: CredentialPdfData,
  labels: CredentialPdfLabels,
  issuer?: InvoiceIssuerPdf,
): void {
  const { blob, filename } = generateCredentialPdf(data, labels, issuer);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
