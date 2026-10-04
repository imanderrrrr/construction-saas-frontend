import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPlatformSession, writePlatformSession } from './platformAuthStorage';
import type { PlatformSession } from '../types';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('VITE_PLATFORM_API_ORIGIN', '');
  sessionStorage.clear();
  fetchMock.mockReset().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function session() {
  writePlatformSession({ accessToken: 'platform-token', expiresAt: Date.now() + 60_000 } as PlatformSession);
}

describe.each([false, true])('platform API routing (PROD=%s)', (prod) => {
  beforeEach(() => vi.stubEnv('PROD', prod));

  it('uses a separate same-origin namespace and omits cookies', async () => {
    // The tenant URL cannot silently redirect the platform client to another API.
    vi.stubEnv('VITE_API_URL', 'https://tenant.example.com');
    session();
    const { platformApi } = await import('./platformApi');
    await platformApi('/platform/tenants?page=2');
    expect(fetchMock).toHaveBeenCalledWith('/api/platform/tenants?page=2', expect.objectContaining({
      credentials: 'omit',
      headers: expect.objectContaining({ Authorization: 'Bearer platform-token' }),
    }));
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-XSRF-TOKEN');
  });

  it('honors an explicit origin and removes trailing slashes', async () => {
    vi.stubEnv('VITE_PLATFORM_API_ORIGIN', ' https://api.example.com/// ');
    const { platformApi } = await import('./platformApi');
    await platformApi('/platform/auth/login', { skipAuth: true, method: 'POST', body: { email: 'owner@example.com' } });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/platform/auth/login', expect.objectContaining({
      method: 'POST', credentials: 'omit', body: '{"email":"owner@example.com"}',
    }));
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });
});

it('keeps auth failure behavior and clears an expired bearer session', async () => {
  session();
  fetchMock.mockResolvedValue(new Response('{"code":"INVALID_TOKEN"}', { status: 401 }));
  const { platformApi } = await import('./platformApi');
  await expect(platformApi('/platform/me')).rejects.toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
  expect(readPlatformSession()).toBeNull();
});
