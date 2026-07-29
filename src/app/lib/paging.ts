// Draining paged endpoints.
//
// A screen that filters, totals or counts in the browser needs EVERY row. Given
// one page it still produces a number — one that looks perfectly normal and is
// wrong, with no error to give it away. That is how seven paid invoices once
// resurfaced as a phantom "labor" figure on a finished project, and how pending
// time records can sit unreviewed past the first page.
//
// Bound a sweep with the caller's own filters (a date range, a project, a
// status) — never with a row cap. A cap that stops quietly is the bug this
// exists to remove.

/** The part of a paged response this helper needs; every service's page type fits. */
export interface PagedLike<T> {
  content: T[];
  totalPages: number;
}

/** Rows per request while sweeping. */
const SWEEP_PAGE_SIZE = 200;

/**
 * Collect every page of a paged endpoint into one array.
 *
 * Stops on the server's reported page count; an empty page is the backstop so a
 * wrong totalPages can never spin this forever.
 */
export async function drainPages<T>(
  fetchPage: (page: number, size: number) => Promise<PagedLike<T>>,
): Promise<T[]> {
  const all: T[] = [];
  let page = 0;
  for (;;) {
    const res = await fetchPage(page, SWEEP_PAGE_SIZE);
    all.push(...res.content);
    page += 1;
    if (res.content.length === 0 || page >= res.totalPages) return all;
  }
}
