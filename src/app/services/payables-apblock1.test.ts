import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import {
  updatePayableAmount, markPayableUnpaid, voidPayablePayment,
  listPayableAttachments, uploadPayableAttachment, deletePayableAttachment,
  payableAttachmentUrl,
} from './finance';

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

describe('updatePayableAmount', () => {
  it('PATCHes /amount with dollars converted to cents', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 7, amount: 42.5, status: 'partial' }));
    await updatePayableAmount(7, { amount: 42.5, reason: 'fix' });
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/7/amount');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body as string)).toEqual({ reason: 'fix', amountCents: 4250 });
  });
});

describe('markPayableUnpaid', () => {
  it('POSTs /unpay with the reason', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 3, status: 'pending' }));
    await markPayableUnpaid(3, 'marcada por error');
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/3/unpay');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({ reason: 'marcada por error' });
  });
});

describe('voidPayablePayment', () => {
  it('POSTs to the payment void endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 3, status: 'partial' }));
    await voidPayablePayment(3, 99);
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/3/payments/99/void');
    expect(opts.method).toBe('POST');
  });
});

describe('payable attachments', () => {
  it('lists attachments via GET', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await listPayableAttachments(5);
    expect(lastCall().url).toContain('/api/v1/finance/payables/5/attachments');
  });

  it('uploads via multipart POST carrying the file part', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 1, payableId: 5 }));
    const file = new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' });
    await uploadPayableAttachment(5, file);
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/5/attachments');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeInstanceOf(FormData);
    expect((opts.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('deletes via DELETE', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204));
    await deletePayableAttachment(5, 1);
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/5/attachments/1');
    expect(opts.method).toBe('DELETE');
  });

  it('builds an authenticated file URL', () => {
    expect(payableAttachmentUrl(5, 1)).toContain('/api/v1/finance/payables/5/attachments/1/file');
  });
});
