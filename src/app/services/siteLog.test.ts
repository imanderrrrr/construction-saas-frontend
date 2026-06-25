import { describe, it, expect, vi, beforeEach } from 'vitest';

// Keep the real ApiError + getBaseUrl; mock only the network primitives.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, api: vi.fn(), apiMultipart: vi.fn() };
});

import { api, apiMultipart, ApiError } from '../lib/api';
import {
  getSiteLogByDate,
  uploadSiteLogPhoto,
  siteLogPhotoUrl,
  saveSiteLog,
  type SiteLogPayload,
} from './siteLog';

const apiMock = vi.mocked(api);
const multipartMock = vi.mocked(apiMultipart);

beforeEach(() => {
  apiMock.mockReset();
  multipartMock.mockReset();
});

describe('siteLog service', () => {
  it('getSiteLogByDate returns null when the backend 404s (empty state)', async () => {
    apiMock.mockRejectedValueOnce(new ApiError(404, 'not found'));
    await expect(getSiteLogByDate(1, '2026-06-25')).resolves.toBeNull();
  });

  it('getSiteLogByDate rethrows non-404 errors', async () => {
    apiMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    await expect(getSiteLogByDate(1, '2026-06-25')).rejects.toBeInstanceOf(ApiError);
  });

  it('saveSiteLog POSTs the payload as JSON to the project-scoped endpoint', async () => {
    apiMock.mockResolvedValueOnce({} as never);
    const payload: SiteLogPayload = {
      workDate: '2026-06-25', weather: 'SOLEADO', temperatureC: 28, notes: null,
      status: 'DRAFT', attendance: [], tasksDone: [],
    };
    await saveSiteLog(3, payload);
    expect(apiMock).toHaveBeenCalledWith('/api/v1/projects/3/site-logs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('uploadSiteLogPhoto sends a multipart photo part and optional caption', async () => {
    multipartMock.mockResolvedValueOnce({} as never);
    const file = new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' });
    await uploadSiteLogPhoto(7, file, 'Cimientos');
    expect(multipartMock).toHaveBeenCalledWith('/api/v1/site-logs/7/photos', 'POST', expect.any(FormData));
    const fd = multipartMock.mock.calls[0][2] as FormData;
    expect(fd.get('photo')).toBeInstanceOf(File);
    expect(fd.get('caption')).toBe('Cimientos');
  });

  it('uploadSiteLogPhoto omits a blank caption', async () => {
    multipartMock.mockResolvedValueOnce({} as never);
    const file = new File([new Uint8Array([1])], 'y.png', { type: 'image/png' });
    await uploadSiteLogPhoto(7, file, '   ');
    const fd = multipartMock.mock.calls[0][2] as FormData;
    expect(fd.get('caption')).toBeNull();
  });

  it('siteLogPhotoUrl builds the authenticated download path', () => {
    expect(siteLogPhotoUrl(7, 9)).toContain('/api/v1/site-logs/7/photos/9');
  });
});
