import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.fn();
vi.mock('../lib/api', () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  }
  return { api: (...args: unknown[]) => apiMock(...args), ApiError };
});

import { ApiError } from '../lib/api';
import { getMyRecordsPage } from './time';

/**
 * The worker's history page. Web and backend deploy separately, so the screen
 * must keep working against a backend that does not have the paged route yet:
 * that one answers 404, and the unpaged list for the same filters is sliced in
 * the browser in the server's order (newest day first, then record id).
 */
describe('getMyRecordsPage', () => {
  beforeEach(() => apiMock.mockReset());

  const rec = (id: number, workDate: string) => ({ id, workDate });

  it('asks the paged route for exactly the filters and page it was given', async () => {
    apiMock.mockResolvedValueOnce({ content: [], page: 2, size: 10, totalElements: 0, totalPages: 0 });

    await getMyRecordsPage({ dateFrom: '2026-09-01', dateTo: '2026-09-30', page: 2, size: 10 });

    const url = new URL(String(apiMock.mock.calls[0][0]), 'http://x');
    expect(url.pathname).toBe('/api/v1/worker/time-records/page');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      dateFrom: '2026-09-01', dateTo: '2026-09-30', page: '2', size: '10',
    });
  });

  it('falls back to slicing the unpaged list when the paged route does not exist', async () => {
    apiMock
      .mockRejectedValueOnce(new ApiError(404, 'Not found'))
      .mockResolvedValueOnce([
        rec(5, '2026-09-02'), rec(3, '2026-09-03'), rec(4, '2026-09-03'), rec(1, '2026-09-01'), rec(2, '2026-09-04'),
      ]);

    const page = await getMyRecordsPage({ dateFrom: '2026-09-01', dateTo: '2026-09-30', page: 1, size: 2 });

    expect(String(apiMock.mock.calls[1][0])).toBe('/api/v1/worker/time-records?dateFrom=2026-09-01&dateTo=2026-09-30');
    // Order 2 (09-04), 3, 4 (09-03, by id), 5 (09-02), 1 (09-01) → page 1 of size 2 is [4, 5].
    expect(page.content.map(r => r.id)).toEqual([4, 5]);
    expect(page).toMatchObject({ page: 1, size: 2, totalElements: 5, totalPages: 3 });
  });

  it('does not hide any other failure behind the fallback', async () => {
    apiMock.mockRejectedValueOnce(new ApiError(500, 'boom'));

    await expect(getMyRecordsPage({ page: 0, size: 10 })).rejects.toThrow('boom');
    expect(apiMock).toHaveBeenCalledTimes(1);
  });
});
