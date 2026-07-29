import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Global fetch mock (mirrors payables-apblock2.test.ts style).
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { createChangeOrder, updateChangeOrder, deleteChangeOrder } from './projects';

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

describe('createChangeOrder (AP Block 5 — with number)', () => {
  it('POSTs description, signed amount and optional number', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 1, number: 'OC-1', description: 'Extra', amountCents: 5000, createdBy: 'admin', createdAt: '2026-07-11T00:00:00Z' }));
    await createChangeOrder(10, { description: 'Extra', amountCents: 5000, number: 'OC-1' });
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/admin/projects/10/change-orders');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({ description: 'Extra', amountCents: 5000, number: 'OC-1' });
  });
});

describe('updateChangeOrder (AP Block 5)', () => {
  it('PATCHes the change order with the edited number / description / amount', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 2, number: 'OC-1-REV', description: 'Expanded', amountCents: 9000, createdBy: 'admin', createdAt: '2026-07-11T00:00:00Z' }));
    await updateChangeOrder(10, 2, { description: 'Expanded', amountCents: 9000, number: 'OC-1-REV' });
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/admin/projects/10/change-orders/2');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body as string)).toEqual({ description: 'Expanded', amountCents: 9000, number: 'OC-1-REV' });
  });

  it('supports a negative (deduction) amount and clearing the number', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 2, number: null, description: 'x', amountCents: -2000, createdBy: 'admin', createdAt: '2026-07-11T00:00:00Z' }));
    await updateChangeOrder(10, 2, { amountCents: -2000, number: null });
    const { opts } = lastCall();
    expect(JSON.parse(opts.body as string)).toEqual({ amountCents: -2000, number: null });
  });
});

describe('deleteChangeOrder', () => {
  it('DELETEs the change order', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204));
    await deleteChangeOrder(10, 2);
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/admin/projects/10/change-orders/2');
    expect(opts.method).toBe('DELETE');
  });
});
