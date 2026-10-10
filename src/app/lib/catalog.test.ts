// AUD-055 — a catalog walks the server's pages (100 rows each, whatever was
// asked for) until the server's own page count says it is done, and says so
// when it had to stop at its safety bound instead of passing a cut list off
// as complete.

import { describe, expect, it, vi } from 'vitest';
import { CATALOG_SAFETY_ROWS, SERVER_PAGE_SIZE, drainCatalog } from './catalog';

function server(total: number) {
  const rows = Array.from({ length: total }, (_, i) => i + 1);
  return vi.fn(async (page: number, size: number) => {
    const s = Math.min(size, 100);
    return { content: rows.slice(page * s, page * s + s), totalPages: Math.ceil(total / s), totalElements: total };
  });
}

describe('drainCatalog', () => {
  it.each([0, 1, 99, 100, 101, 230])('brings every one of %i rows, page by page', async (total) => {
    const fetch = server(total);
    const c = await drainCatalog(fetch);
    expect(c.items).toEqual(Array.from({ length: total }, (_, i) => i + 1));
    expect(c.total).toBe(total);
    expect(c.truncated).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(Math.max(1, Math.ceil(total / SERVER_PAGE_SIZE)));
    expect(fetch.mock.calls.every(([, size]) => size === SERVER_PAGE_SIZE)).toBe(true);
  });

  it('stops at the safety bound and says it is not everything, with the real total', async () => {
    const c = await drainCatalog(server(1000), 250);
    expect(c.items.length).toBe(300);
    expect(c.total).toBe(1000);
    expect(c.truncated).toBe(true);
  });

  it('keeps the default bound large enough for a mid-size tenant', () => {
    expect(CATALOG_SAFETY_ROWS).toBeGreaterThanOrEqual(1000);
  });

  it('ends on an empty page even if the page count is wrong', async () => {
    const fetch = vi.fn(async (page: number) => ({ content: page === 0 ? [1, 2] : [], totalPages: 99, totalElements: 2 }));
    const c = await drainCatalog(fetch);
    expect(c.items).toEqual([1, 2]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('refuses a page that is not a page rather than treating it as complete', async () => {
    await expect(drainCatalog(async () => ({ content: [1] } as never))).rejects.toThrow('Invalid page');
  });
});
