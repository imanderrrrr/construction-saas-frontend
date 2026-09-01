// The invoice header used to fall back to a hardcoded issuer block (OFJR
// Construction LLC, its contact, Oklahoma address, phone and email) whenever a
// tenant had not configured Configuración → Plantilla de factura. BuildTrack is
// multi-tenant, so that fallback printed one client's legal identity on every
// other client's invoices. These tests pin both halves of the fix: a configured
// template is what gets printed, and an unconfigured one prints nobody.

import { describe, expect, it } from 'vitest';
import { generateInvoicePdf, type InvoicePdfData, type InvoiceIssuerPdf } from '../exportInvoicePdf';

const DATA: InvoicePdfData = {
  invoiceNumber: 'INV-2026-0042',
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
  lineItems: [{ description: 'Mano de obra', quantity: 10, unitPrice: 200, subtotal: 2000 }],
  notes: null,
};

const ISSUER: InvoiceIssuerPdf = {
  name: 'Constructora Ejemplo, S.A.',
  contact: 'Ana López',
  address: '4a avenida 1-23, zona 1, Guatemala',
  phone: '50212345678',
  email: 'facturacion@ejemplo.gt',
  logoDataUrl: null,
};

/** Strings from the single-tenant era that must never reach a PDF again. */
const FOREIGN_IDENTITY = [
  'OFJR',
  'Oklahoma',
  'Hicks',
  'ofjrconstruction',
  'Oscar Figueroa',
  '4056986131',
];

describe('invoice PDF issuer block', () => {
  it('prints the tenant’s configured template', async () => {
    const text = await generateInvoicePdf(DATA, ISSUER).blob.text();

    expect(text).toContain('Constructora Ejemplo');
    expect(text).toContain('Ana L');
    expect(text).toContain('facturacion@ejemplo.gt');
  });

  it('prints no issuer identity when the tenant has not configured a template', async () => {
    const text = await generateInvoicePdf(DATA).blob.text();

    for (const needle of FOREIGN_IDENTITY) {
      expect(text).not.toContain(needle);
    }
  });

  it('still produces a complete invoice without a configured template', async () => {
    const { blob, filename } = generateInvoicePdf(DATA);
    const text = await blob.text();

    expect(blob.type).toBe('application/pdf');
    expect(filename).toContain('Invoice');
    // Everything that is not the issuer block still renders.
    expect(text).toContain('BILL TO');
    expect(text).toContain('INV-2026-0042');
    expect(text).toContain('Cliente Grande');
  });

  it('never leaks one tenant’s template into a PDF generated without one', async () => {
    await generateInvoicePdf(DATA, ISSUER).blob.text();
    const text = await generateInvoicePdf(DATA).blob.text();

    expect(text).not.toContain('Constructora Ejemplo');
  });
});
