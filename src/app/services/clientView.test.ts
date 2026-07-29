import { describe, it, expect, vi, beforeEach } from 'vitest';

// Keep the real ApiError + getBaseUrl; mock only the network primitive.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, api: vi.fn() };
});

import { api } from '../lib/api';
import {
  openClientSession,
  getClientSiteLogs,
  clientPhotoUrl,
  clientAuthHeaders,
} from './clientView';
import {
  getClientAccessStatus,
  generateClientAccess,
  revokeClientAccess,
  buildClientViewUrl,
} from './clientAccess';

const apiMock = vi.mocked(api);

beforeEach(() => {
  apiMock.mockReset();
});

describe('clientView service (public portal)', () => {
  it('openClientSession POSTs the token alone when no PIN is given', async () => {
    apiMock.mockResolvedValueOnce({} as never);
    await openClientSession('tok123');
    expect(apiMock).toHaveBeenCalledWith('/api/v1/client-view/session', {
      method: 'POST',
      body: JSON.stringify({ token: 'tok123' }),
    });
  });

  it('openClientSession includes the PIN when provided', async () => {
    apiMock.mockResolvedValueOnce({} as never);
    await openClientSession('tok123', '246810');
    expect(apiMock).toHaveBeenCalledWith('/api/v1/client-view/session', {
      method: 'POST',
      body: JSON.stringify({ token: 'tok123', pin: '246810' }),
    });
  });

  it('getClientSiteLogs sends the session token as a bearer header', async () => {
    apiMock.mockResolvedValueOnce({ content: [] } as never);
    await getClientSiteLogs('sess-abc', 2, 10);
    expect(apiMock).toHaveBeenCalledWith('/api/v1/client-view/site-logs?page=2&size=10', {
      headers: { Authorization: 'Bearer sess-abc' },
    });
  });

  it('clientPhotoUrl prefixes the portal-relative photo path with the API base', () => {
    const url = clientPhotoUrl({
      id: 5, caption: null, contentType: 'image/jpeg', createdAt: '',
      url: '/api/v1/client-view/site-logs/9/photos/5',
    });
    expect(url.endsWith('/api/v1/client-view/site-logs/9/photos/5')).toBe(true);
  });

  it('clientAuthHeaders builds the Authorization header', () => {
    expect(clientAuthHeaders('s')).toEqual({ Authorization: 'Bearer s' });
  });
});

describe('clientAccess service (admin share management)', () => {
  it('getClientAccessStatus GETs the project client-access resource', async () => {
    apiMock.mockResolvedValueOnce({} as never);
    await getClientAccessStatus(7);
    expect(apiMock).toHaveBeenCalledWith('/api/v1/projects/7/client-access');
  });

  it('generateClientAccess POSTs pin + expiry', async () => {
    apiMock.mockResolvedValueOnce({} as never);
    await generateClientAccess(7, { pin: '123456', expiresInDays: 30 });
    expect(apiMock).toHaveBeenCalledWith('/api/v1/projects/7/client-access', {
      method: 'POST',
      body: JSON.stringify({ pin: '123456', expiresInDays: 30 }),
    });
  });

  it('generateClientAccess defaults to an empty body (backend defaults apply)', async () => {
    apiMock.mockResolvedValueOnce({} as never);
    await generateClientAccess(7);
    expect(apiMock).toHaveBeenCalledWith('/api/v1/projects/7/client-access', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  });

  it('revokeClientAccess DELETEs the resource', async () => {
    apiMock.mockResolvedValueOnce(undefined as never);
    await revokeClientAccess(7);
    expect(apiMock).toHaveBeenCalledWith('/api/v1/projects/7/client-access', { method: 'DELETE' });
  });

  it('buildClientViewUrl points at the public /client-view route with the encoded token', () => {
    const url = buildClientViewUrl('a.b/c');
    expect(url).toBe(`${window.location.origin}/client-view/${encodeURIComponent('a.b/c')}`);
  });
});
