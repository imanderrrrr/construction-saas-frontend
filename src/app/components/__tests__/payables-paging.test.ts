import { describe, it, expect } from 'vitest';
import { drainPages } from '../../lib/paging';

// ════════════════════════════════════════════════════════════════════════
// Paged finance lists must be drained, not sampled.
//
// Regression coverage for the production bug where a finished project showed
// a phantom "Mano de Obra" of $4,745.20 that came from no labor at all.
//
// Root cause: the finance screens fetched ONE page (size=200) of the tenant's
// bills — ordered by due date DESC across every project — and then filtered by
// project in the browser. Once the tenant passed 200 bills, the oldest ones
// fell outside the window. A finished project is precisely the one whose bills
// are oldest, so 7 of its 40 paid invoices never reached the browser.
//
// The screen therefore saw $14,031.01 of payables against a consumed budget of
// $18,776.21. Because labor is the residual (consumed − expenses − payables),
// the 7 missing invoices reappeared relabelled as labor.
//
// The ledger was never wrong: consumed matched the bills exactly. Only the
// fetch was short. Draining every page restores the invariant
//   consumed === approvedExpenses + Σ payable.paidAmount + payroll
// and the phantom labor collapses to zero.
// ════════════════════════════════════════════════════════════════════════


/** A fake paged endpoint over a fixed row set, mirroring the server contract. */
function pagedSource<T>(rows: T[]) {
  const calls: { page: number; size: number }[] = [];
  const fetchPage = async (page: number, size: number) => {
    calls.push({ page, size });
    const from = page * size;
    return {
      content: rows.slice(from, from + size),
      page,
      size,
      totalElements: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / size)),
    };
  };
  return { fetchPage, calls };
}

describe('drainPages', () => {
  it('returns every row when the set spans more than one page', async () => {
    const rows = Array.from({ length: 271 }, (_, i) => ({ id: i }));
    const { fetchPage, calls } = pagedSource(rows);

    const all = await drainPages(fetchPage);

    expect(all).toHaveLength(271);
    expect(all[all.length - 1]).toEqual({ id: 270 });
    expect(calls).toHaveLength(2); // 200 + 71
  });

  it('costs a single request when the set fits one page', async () => {
    const { fetchPage, calls } = pagedSource(Array.from({ length: 40 }, (_, i) => ({ id: i })));

    expect(await drainPages(fetchPage)).toHaveLength(40);
    expect(calls).toHaveLength(1);
  });

  it('stops on an empty page even when totalPages is wrong', async () => {
    // Backstop against a server that over-reports totalPages: without it the
    // sweep would loop forever on an endless run of empty pages.
    const fetchPage = async (page: number, size: number) => ({
      content: page === 0 ? [{ id: 1 }] : [],
      page,
      size,
      totalElements: 999,
      totalPages: 999,
    });

    expect(await drainPages(fetchPage)).toHaveLength(1);
  });
});
