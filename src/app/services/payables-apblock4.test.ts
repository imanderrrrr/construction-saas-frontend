import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Global fetch mock (mirrors payables-apblock1/2.test.ts style).
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { reassignPayableProject, listPayables } from './finance';
import { deleteProject } from './projects';

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

describe('reassignPayableProject (AP Block 4)', () => {
  it('PATCHes /{id}/project with the target projectId', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 7, projectId: 12, project: 'Obra Destino' }));
    await reassignPayableProject(7, 12);
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/finance/payables/7/project');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body as string)).toEqual({ projectId: 12 });
  });

  it('surfaces the 409 error code when the bill has active payments', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { code: 'PAYABLE_HAS_ACTIVE_PAYMENTS', message: 'anulá los pagos primero' }));
    await expect(reassignPayableProject(7, 12)).rejects.toMatchObject({ code: 'PAYABLE_HAS_ACTIVE_PAYMENTS' });
  });
});

describe('listPayables projectId filter (AP Block 4)', () => {
  it('threads projectId into the query string', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    await listPayables({ projectId: 5, status: 'pending' });
    const { url } = lastCall();
    expect(url).toContain('projectId=5');
    expect(url).toContain('status=pending');
  });

  it('omits projectId when not set', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    await listPayables({ size: 200 });
    const { url } = lastCall();
    expect(url).not.toContain('projectId');
  });
});

describe('deleteProject (AP Block 4)', () => {
  it('DELETEs the project', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204));
    await deleteProject(9);
    const { url, opts } = lastCall();
    expect(url).toContain('/api/v1/admin/projects/9');
    expect(opts.method).toBe('DELETE');
  });

  it('surfaces the 409 error code when the project has active records', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { code: 'PROJECT_HAS_ACTIVE_RECORDS', message: 'tiene 2 cuenta(s) por pagar' }));
    await expect(deleteProject(9)).rejects.toMatchObject({ code: 'PROJECT_HAS_ACTIVE_RECORDS' });
  });
});
