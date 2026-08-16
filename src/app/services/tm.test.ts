// BuildTrack — the T&M client calls the endpoint the backend actually exposes,
// on the surface the caller asked for.
//
// The thing worth guarding here is the split: the site half hangs off
// `/supervisor/` (SUPERVISOR + ADMIN) and the office half off `/admin/`
// (ADMIN + FINANCE). Crossing them does not fail loudly in a browser — it
// fails as a 403 for one role and works for another, which is the kind of bug
// that reaches a customer.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  convertTmTicket,
  createTmTicket,
  getFieldTmPending,
  getOfficeTmPending,
  listFieldTmTickets,
  listOfficeTmTickets,
  requestTmSignature,
  revokeTmSignature,
  signTokenFromUrl,
  updateTmTicket,
} from './tm';

const fetchMock = vi.fn();

function jsonOnce(body: unknown = {}) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

/** The URL path the client asked for, without the configured origin. */
function calledPath(): string {
  const url = String(fetchMock.mock.calls[0][0]);
  return url.replace(/^https?:\/\/[^/]+/, '');
}

function calledInit(): RequestInit {
  return (fetchMock.mock.calls[0][1] ?? {}) as RequestInit;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the site surface talks to /supervisor/tm-tickets', () => {
  it('creates a ticket there', async () => {
    jsonOnce({ id: 1 });
    await createTmTicket({
      projectId: 7,
      description: 'Cambio de madera podrida',
      workDate: '2026-08-10',
      workerCount: 3,
      hours: '7.5',
      hourlyRate: '20.00',
    });

    expect(calledPath()).toBe('/api/v1/supervisor/tm-tickets');
    expect(calledInit().method).toBe('POST');
  });

  it('sends money as decimal strings, never as numbers', async () => {
    jsonOnce({ id: 1 });
    await createTmTicket({
      projectId: 7,
      description: 'x',
      workDate: '2026-08-10',
      workerCount: 1,
      hours: '7.50',
      hourlyRate: '20.00',
      material: '125.50',
    });

    const body = JSON.parse(String(calledInit().body));
    expect(body.hourlyRate).toBe('20.00');
    expect(body.material).toBe('125.50');
    expect(body.hours).toBe('7.50');
    expect(typeof body.hourlyRate).toBe('string');
  });

  it('passes the filters it was given, and omits the ones it was not', async () => {
    jsonOnce([]);
    await listFieldTmTickets({ projectId: 12, status: 'PENDING_SIGNATURE' });
    expect(calledPath())
      .toBe('/api/v1/supervisor/tm-tickets?projectId=12&status=PENDING_SIGNATURE');

    fetchMock.mockReset();
    jsonOnce([]);
    await listFieldTmTickets();
    expect(calledPath()).toBe('/api/v1/supervisor/tm-tickets');
  });

  it('asks for and withdraws the signature on the same path', async () => {
    jsonOnce({ id: 5 });
    await requestTmSignature(5);
    expect(calledPath()).toBe('/api/v1/supervisor/tm-tickets/5/signature-request');
    expect(calledInit().method).toBe('POST');

    fetchMock.mockReset();
    jsonOnce({ id: 5 });
    await revokeTmSignature(5);
    expect(calledPath()).toBe('/api/v1/supervisor/tm-tickets/5/signature-request');
    expect(calledInit().method).toBe('DELETE');
  });

  it('edits with PATCH, because an omitted field must keep its value', async () => {
    jsonOnce({ id: 5 });
    await updateTmTicket(5, { description: 'corregido' });
    expect(calledInit().method).toBe('PATCH');
    expect(JSON.parse(String(calledInit().body))).toEqual({ description: 'corregido' });
  });

  it('reads the pending summary from the site surface', async () => {
    jsonOnce({ ticketCount: 0, totalPending: 0, oldestAgeDays: 0, tickets: [] });
    await getFieldTmPending(3);
    expect(calledPath()).toBe('/api/v1/supervisor/tm-tickets/pending?projectId=3');
  });
});

describe('the office surface talks to /admin/tm-tickets', () => {
  it('lists there, not on the site path', async () => {
    jsonOnce([]);
    await listOfficeTmTickets({ status: 'SIGNED' });
    expect(calledPath()).toBe('/api/v1/admin/tm-tickets?status=SIGNED');
    expect(calledPath()).not.toContain('/supervisor/');
  });

  it('reads its own pending summary', async () => {
    jsonOnce({ ticketCount: 0, totalPending: 0, oldestAgeDays: 0, tickets: [] });
    await getOfficeTmPending();
    expect(calledPath()).toBe('/api/v1/admin/tm-tickets/pending');
  });

  it('converts through POST /{id}/convert', async () => {
    jsonOnce({ id: 9 });
    await convertTmTicket(9, { changeOrderNumber: 'OC-42' });
    expect(calledPath()).toBe('/api/v1/admin/tm-tickets/9/convert');
    expect(calledInit().method).toBe('POST');
    expect(JSON.parse(String(calledInit().body))).toEqual({ changeOrderNumber: 'OC-42' });
  });

  it('converts with an empty body when no number was given', async () => {
    jsonOnce({ id: 9 });
    await convertTmTicket(9);
    expect(JSON.parse(String(calledInit().body))).toEqual({});
  });
});

describe('signTokenFromUrl', () => {
  it('takes the token out of the link the server minted', () => {
    // The server builds `<publicBaseUrl>/sign/<token>` and its own tests read
    // it back with substringAfterLast("/sign/"). Same rule here.
    expect(signTokenFromUrl('https://app.example.com/sign/abc.def.ghi')).toBe('abc.def.ghi');
    expect(signTokenFromUrl('http://localhost:5180/sign/tok')).toBe('tok');
  });

  it('survives a configured base path that also contains /sign/', () => {
    expect(signTokenFromUrl('https://x.example/sign/proxy/sign/real-token'))
      .toBe('real-token');
  });

  it('is null when there is no link to read', () => {
    expect(signTokenFromUrl(null)).toBeNull();
    expect(signTokenFromUrl(undefined)).toBeNull();
    expect(signTokenFromUrl('')).toBeNull();
    expect(signTokenFromUrl('https://app.example.com/sign/')).toBeNull();
    expect(signTokenFromUrl('https://app.example.com/whatever')).toBeNull();
  });
});
