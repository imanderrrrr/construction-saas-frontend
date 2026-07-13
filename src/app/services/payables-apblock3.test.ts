import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Global fetch mock (mirrors payables-apblock5.test.ts style).
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { updatePayablePayment } from './finance';
import { resolveMethod, splitMethod } from '../components/PayableCommon';

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

describe('updatePayablePayment (AP Block 3)', () => {
  it('PATCHes /payments/{paymentId} with method and date', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 7, payments: [{ id: 3, method: 'Credit card', date: '2026-07-15' }] }));
    await updatePayablePayment(7, 3, { method: 'Credit card', date: '2026-07-15' });
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/7/payments/3');
    expect(url).not.toContain('/void');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body as string)).toEqual({ method: 'Credit card', date: '2026-07-15' });
  });

  it('supports a partial update (method only)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 7, payments: [{ id: 3, method: 'Cash' }] }));
    await updatePayablePayment(7, 3, { method: 'Cash' });
    const { opts } = lastCall();
    expect(JSON.parse(opts.body as string)).toEqual({ method: 'Cash' });
  });

  it('sends a custom "Other" free-text method verbatim', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 7, payments: [{ id: 3, method: 'Crypto (USDT)' }] }));
    await updatePayablePayment(7, 3, { method: 'Crypto (USDT)', date: '2026-07-15' });
    const { opts } = lastCall();
    expect(JSON.parse(opts.body as string)).toEqual({ method: 'Crypto (USDT)', date: '2026-07-15' });
  });
});

describe('payment-method "Other" free-text helpers (AP Block 3)', () => {
  it('resolveMethod returns the preset value as-is', () => {
    expect(resolveMethod('Credit card', '')).toBe('Credit card');
    expect(resolveMethod('Bank transfer', 'ignored')).toBe('Bank transfer');
  });

  it('resolveMethod returns the trimmed custom text when "Other" is chosen', () => {
    expect(resolveMethod('Other', '  Crypto (USDT) ')).toBe('Crypto (USDT)');
  });

  it('resolveMethod returns "" for "Other" with blank text (drives the non-empty guard)', () => {
    expect(resolveMethod('Other', '   ')).toBe('');
  });

  it('splitMethod maps a preset back to {preset, ""}', () => {
    expect(splitMethod('Credit card')).toEqual({ method: 'Credit card', otherText: '' });
  });

  it('splitMethod maps a custom method to {"Other", custom} so the edit dialog pre-fills the text box', () => {
    expect(splitMethod('Crypto (USDT)')).toEqual({ method: 'Other', otherText: 'Crypto (USDT)' });
  });
});
