import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally before importing the module under test
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// We need to reset modules between tests so the singleton `refreshPromise` resets
let refreshIfNeeded: typeof import('./refresh-coordinator').refreshIfNeeded;

function jsonResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  fetchMock.mockReset();

  // Re-import fresh module to reset the singleton refreshPromise
  vi.resetModules();
  const mod = await import('./refresh-coordinator');
  refreshIfNeeded = mod.refreshIfNeeded;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('refreshIfNeeded', () => {
  it('calls POST /api/v1/auth/refresh with credentials include', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { role: 'ADMIN', expiresInMinutes: 480 }));

    const result = await refreshIfNeeded();

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/auth/refresh');
    expect(opts.method).toBe('POST');
    expect(opts.credentials).toBe('include');
    // Body is empty (refresh token is sent via HttpOnly cookie)
    expect(opts.body).toBe('{}');
  });

  it('returns true when the refresh endpoint returns 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { role: 'WORKER', expiresInMinutes: 480 }));

    const result = await refreshIfNeeded();
    expect(result).toBe(true);
  });

  it('returns false when the refresh endpoint returns 401', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'REFRESH_FAILED' }));

    const result = await refreshIfNeeded();
    expect(result).toBe(false);
  });

  it('returns false when fetch throws a network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await refreshIfNeeded();
    expect(result).toBe(false);
  });

  it('coalesces concurrent calls into a single fetch request', async () => {
    // Use a deferred promise so we control when fetch resolves
    let resolveFetch!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>(resolve => {
        resolveFetch = resolve;
      }),
    );

    // Fire 5 concurrent calls
    const promises = Array.from({ length: 5 }, () => refreshIfNeeded());

    // Only one fetch should be in flight
    expect(fetchMock).toHaveBeenCalledOnce();

    // Resolve the single fetch
    resolveFetch(jsonResponse(200, { role: 'WORKER', expiresInMinutes: 480 }));

    const results = await Promise.all(promises);

    // All 5 should get true
    expect(results).toEqual([true, true, true, true, true]);
    // Still only 1 fetch
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('resets after a completed refresh so the next call triggers a new fetch', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { role: 'WORKER', expiresInMinutes: 480 }));

    await refreshIfNeeded();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call should succeed with its own fetch (the singleton was cleared)
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { role: 'ADMIN', expiresInMinutes: 480 }));

    const result = await refreshIfNeeded();
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
