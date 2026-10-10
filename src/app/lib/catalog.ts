// Catalogs: every option of a picker or filter, never just the first page.
//
// The server answers at most 100 rows per page whatever `size` a screen asks
// for. A screen that asked for 200 got 100 and treated them as everything:
// the 101st project, worker, client or tool simply did not exist for it
// (AUD-055). A catalog walks the pages until the server's own page count says
// it is done.
//
// The walk has a safety bound ([CATALOG_SAFETY_ROWS]) so a runaway tenant
// cannot turn one screen into thousands of requests — and when it stops there
// it says so (`truncated`), with the server's total, instead of passing a cut
// list off as complete. `lib/paging.ts#drainPages` remains for sweeps that are
// bounded by the caller's own filters.

/** Rows the server returns per page, whatever a client asks for. */
export const SERVER_PAGE_SIZE = 100;

/** Rows a catalog walk brings at most before it stops — and reports that it stopped. */
export const CATALOG_SAFETY_ROWS = 5000;

export interface CountedPage<T> {
  content: T[];
  totalPages: number;
  totalElements?: number;
}

export interface Catalog<T> {
  items: T[];
  /** The server's count of matching rows (≥ items.length). */
  total: number;
  /** True when the walk stopped at the safety bound: `items` is NOT everything. */
  truncated: boolean;
}

export async function drainCatalog<T>(
  fetchPage: (page: number, size: number) => Promise<CountedPage<T>>,
  maxRows: number = CATALOG_SAFETY_ROWS,
): Promise<Catalog<T>> {
  const items: T[] = [];
  let total = 0;
  for (let page = 0; ; page += 1) {
    const res = await fetchPage(page, SERVER_PAGE_SIZE);
    if (!Array.isArray(res?.content) || !Number.isInteger(res.totalPages) || res.totalPages < 0) {
      throw new Error('Invalid page');
    }
    items.push(...res.content);
    total = Math.max(total, res.totalElements ?? 0, items.length);
    const lastPage = res.content.length === 0 || page + 1 >= res.totalPages;
    if (lastPage) return { items, total, truncated: false };
    if (items.length >= maxRows) return { items, total, truncated: true };
  }
}
