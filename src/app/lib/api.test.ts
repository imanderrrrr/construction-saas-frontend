import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Global mocks ──────────────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Mock refresh-coordinator so we can control its behaviour independently
vi.mock('./refresh-coordinator', () => ({
  refreshIfNeeded: vi.fn(),
}));

import { refreshIfNeeded } from './refresh-coordinator';
import {
  api, apiMultipart, ApiError,
  getStoredRole, getStoredUsername,
  getSessionMeta, isAuthenticated,
  clearSessionCookie, getCsrfToken,
} from './api';

const refreshMock = vi.mocked(refreshIfNeeded);

// Helpers
function jsonResponse(status: number, body?: object): Response {
  if (body === undefined) {
    return new Response(null, { status });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Set the ofjr_session cookie (simulates server-set session metadata). */
function setSessionCookie(role: string, username: string): void {
  const json = JSON.stringify({ role, username });
  document.cookie = `ofjr_session=${encodeURIComponent(json)}; Path=/`;
}

/** Set the XSRF-TOKEN cookie (simulates Spring Security CSRF cookie). */
function setCsrfCookie(token: string): void {
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(token)}; Path=/`;
}

beforeEach(() => {
  // Clear all cookies
  document.cookie.split(';').forEach(c => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  });
  fetchMock.mockReset();
  refreshMock.mockReset();
  // Prevent location redirect from throwing in jsdom
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Cookie-based Session Helpers ─────────────────────────────────
describe('cookie session helpers', () => {
  it('getSessionMeta returns role and username from ofjr_session cookie', () => {
    setSessionCookie('ADMIN', 'alice');

    const meta = getSessionMeta();
    expect(meta?.role).toBe('ADMIN');
    expect(meta?.username).toBe('alice');
  });

  it('getStoredRole returns role from session cookie', () => {
    setSessionCookie('WORKER', 'bob');
    expect(getStoredRole()).toBe('WORKER');
  });

  it('getStoredUsername returns username from session cookie', () => {
    setSessionCookie('ADMIN', 'alice');
    expect(getStoredUsername()).toBe('alice');
  });

  it('isAuthenticated returns true when session cookie exists', () => {
    setSessionCookie('ADMIN', 'alice');
    expect(isAuthenticated()).toBe(true);
  });

  it('isAuthenticated returns false when no session cookie', () => {
    expect(isAuthenticated()).toBe(false);
  });

  it('clearSessionCookie removes session cookie', () => {
    setSessionCookie('ADMIN', 'alice');
    expect(isAuthenticated()).toBe(true);

    clearSessionCookie();
    expect(isAuthenticated()).toBe(false);
    expect(getStoredRole()).toBeNull();
    expect(getStoredUsername()).toBeNull();
  });

  it('getSessionMeta returns null for malformed cookie', () => {
    document.cookie = 'ofjr_session=not-valid-json; Path=/';
    expect(getSessionMeta()).toBeNull();
  });
});

// ── CSRF Token ──────────────────────────────────────────────────
describe('CSRF token', () => {
  it('getCsrfToken reads from XSRF-TOKEN cookie', () => {
    setCsrfCookie('csrf-value-123');
    expect(getCsrfToken()).toBe('csrf-value-123');
  });

  it('getCsrfToken returns null when no CSRF cookie', () => {
    expect(getCsrfToken()).toBeNull();
  });
});

// ── api() — happy paths ──────────────────────────────────────────
describe('api() — success', () => {
  it('returns parsed JSON on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: 1 }));

    const result = await api('/api/v1/projects');

    expect(result).toEqual({ id: 1 });
  });

  it('sends credentials include (HttpOnly cookies)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await api('/api/v1/projects');

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.credentials).toBe('include');
  });

  it('does NOT send Authorization header (tokens are in HttpOnly cookies)', async () => {
    setSessionCookie('ADMIN', 'user');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await api('/api/v1/projects');

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['Authorization']).toBeUndefined();
  });

  it('sends CSRF header on POST requests', async () => {
    setCsrfCookie('my-csrf-token');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await api('/api/v1/projects', { method: 'POST', body: '{}' });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['X-XSRF-TOKEN']).toBe('my-csrf-token');
  });

  it('does NOT send CSRF header on GET requests', async () => {
    setCsrfCookie('my-csrf-token');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await api('/api/v1/projects');

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['X-XSRF-TOKEN']).toBeUndefined();
  });

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    const result = await api('/api/v1/projects/1', { method: 'DELETE' });

    expect(result).toBeUndefined();
  });
});

// ── api() — 401 auto-refresh ────────────────────────────────────
describe('api() — 401 auto-refresh', () => {
  it('on 401, calls refreshIfNeeded and retries on success', async () => {
    setSessionCookie('WORKER', 'user');

    // First call → 401, second call (retry) → 200
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: 'TOKEN_EXPIRED' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' }));

    refreshMock.mockResolvedValueOnce(true);

    const result = await api('/api/v1/projects');

    expect(result).toEqual({ data: 'ok' });
    expect(refreshMock).toHaveBeenCalledOnce();
    // Retry should also use credentials: 'include' (cookies, not Bearer)
    const [, retryOpts] = fetchMock.mock.calls[1];
    expect(retryOpts.credentials).toBe('include');
  });

  it('on 401 + failed refresh, clears session cookie and redirects', async () => {
    setSessionCookie('WORKER', 'user');

    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
    refreshMock.mockResolvedValueOnce(false);

    await expect(api('/api/v1/projects')).rejects.toThrow(ApiError);

    expect(isAuthenticated()).toBe(false);
    expect(window.location.href).toBe('/?session=expired');
  });

  it('does NOT attempt refresh for /auth/login 401', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'BAD_CREDS' }));

    await expect(api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'x', password: 'y' }),
    })).rejects.toThrow(ApiError);

    // Refresh should never be called for login endpoint
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('does NOT attempt refresh for /auth/refresh 401', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(api('/api/v1/auth/refresh', {
      method: 'POST',
      body: '{}',
    })).rejects.toThrow(ApiError);

    expect(refreshMock).not.toHaveBeenCalled();
  });
});

// ── api() — other errors ─────────────────────────────────────────
describe('api() — error handling', () => {
  it('throws ApiError(403) for forbidden', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, {}));

    await expect(api('/api/v1/admin')).rejects.toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('throws ApiError with server message on 500', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { message: 'Internal error' }),
    );

    await expect(api('/api/v1/projects')).rejects.toThrow('Internal error');
  });
});

// ── apiMultipart() — 401 auto-refresh ────────────────────────────
describe('apiMultipart() — 401 auto-refresh', () => {
  it('retries upload after successful refresh', async () => {
    setSessionCookie('WORKER', 'user');
    const formData = new FormData();

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { uploaded: true }));

    refreshMock.mockResolvedValueOnce(true);

    const result = await apiMultipart('/api/v1/receipts', 'POST', formData);

    expect(result).toEqual({ uploaded: true });
    expect(refreshMock).toHaveBeenCalledOnce();

    // Retry should use credentials: 'include'
    const [, retryOpts] = fetchMock.mock.calls[1];
    expect(retryOpts.credentials).toBe('include');
  });

  it('clears session on failed refresh', async () => {
    setSessionCookie('WORKER', 'user');
    const formData = new FormData();

    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
    refreshMock.mockResolvedValueOnce(false);

    await expect(
      apiMultipart('/api/v1/receipts', 'POST', formData),
    ).rejects.toThrow(ApiError);

    expect(isAuthenticated()).toBe(false);
    expect(window.location.href).toBe('/?session=expired');
  });

  it('sends CSRF header on upload', async () => {
    setCsrfCookie('upload-csrf');
    const formData = new FormData();

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await apiMultipart('/api/v1/receipts', 'POST', formData);

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['X-XSRF-TOKEN']).toBe('upload-csrf');
  });
});
