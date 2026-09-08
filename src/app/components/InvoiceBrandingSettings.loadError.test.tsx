// BuildTrack — the invoice template must never write what it could not read.
//
// The bug this pins, reproduced end to end before the fix: a failing GET only
// raised a toast, `form` stayed at EMPTY_FORM, the five fields painted blank
// and "Guardar plantilla" stayed live. One click sent five nulls and the
// tenant's letterhead was gone — from the invoices AND from the team's mobile
// app, which reads the same row — with the toast reporting success.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
// The PDF preview is jsPDF in a jsdom canvas; the letterhead is what is on
// trial here, not the rendering.
vi.mock('../helpers/exportInvoicePdf', () => ({
  invoicePdfPreviewUrl: () => 'blob:preview',
}));

const getInvoiceBranding = vi.fn();
const updateInvoiceBranding = vi.fn();
const uploadInvoiceLogo = vi.fn();
const fetchInvoiceLogoDataUrl = vi.fn();
vi.mock('../services/invoiceBranding', () => ({
  getInvoiceBranding: (...a: unknown[]) => getInvoiceBranding(...a),
  updateInvoiceBranding: (...a: unknown[]) => updateInvoiceBranding(...a),
  uploadInvoiceLogo: (...a: unknown[]) => uploadInvoiceLogo(...a),
  fetchInvoiceLogoDataUrl: (...a: unknown[]) => fetchInvoiceLogoDataUrl(...a),
  invalidateInvoiceIssuer: () => {},
}));

import { InvoiceBrandingSettings } from './InvoiceBrandingSettings';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const CONFIGURED = {
  configured: true,
  companyName: 'Constructora Peña S.A.',
  contactName: 'Ing. Marisol Peña',
  address: '7a avenida 12-45, zona 10, Ciudad de Guatemala',
  email: 'cobros@constructorapenna.com',
  phone: '2412 8890',
  hasLogo: false,
};

async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

describe('InvoiceBrandingSettings — a failed load can never wipe the letterhead', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchInvoiceLogoDataUrl.mockResolvedValue(null);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('locks the form and offers no save button when the template cannot be read', async () => {
    getInvoiceBranding.mockRejectedValue(new Error('network'));
    await act(async () => { root.render(<InvoiceBrandingSettings />); });
    await flush();

    expect(container.querySelector('[data-testid="invoice-branding-load-error"]')).not.toBeNull();
    // The one control that could destroy data is not on the page at all.
    expect(container.querySelector('[data-testid="invoice-branding-save"]')).toBeNull();
    // And every field is locked, so nothing can be typed into a blank that
    // would then look like a deliberate "clear this".
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=file]), textarea'));
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every(i => i.disabled)).toBe(true);
    expect(updateInvoiceBranding).not.toHaveBeenCalled();
  });

  it('retry brings the template back and only then can it be saved', async () => {
    getInvoiceBranding.mockRejectedValueOnce(new Error('network')).mockResolvedValue(CONFIGURED);
    await act(async () => { root.render(<InvoiceBrandingSettings />); });
    await flush();
    expect(container.querySelector('[data-testid="invoice-branding-save"]')).toBeNull();

    const retry = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('buttons.retry'))!;
    await act(async () => { retry.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flush();

    const save = container.querySelector<HTMLButtonElement>('[data-testid="invoice-branding-save"]');
    expect(save).not.toBeNull();
    // Nothing has been edited yet, so there is nothing to write.
    expect(save!.disabled).toBe(true);
    const company = container.querySelector<HTMLInputElement>('#ib-companyName')!;
    expect(company.value).toBe('Constructora Peña S.A.');
  });

  it('saves the whole form, never a set of nulls', async () => {
    getInvoiceBranding.mockResolvedValue(CONFIGURED);
    updateInvoiceBranding.mockResolvedValue({ ...CONFIGURED, phone: '2412 0000' });
    await act(async () => { root.render(<InvoiceBrandingSettings />); });
    await flush();

    const phone = container.querySelector<HTMLInputElement>('#ib-phone')!;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(phone, '2412 0000');
      phone.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const save = container.querySelector<HTMLButtonElement>('[data-testid="invoice-branding-save"]')!;
    expect(save.disabled).toBe(false);
    await act(async () => { save.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flush();

    expect(updateInvoiceBranding).toHaveBeenCalledTimes(1);
    expect(updateInvoiceBranding.mock.calls[0][0]).toMatchObject({
      companyName: 'Constructora Peña S.A.',
      contactName: 'Ing. Marisol Peña',
      email: 'cobros@constructorapenna.com',
      phone: '2412 0000',
    });
  });

  it('says so when the tenant has no letterhead at all', async () => {
    getInvoiceBranding.mockResolvedValue({
      configured: false, companyName: null, contactName: null,
      address: null, email: null, phone: null, hasLogo: false,
    });
    await act(async () => { root.render(<InvoiceBrandingSettings />); });
    await flush();
    expect(container.querySelector('[data-testid="invoice-branding-empty-notice"]')).not.toBeNull();
  });

  it('treats a row wiped to nulls as "no letterhead", not as configured', async () => {
    // What the old bug left behind: the row exists, so `configured` is true,
    // but the header it prints is blank.
    getInvoiceBranding.mockResolvedValue({
      configured: true, companyName: null, contactName: null,
      address: null, email: null, phone: null, hasLogo: false,
    });
    await act(async () => { root.render(<InvoiceBrandingSettings />); });
    await flush();
    expect(container.querySelector('[data-testid="invoice-branding-empty-notice"]')).not.toBeNull();
  });
});
