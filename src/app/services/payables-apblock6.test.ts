import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Global fetch mock (mirrors payables-apblock2.test.ts style).
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { getPayable } from './finance';

function jsonResponse(status: number, body?: object): Response {
  if (body === undefined) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

function lastCall() {
  const [url, opts] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: String(url), opts: opts as RequestInit | undefined };
}

beforeEach(() => {
  fetchMock.mockReset();
  Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
  Object.defineProperty(document, 'cookie', { value: 'XSRF-TOKEN=tok', writable: true });
});

afterEach(() => { vi.restoreAllMocks(); });

describe('getPayable (AP Block 6 — detail view refresh)', () => {
  it('GETs /payables/{id} and returns the full bill', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      id: 7, billNumber: 'BILL-2026-007', vendor: 'Ferretería Central',
      payments: [], createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-02T08:30:00Z',
    }));
    const bill = await getPayable(7);
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/7');
    expect(opts?.method ?? 'GET').toBe('GET');
    // The detail view shows the audit timestamps — make sure they survive the round trip.
    expect(bill.createdAt).toBe('2026-07-01T12:00:00Z');
    expect(bill.updatedAt).toBe('2026-07-02T08:30:00Z');
  });

  it('propagates API errors so the page can toast them', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { message: 'Not found', code: 'NOT_FOUND' }));
    await expect(getPayable(999)).rejects.toThrow();
  });
});
