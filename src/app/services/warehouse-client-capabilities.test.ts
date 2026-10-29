import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The server keeps a rejected tool (RETURN_PENDING) and a lost one (LOST) in
// the worker's custody, and only lists them for a client that says it shows
// them: the 2.2.0 app in the stores filed both under «Asignadas» (B2, second
// warehouse audit, 2026-10-28). «Mis herramientas» shows them with their
// CustodyStatus chip, so both reads of that view declare it.
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { getWorkerTools, getWorkerToolSummary } from './warehouse';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

function lastCall() {
  const [url, opts] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: String(url), headers: (opts as RequestInit).headers as Record<string, string> };
}

beforeEach(() => { fetchMock.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('worker tools declare the custody states', () => {
  it('GET /worker/tools sends X-Client-Capabilities: TOOL_CUSTODY_STATES', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await getWorkerTools();
    const { url, headers } = lastCall();
    expect(url).toContain('/api/v1/worker/tools');
    expect(headers['X-Client-Capabilities']).toBe('TOOL_CUSTODY_STATES');
  });

  it('GET /worker/tools/summary sends it too', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ total: 0 }));
    await getWorkerToolSummary();
    const { url, headers } = lastCall();
    expect(url).toContain('/api/v1/worker/tools/summary');
    expect(headers['X-Client-Capabilities']).toBe('TOOL_CUSTODY_STATES');
  });
});
