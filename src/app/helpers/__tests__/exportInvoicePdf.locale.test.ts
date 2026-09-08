// The invoice PDF is the only artefact of this section that leaves the
// company, and it is read by whoever pays. It used to be English regardless
// of the panel's language, dated in US format, and painted with a blue that
// belonged to nobody — and the filename ate every accent in the country.

import { describe, expect, it } from 'vitest';
import { generateInvoicePdf, type InvoicePdfData, type InvoiceIssuerPdf } from '../exportInvoicePdf';

const DATA: InvoicePdfData = {
  invoiceNumber: 'INV-2026-7',
  documentType: 'INVOICE',
  client: 'Grupo Marisol',
  project: 'Torre Norte',
  description: null,
  // 7 September: the date that used to print as 09/07/2026 and reads as
  // 9 July in Guatemala — on the line that says when the money is due.
  issuedDate: '2026-09-07',
  dueDate: '2026-10-07',
  amount: 12500,
  subtotal: 12500,
  discount: 0,
  taxRate: 0,
  tax: 0,
  lineItems: [{ description: 'Cimentación, fase 2', quantity: 2, unitPrice: 4500, subtotal: 9000 }],
  notes: null,
};

const PENA: InvoiceIssuerPdf = {
  name: 'Constructora Peña S.A.',
  contact: null, address: null, phone: null, email: null, logoDataUrl: null,
};

describe('invoice PDF — the panel’s language', () => {
  it('prints Spanish headings for a Spanish panel', async () => {
    const text = await generateInvoicePdf(DATA, PENA, undefined, 'es').blob.text();
    expect(text).toContain('FACTURAR A');
    expect(text).toContain('CANTIDAD');
    expect(text).toContain('SALDO PENDIENTE');
    expect(text).toContain('Firma del cliente');
    expect(text).not.toContain('BILL TO');
    expect(text).not.toContain('Customer Signature');
  });

  it('prints English headings for an English panel', async () => {
    const text = await generateInvoicePdf(DATA, PENA, undefined, 'en').blob.text();
    expect(text).toContain('BILL TO');
    expect(text).toContain('Customer signature');
    expect(text).not.toContain('FACTURAR A');
  });

  it('writes the date the way the reader’s country writes it', async () => {
    const es = await generateInvoicePdf(DATA, PENA, undefined, 'es').blob.text();
    // Day first: 7 September, not 9 July.
    expect(es).toContain('07/09/2026');
    expect(es).not.toContain('09/07/2026');

    const en = await generateInvoicePdf(DATA, PENA, undefined, 'en').blob.text();
    expect(en).toContain('Sep 7, 2026');
  });

  it('translates the unit and agrees in number', async () => {
    // jsPDF lays the centred QTY cell out as separate text runs, so the
    // number and the word do not sit adjacent in the stream — the word is
    // what matters here, and "Each" is what must be gone.
    const es = await generateInvoicePdf(DATA, PENA, undefined, 'es').blob.text();
    expect(es).toContain('unidades');
    expect(es).not.toContain('Each');

    const one = { ...DATA, lineItems: [{ ...DATA.lineItems[0], quantity: 1 }] };
    const single = await generateInvoicePdf(one, PENA, undefined, 'es').blob.text();
    expect(single).toContain('unidad');
    expect(single).not.toContain('unidades');

    const en = await generateInvoicePdf(DATA, PENA, undefined, 'en').blob.text();
    expect(en).toContain('units');
  });

  it('marks a change order as something that is not a charge', async () => {
    const co = { ...DATA, documentType: 'CHANGE_ORDER_REQUEST' as const, invoiceNumber: 'COR-2026-3' };
    const text = await generateInvoicePdf(co, PENA, undefined, 'es').blob.text();
    expect(text).toContain('ORDEN DE CAMBIO');
    expect(text).toContain('NO ES UN COBRO');
    // An invoice carries no such band.
    const invoice = await generateInvoicePdf(DATA, PENA, undefined, 'es').blob.text();
    expect(invoice).not.toContain('NO ES UN COBRO');
  });
});

describe('invoice PDF — the filename', () => {
  it('keeps the accents and the ñ of the company that issued it', () => {
    const { filename } = generateInvoicePdf(DATA, PENA, undefined, 'es');
    // Was: Invoice_Cliente_Grande_… with "Peña" reduced to "Pea".
    expect(filename).toBe('Constructora-Peña-S.A._INV-2026-7_2026-09-07.pdf');
  });

  it('falls back to the client when no template is configured', () => {
    const { filename } = generateInvoicePdf(DATA, undefined, undefined, 'es');
    expect(filename).toBe('Grupo-Marisol_INV-2026-7_2026-09-07.pdf');
  });

  it('replaces only what a filesystem refuses', () => {
    const odd: InvoiceIssuerPdf = { ...PENA, name: 'A/B: "C" <D>' };
    const { filename } = generateInvoicePdf(DATA, odd, undefined, 'es');
    expect(filename.startsWith('A-B-C-D_INV-2026-7')).toBe(true);
  });
});

describe('invoice PDF — the colour that belonged to nobody', () => {
  it('no longer paints the blue accent bar', async () => {
    const text = await generateInvoicePdf(DATA, PENA, undefined, 'es').blob.text();
    // #0B82C7 as jsPDF writes an RGB fill: 0.043 0.510 0.780 rg
    expect(text).not.toMatch(/0\.043\d*\s+0\.51\d*\s+0\.78\d*\s+rg/);
  });
});
