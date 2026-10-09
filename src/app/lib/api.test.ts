import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Global mocks ──────────────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Mock refresh-coordinator so we can control its behaviour independently
vi.mock('./refresh-coordinator', () => ({
  refreshSession: vi.fn(),
}));

import { refreshSession } from './refresh-coordinator';
import {
  api, apiMultipart, ApiError, NoResponseError,
  getStoredRole, getStoredUsername,
  getSessionMeta, isAuthenticated,
  clearSessionCookie, getCsrfToken,
} from './api';

const refreshMock = vi.mocked(refreshSession);

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
    value: { href: '', pathname: '/', search: '' },
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
  it('on 401, calls refreshSession and retries on success', async () => {
    setSessionCookie('WORKER', 'user');

    // First call → 401, second call (retry) → 200
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: 'TOKEN_EXPIRED' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' }));

    refreshMock.mockResolvedValueOnce('ok');

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
    refreshMock.mockResolvedValueOnce('rejected');

    await expect(api('/api/v1/projects')).rejects.toThrow(ApiError);

    expect(isAuthenticated()).toBe(false);
    expect(window.location.href).toBe('/login?session=expired&next=%2F');
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

// ── api() — 401 on anonymous / public endpoints ─────────────────
// A residual `ofjr_at` cookie from a previous session can make the
// backend answer 401 to a public endpoint before security rules
// fully apply. Public flows must NOT treat that as a global session
// expiration: redirecting to /?session=expired in the middle of the
// signup → Paddle handoff reloads the landing page and loses the form.
describe('api() — 401 on anonymous endpoints', () => {
  it('on 401 for /signup/checkout, does NOT redirect, does NOT refresh, throws ApiError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { message: 'unauthorized', code: 'SESSION_REVOKED' }),
    );

    await expect(
      api('/api/v1/signup/checkout', { method: 'POST', body: '{}' }),
    ).rejects.toMatchObject({ status: 401 });

    expect(refreshMock).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('on 401 for /signup/complete, does NOT redirect, does NOT refresh', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(
      api('/api/v1/signup/complete', { method: 'POST', body: '{}' }),
    ).rejects.toThrow(ApiError);

    expect(refreshMock).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('on 401 for legacy /auth/signup, does NOT redirect, does NOT refresh', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(
      api('/api/v1/auth/signup', { method: 'POST', body: '{}' }),
    ).rejects.toThrow(ApiError);

    expect(refreshMock).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('on 401 for /auth/password-reset/request, does NOT redirect, does NOT refresh', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(
      api('/api/v1/auth/password-reset/request', {
        method: 'POST',
        body: '{}',
      }),
    ).rejects.toThrow(ApiError);

    expect(refreshMock).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('on 401 for /auth/password-reset/confirm, does NOT redirect, does NOT refresh', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(
      api('/api/v1/auth/password-reset/confirm', {
        method: 'POST',
        body: '{}',
      }),
    ).rejects.toThrow(ApiError);

    expect(refreshMock).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('on 401 for /auth/invitations/<token>, does NOT redirect, does NOT refresh', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(
      api('/api/v1/auth/invitations/abc-token'),
    ).rejects.toThrow(ApiError);

    expect(refreshMock).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('preserves backend code on 401 for anonymous endpoints (e.g. WORKSPACE_TAKEN)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { message: 'taken', code: 'WORKSPACE_TAKEN' }),
    );

    await expect(
      api('/api/v1/signup/checkout', { method: 'POST', body: '{}' }),
    ).rejects.toMatchObject({ status: 401, code: 'WORKSPACE_TAKEN' });

    expect(window.location.href).toBe('');
  });

  it('protected endpoints still redirect on 401 + failed refresh (regression guard)', async () => {
    // Anonymous-endpoint carve-out must not weaken protected behaviour.
    setSessionCookie('WORKER', 'user');
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
    refreshMock.mockResolvedValueOnce('rejected');

    await expect(api('/api/v1/admin/projects')).rejects.toThrow(ApiError);

    expect(isAuthenticated()).toBe(false);
    expect(window.location.href).toBe('/login?session=expired&next=%2F');
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

    refreshMock.mockResolvedValueOnce('ok');

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
    refreshMock.mockResolvedValueOnce('rejected');

    await expect(
      apiMultipart('/api/v1/receipts', 'POST', formData),
    ).rejects.toThrow(ApiError);

    expect(isAuthenticated()).toBe(false);
    expect(window.location.href).toBe('/login?session=expired&next=%2F');
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

// ── No answer: the panel stops waiting, or the connection drops ──────
describe('api() — no answer', () => {
  /** A server that never answers; the request only ends when the panel aborts it. */
  function hangingFetch(): void {
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('signal is aborted without reason', 'AbortError')));
    }));
  }

  /** Starts [call] and reports whether it has settled, and with what. */
  function track(call: Promise<unknown>) {
    const state: { done: boolean; error?: unknown } = { done: false };
    call.then(() => { state.done = true; }, (e: unknown) => { state.done = true; state.error = e; });
    return state;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops waiting after 15 s by default, as a NoResponseError that says so', async () => {
    vi.useFakeTimers();
    hangingFetch();

    const call = track(api('/api/v1/projects'));
    await vi.advanceTimersByTimeAsync(14_999);
    expect(call.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(call.error).toBeInstanceOf(NoResponseError);
    expect((call.error as NoResponseError).timedOut).toBe(true);
    // The browser's own words stay the message, as before.
    expect((call.error as NoResponseError).message).toBe('signal is aborted without reason');
  });

  it('a call that asks for a longer wait is not cut at 15 s, only at its own limit', async () => {
    vi.useFakeTimers();
    hangingFetch();

    const call = track(api('/api/v1/admin/integrations/quickbooks/sync/send-ready', { method: 'POST', timeoutMs: 90_000 }));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(call.done).toBe(false);
    await vi.advanceTimersByTimeAsync(74_999);
    expect(call.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(call.error).toBeInstanceOf(NoResponseError);
    expect((call.error as NoResponseError).timedOut).toBe(true);
    // The wait is the panel's business: it never travels to fetch.
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('timeoutMs');
  });

  it('an answer inside the longer wait arrives as usual', async () => {
    vi.useFakeTimers();
    let answer!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { answer = resolve; }));

    const call = api('/api/v1/admin/integrations/quickbooks/payments/settings', { method: 'PUT', timeoutMs: 90_000 });
    await vi.advanceTimersByTimeAsync(40_000);
    answer(jsonResponse(200, { enabled: true }));

    await expect(call).resolves.toEqual({ enabled: true });
  });

  it('a dropped connection is a NoResponseError too, but not a timeout', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const error = await api('/api/v1/projects').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NoResponseError);
    expect((error as NoResponseError).timedOut).toBe(false);
    expect((error as NoResponseError).message).toBe('Failed to fetch');
  });

  it('an answer from the server, even an error, is never a NoResponseError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(502, { code: 'QUICKBOOKS_UNAVAILABLE', message: 'QuickBooks no respondió' }));

    const error = await api('/api/v1/admin/integrations/quickbooks/test', { method: 'POST' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(NoResponseError);
  });

  it('apiMultipart: a dropped connection is a NoResponseError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const error = await apiMultipart('/api/v1/finance/payables/1/attachments', 'POST', new FormData()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NoResponseError);
    expect((error as NoResponseError).timedOut).toBe(false);
  });
});
