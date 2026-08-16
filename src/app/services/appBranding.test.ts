import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  apiMultipart: vi.fn(),
  getBaseUrl: () => '',
}));

import { api, apiMultipart } from '../lib/api';
import {
  getAppBranding,
  updateAppBranding,
  uploadAppLogo,
  fetchAppLogoDataUrl,
  fetchEffectiveLogoDataUrl,
  type AppBrandingSettings,
} from './appBranding';

const apiMock = vi.mocked(api);
const apiMultipartMock = vi.mocked(apiMultipart);

const LINKED: AppBrandingSettings = {
  linkedToInvoice: true,
  displayName: null,
  hasLogo: false,
  effectiveName: 'Constructora Andes S.A.',
  effectiveHasLogo: true,
};

const UNLINKED: AppBrandingSettings = {
  linkedToInvoice: false,
  displayName: 'Andes App',
  hasLogo: true,
  effectiveName: 'Andes App',
  effectiveHasLogo: true,
};

describe('appBranding service', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMultipartMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('GETs the app-branding settings endpoint', async () => {
    apiMock.mockResolvedValueOnce(LINKED);

    const result = await getAppBranding();

    expect(apiMock).toHaveBeenCalledWith('/api/v1/settings/app-branding');
    expect(result).toEqual(LINKED);
  });

  it('PUTs the settings as JSON', async () => {
    apiMock.mockResolvedValueOnce(UNLINKED);

    await updateAppBranding({ linkedToInvoice: false, displayName: 'Andes App' });

    expect(apiMock).toHaveBeenCalledWith('/api/v1/settings/app-branding', {
      method: 'PUT',
      body: JSON.stringify({ linkedToInvoice: false, displayName: 'Andes App' }),
    });
  });

  it('sends removeLogo when asked to drop the app logo', async () => {
    apiMock.mockResolvedValueOnce(LINKED);

    await updateAppBranding({ linkedToInvoice: false, displayName: null, removeLogo: true });

    const body = JSON.parse((apiMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.removeLogo).toBe(true);
  });

  it('uploads the logo as multipart under the settings tree', async () => {
    apiMultipartMock.mockResolvedValueOnce(UNLINKED);
    const file = new File(['x'], 'logo.png', { type: 'image/png' });

    await uploadAppLogo(file);

    const [url, method, formData] = apiMultipartMock.mock.calls[0];
    expect(url).toBe('/api/v1/settings/app-branding/logo');
    expect(method).toBe('PUT');
    expect((formData as FormData).get('file')).toBe(file);
  });

  // The two logo readers are the reason this service exists separately from
  // the read-only `branding.ts`: the settings screen has to show the app's OWN
  // logo (to prove unticking the checkbox restores it) AND the live one.
  it('reads the app OWN logo from the settings tree', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    await fetchAppLogoDataUrl();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/settings/app-branding/logo', {
      credentials: 'include',
    });
  });

  it('reads the EFFECTIVE logo from the public branding endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    await fetchEffectiveLogoDataUrl();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/branding/logo', { credentials: 'include' });
  });

  it('returns null rather than throwing when a logo is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchAppLogoDataUrl()).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchEffectiveLogoDataUrl()).toBeNull();
  });
});
