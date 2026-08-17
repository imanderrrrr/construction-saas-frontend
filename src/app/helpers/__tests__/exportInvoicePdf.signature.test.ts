// The invoice PDF is where the customer signature actually lands for the
// client — "esa es la firma que más pedimos siempre". These tests pin the two
// behaviours that matter: an unsigned invoice keeps printing exactly what it
// always printed, and a signed one carries the attribution with it.

import { describe, expect, it } from 'vitest';
import { generateInvoicePdf, type InvoicePdfData, type InvoiceSignaturePdf } from '../exportInvoicePdf';

const DATA: InvoicePdfData = {
  invoiceNumber: 'INV-2026-0001',
  documentType: 'INVOICE',
  client: 'Cliente Grande S.A.',
  project: 'Torre Norte',
  description: 'Remodelación de baños',
  issuedDate: '2026-08-01',
  dueDate: '2026-09-01',
  amount: 2500,
  subtotal: 2500,
  discount: 0,
  taxRate: 0,
  tax: 0,
  lineItems: [
    { description: 'Mano de obra', quantity: 10, unitPrice: 200, subtotal: 2000 },
    { description: 'Material (azulejo)', quantity: 1, unitPrice: 500, subtotal: 500 },
  ],
  notes: null,
};

/** A structurally valid 1x1 PNG — same shape the canvas produces. */
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SIGNATURE: InvoiceSignaturePdf = {
  imageDataUrl: PNG_1PX,
  signerName: 'Carlos Méndez',
  signerTitle: 'Superintendente de obra',
  signedAt: '2026-08-09T15:00:00Z',
  documentHash: 'e4558c3455c90bc94de7d72deade0ff756da7ff93a7b0d339aa92b296be6abe2',
};

describe('invoice PDF signature block', () => {
  it('produces a valid PDF with no signature (unchanged behaviour)', () => {
    const { blob, filename } = generateInvoicePdf(DATA);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
    expect(filename).toContain('Invoice');
  });

  it('embeds the stroke and the attribution when the document is signed', () => {
    const unsigned = generateInvoicePdf(DATA).blob;
    const signed = generateInvoicePdf(DATA, undefined, SIGNATURE).blob;

    expect(signed.type).toBe('application/pdf');
    // The signed PDF carries an extra image stream plus three lines of typed
    // attribution, so it cannot be the same size as the unsigned one.
    expect(signed.size).toBeGreaterThan(unsigned.size);
  });

  it('still renders a PDF when the stored image is corrupt', () => {
    // A signature we cannot decode must not take the whole invoice down: the
    // ruled line and the typed attribution still tell the story.
    const corrupt = { ...SIGNATURE, imageDataUrl: 'data:image/png;base64,not-real-png' };
    const { blob } = generateInvoicePdf(DATA, undefined, corrupt);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });
});
