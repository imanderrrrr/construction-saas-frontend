import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  apiMultipart: vi.fn(),
  getBaseUrl: () => '',
}));

import { api, apiMultipart } from '../lib/api';
import {
  getInvoiceBranding,
  updateInvoiceBranding,
  uploadInvoiceLogo,
  loadInvoiceIssuer,
  invalidateInvoiceIssuer,
  type InvoiceBranding,
} from './invoiceBranding';

const apiMock = vi.mocked(api);
const apiMultipartMock = vi.mocked(apiMultipart);

const CONFIGURED: InvoiceBranding = {
  configured: true,
  companyName: 'Constructora Andes S.A.',
  contactName: 'María Pérez',
  address: 'Av. Central 123',
  email: 'facturas@andes.com',
  phone: '555-0100',
  hasLogo: false,
};

const UNCONFIGURED: InvoiceBranding = {
  configured: false,
  companyName: null,
  contactName: null,
  address: null,
  email: null,
  phone: null,
  hasLogo: false,
};

describe('invoiceBranding service', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMultipartMock.mockReset();
    invalidateInvoiceIssuer();
  });

  it('GETs the branding endpoint', async () => {
    apiMock.mockResolvedValueOnce(CONFIGURED);

    const result = await getInvoiceBranding();

    expect(apiMock).toHaveBeenCalledWith('/api/v1/settings/invoice-branding');
    expect(result).toEqual(CONFIGURED);
  });

  it('PUTs the template as JSON', async () => {
    apiMock.mockResolvedValueOnce(CONFIGURED);

    await updateInvoiceBranding({ companyName: 'Andes', removeLogo: false });

    expect(apiMock).toHaveBeenCalledWith('/api/v1/settings/invoice-branding', {
      method: 'PUT',
      body: JSON.stringify({ companyName: 'Andes', removeLogo: false }),
    });
  });

  it('uploads the logo as multipart PUT with a "file" part', async () => {
    apiMultipartMock.mockResolvedValueOnce({ ...CONFIGURED, hasLogo: true });
    const file = new File(['png-bytes'], 'logo.png', { type: 'image/png' });

    await uploadInvoiceLogo(file);

    expect(apiMultipartMock).toHaveBeenCalledTimes(1);
    const [endpoint, method, body] = apiMultipartMock.mock.calls[0];
    expect(endpoint).toBe('/api/v1/settings/invoice-branding/logo');
    expect(method).toBe('PUT');
    expect((body as FormData).get('file')).toBe(file);
  });

  describe('loadInvoiceIssuer', () => {
    it('maps a configured template (without logo) to the PDF issuer shape', async () => {
      apiMock.mockResolvedValueOnce(CONFIGURED);

      const issuer = await loadInvoiceIssuer();

      expect(issuer).toEqual({
        name: 'Constructora Andes S.A.',
        contact: 'María Pérez',
        address: 'Av. Central 123',
        phone: '555-0100',
        email: 'facturas@andes.com',
        logoDataUrl: null,
      });
    });

    it('returns undefined (legacy header) when the template is not configured', async () => {
      apiMock.mockResolvedValueOnce(UNCONFIGURED);

      expect(await loadInvoiceIssuer()).toBeUndefined();
    });

    it('caches the result across calls until invalidated', async () => {
      apiMock.mockResolvedValue(CONFIGURED);

      await loadInvoiceIssuer();
      await loadInvoiceIssuer();
      expect(apiMock).toHaveBeenCalledTimes(1);

      invalidateInvoiceIssuer();
      await loadInvoiceIssuer();
      expect(apiMock).toHaveBeenCalledTimes(2);
    });

    it('returns undefined on failure without caching it (next call retries)', async () => {
      apiMock.mockRejectedValueOnce(new Error('network down'));
      expect(await loadInvoiceIssuer()).toBeUndefined();

      apiMock.mockResolvedValueOnce(CONFIGURED);
      const issuer = await loadInvoiceIssuer();
      expect(issuer?.name).toBe('Constructora Andes S.A.');
    });
  });
});
