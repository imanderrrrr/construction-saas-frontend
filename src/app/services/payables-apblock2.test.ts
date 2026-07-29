import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Global fetch mock (mirrors payables-apblock1.test.ts style).
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { convertPayableToInvoice, updatePayableDates, deletePayable } from './finance';

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

describe('convertPayableToInvoice', () => {
  it('PATCHes /convert-to-invoice with the invoice number', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 7, documentType: 'INVOICE', invoiceNumber: 'FAC-1' }));
    await convertPayableToInvoice(7, 'FAC-1');
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/7/convert-to-invoice');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body as string)).toEqual({ invoiceNumber: 'FAC-1' });
  });
});

describe('updatePayableDates', () => {
  it('PATCHes /dates with received and due dates', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 3, receivedDate: '2026-06-01', dueDate: '2026-06-30' }));
    await updatePayableDates(3, { receivedDate: '2026-06-01', dueDate: '2026-06-30' });
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/3/dates');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body as string)).toEqual({ receivedDate: '2026-06-01', dueDate: '2026-06-30' });
  });
});

describe('deletePayable', () => {
  it('DELETEs the payable', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204));
    await deletePayable(9);
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/9');
    expect(opts.method).toBe('DELETE');
  });
});
