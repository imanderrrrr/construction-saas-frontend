import { describe, it, expect } from 'vitest';
import { drainPages } from '../../lib/paging';

// ════════════════════════════════════════════════════════════════════════
// The approvals screen must see every record in the chosen range.
//
// Same failure as the payables window, in the screen that decides whether
// people get paid. SupervisorApprovals fetched ONE page (size=100) sorted by
// workDate DESC and has no pagination UI at all — no page controls, no total.
// Whatever fell past row 100 simply did not exist as far as the supervisor
// could tell.
//
// Two things on that screen are computed in the browser over the fetched rows:
//
//   • the PENDING filter, which deliberately bypasses the server-side status
//     filter (a record can read APPROVED yet still hold pending events), and
//   • the pending counter, `records.filter(r => r.pendingEventCount > 0).length`
//
// so a short fetch does not just hide rows — it under-reports how much work is
// waiting, with a number that looks perfectly plausible. Hours never approved
// are never paid, and never reach the project budget.
//
// Production had 380 time records against that cap of 100. Draining the range
// the user actually chose is what makes both the filter and the counter true.
// ════════════════════════════════════════════════════════════════════════

interface Row { id: number; workDate: string; pendingEventCount: number }

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

/** Production shape: 380 records, newest first, with pending ones spread through. */
const ALL_RECORDS: Row[] = Array.from({ length: 380 }, (_, i) => ({
  id: i,
  workDate: `2026-05-${String(28 - (i % 28)).padStart(2, '0')}`,
  // 24 pending overall — most recent, but one sits far down the list at row 300.
  pendingEventCount: i < 23 || i === 300 ? 1 : 0,
}));

const TOTAL_PENDING = ALL_RECORDS.filter(r => r.pendingEventCount > 0).length;

describe('supervisor approvals — pending work must not hide past the first page', () => {
  it('reproduces the bug: one page of 100 under-reports the pending count', async () => {
    const { fetchPage } = pagedSource(ALL_RECORDS);

    const firstPageOnly = (await fetchPage(0, 100)).content;
    const seenPending = firstPageOnly.filter(r => r.pendingEventCount > 0);

    expect(TOTAL_PENDING).toBe(24);
    expect(seenPending).toHaveLength(23); // the record at row 300 is invisible
    expect(firstPageOnly).toHaveLength(100); // ...and 280 records never arrive
  });

  it('fixes it: draining the range surfaces every pending record', async () => {
    const { fetchPage, calls } = pagedSource(ALL_RECORDS);

    const rows = await drainPages(fetchPage);
    const pending = rows.filter(r => r.pendingEventCount > 0);

    expect(rows).toHaveLength(380);
    expect(pending).toHaveLength(TOTAL_PENDING); // counter now tells the truth
    expect(calls).toHaveLength(2); // 200 + 180
  });

  it('costs a single request for the default one-week range', async () => {
    // The screen defaults to Monday-of-this-week → today, which is what keeps
    // the sweep bounded: a normal week is far short of one page.
    const { fetchPage, calls } = pagedSource(ALL_RECORDS.slice(0, 40));

    expect(await drainPages(fetchPage)).toHaveLength(40);
    expect(calls).toHaveLength(1);
  });
});
