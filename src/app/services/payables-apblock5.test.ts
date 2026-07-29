import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Global fetch mock (mirrors payables-apblock2.test.ts style).
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { updatePayableInfo } from './finance';

function jsonResponse(status: number, body?: object): Response {
  if (body === undefined) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

function lastCall() {
  const [url, opts] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: String(url), opts: opts as RequestInit };
}

beforeEach(() => {
  fetchMock.mockReset();
  Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
  Object.defineProperty(document, 'cookie', { value: 'XSRF-TOKEN=tok', writable: true });
});

afterEach(() => { vi.restoreAllMocks(); });

describe('updatePayableInfo (AP Block 5)', () => {
  it('PATCHes /info with only the provided fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 5, vendor: 'Proveedor Nuevo', category: 'services' }));
    await updatePayableInfo(5, { vendor: 'Proveedor Nuevo', category: 'services' });
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/5/info');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body as string)).toEqual({ vendor: 'Proveedor Nuevo', category: 'services' });
  });

  it('sends the invoiceNumber when renumbering an invoice', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 5, invoiceNumber: 'FAC-9' }));
    await updatePayableInfo(5, { invoiceNumber: 'FAC-9' });
    const { opts } = lastCall();
    expect(JSON.parse(opts.body as string)).toEqual({ invoiceNumber: 'FAC-9' });
  });

  it('can clear description / notes by sending null', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 5, description: null, notes: null }));
    await updatePayableInfo(5, { description: null, notes: null });
    const { opts } = lastCall();
    expect(JSON.parse(opts.body as string)).toEqual({ description: null, notes: null });
  });
});
