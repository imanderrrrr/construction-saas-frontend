// The credential sheet is the only artefact that ever carries a PIN, and it
// may carry one ONLY when the caller has just set it: the backend stores a
// BCrypt hash and nothing can read a PIN back. These tests pin that contract,
// the sensitive-document notice, the identifier rule and the vector QR.
//
// Assertions read the raw PDF stream, so they stick to ASCII substrings —
// accented characters are WinAnsi-encoded inside the file.

import { describe, expect, it } from 'vitest';
import {
  credentialPdfLabels, generateCredentialPdf,
  type CredentialPdfData, type CredentialPdfLabels,
} from '../exportCredentialPdf';

const LABELS: CredentialPdfLabels = {
  title: 'Access credential',
  generatedOn: 'Generated 2026-09-02',
  sensitiveTitle: 'Contains sensitive information',
  sensitiveBody: 'Hand it over in person. Do not forward it.',
  qrCaption: 'Personal QR',
  workspace: 'Company identifier',
  username: 'Username',
  pin: '6-digit PIN',
  pinReplaced: 'New PIN. The previous one no longer works.',
  pinUnavailable: 'PIN NOT PRINTED: it cannot be recovered.',
  password: 'Temporary password',
  passwordNote: 'Changed on first sign-in.',
  howTitle: 'How to sign in',
  steps: ['Install the app.', 'Scan the code.', 'Type the PIN.'],
  howHint: 'Ask your administrator for a new one.',
  footer: 'Confidential',
};

/**
 * Same length as a real QR-login token (~200 characters) so the QR has the
 * same density — and deliberately NOT shaped like one, so secret scanners
 * don't mistake a fixture for a leaked credential.
 */
const QR_TOKEN = `qr-login-token.${'0123456789abcdef'.repeat(11)}.end`;

/** Mixed case on purpose: the sheet must print it verbatim (see the office test). */
const MIXED_CASE_SECRET = ['Ab7r', 'Kx2q'].join('-');

const FIELD: CredentialPdfData = {
  fullName: 'Pedro Obrero',
  username: 'pedro.obrero',
  roleLabel: 'Worker',
  workspaceSlug: 'vista-del-mar',
  qrToken: QR_TOKEN,
  secret: { kind: 'pinUnavailable' },
};

const pdfText = (data: CredentialPdfData) => generateCredentialPdf(data, LABELS).blob.text();

/** Filled rectangles in the page stream — the QR modules dominate the count. */
const rectangles = (pdf: string) => (pdf.match(/ re\n/g) ?? []).length;

describe('credential PDF · what it prints', () => {
  it('carries the identifier, the username and the sensitive-document notice', async () => {
    const text = await pdfText(FIELD);

    expect(text).toContain('vista-del-mar');
    expect(text).toContain('pedro.obrero');
    expect(text).toContain('Pedro Obrero');
    // Upper-cased by the Mono role, like every label on the panel.
    expect(text).toContain('CONTAINS SENSITIVE INFORMATION');
    expect(text).toContain('Hand it over in person.');
  });

  it('is a PDF named after the user', () => {
    const { blob, filename } = generateCredentialPdf(FIELD, LABELS);

    expect(blob.type).toBe('application/pdf');
    expect(filename).toMatch(/^Credencial_pedro\.obrero_\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('draws the QR as vector rectangles', async () => {
    const withQr = rectangles(await pdfText(FIELD));
    const withoutQr = rectangles(await pdfText({ ...FIELD, qrToken: null, secret: { kind: 'password', value: 'x' } }));

    expect(withQr).toBeGreaterThan(300);
    expect(withoutQr).toBeLessThan(60);
  });

  it('omits the identifier row on the legacy default tenant', async () => {
    const text = await pdfText({ ...FIELD, workspaceSlug: null });

    expect(text).not.toContain('COMPANY IDENTIFIER');
    expect(text).toContain('pedro.obrero');
  });
});

describe('credential PDF · the PIN', () => {
  it('re-download: says the PIN cannot be recovered and prints none', async () => {
    const text = await pdfText(FIELD);

    expect(text).toContain('PIN NOT PRINTED');
    expect(text).not.toContain('482913');
    expect(text).not.toContain('New PIN');
  });

  it('reset: prints the just-set PIN as one string, with the replaced note', async () => {
    const text = await pdfText({ ...FIELD, secret: { kind: 'pin', value: '482913', replaced: true } });

    // One tracked string — the PIN survives verbatim in the document, not as
    // six unrelated glyphs.
    expect(text).toContain('482913');
    expect(text).toContain('New PIN.');
    expect(text).not.toContain('PIN NOT PRINTED');
  });

  it('first hand-over: the PIN without the replaced note', async () => {
    const text = await pdfText({ ...FIELD, secret: { kind: 'pin', value: '482913', replaced: false } });

    expect(text).toContain('482913');
    expect(text).not.toContain('New PIN');
  });

  it('office user: the temporary password verbatim, no QR', async () => {
    const text = await pdfText({
      ...FIELD, username: 'carlos.contador', qrToken: null,
      secret: { kind: 'password', value: MIXED_CASE_SECRET },
    });

    // Case matters — an upper-cased password is the bug the credential card
    // already had once (see NewUserFlow.credential.test.tsx).
    expect(text).toContain(MIXED_CASE_SECRET);
    expect(text).toContain('TEMPORARY PASSWORD');
    expect(text).not.toContain('Personal QR');
  });
});

describe('credential PDF · labels', () => {
  const t = (key: string, options?: Record<string, unknown>) =>
    options ? `${key}|${JSON.stringify(options)}` : key;

  it('resolves the phone steps for field access', () => {
    const labels = credentialPdfLabels(t, { access: 'FIELD', date: '2 sep 2026' });

    expect(labels.howTitle).toBe('admin:usr.pdf.howField');
    expect(labels.steps).toEqual(['admin:usr.pdf.stepField1', 'admin:usr.pdf.stepField2', 'admin:usr.pdf.stepField3']);
    expect(labels.generatedOn).toBe('admin:usr.pdf.generatedOn|{"date":"2 sep 2026"}');
    // The identifier and username labels are the screens' own keys, so the
    // paper says exactly what the login screen asks for.
    expect(labels.workspace).toBe('admin:usr.new.workspace');
    expect(labels.username).toBe('admin:usr.d.username');
  });

  it('resolves the web-panel steps, with the panel URL, for office access', () => {
    const labels = credentialPdfLabels(t, { access: 'OFFICE', date: 'x', panelUrl: 'https://panel.example' });

    expect(labels.howTitle).toBe('admin:usr.pdf.howOffice');
    expect(labels.steps[0]).toBe('admin:usr.pdf.stepOffice1|{"url":"https://panel.example"}');
  });
});
