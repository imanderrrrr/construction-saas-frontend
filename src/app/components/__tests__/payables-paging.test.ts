import { describe, it, expect } from 'vitest';
import { drainPages } from '../../services/finance';
import { computeCostDistribution } from '../BudgetManagement';

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

interface Row { id: number; projectId: number; paidAmount: number }

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

describe('the Clara Reynolds phantom-labor regression', () => {
  const PROJECT = 29;
  const CONSUMED = 18776.21; // from the backend budget ledger
  const EXPENSES = 0;        // this project has no expenses and no payroll

  // The 7 real invoices that fell outside the 200-row window — 6 weekly
  // "General Labor" bills plus one Freeman materials bill.
  const BEYOND_WINDOW = [579.20, 1685, 644, 406, 520, 479, 432];
  // The 33 that did load, summing to the $14,031.01 the screen showed.
  const WITHIN_WINDOW = [...Array.from({ length: 32 }, () => 425), 431.01];

  const projectBills: Row[] = [...WITHIN_WINDOW, ...BEYOND_WINDOW]
    .map((paidAmount, id) => ({ id, projectId: PROJECT, paidAmount }));

  /** The tenant's 271 bills, with this project's oldest 7 past position 200. */
  const tenantBills: Row[] = [
    ...projectBills.slice(0, 33),
    ...Array.from({ length: 167 }, (_, i) => ({ id: 1000 + i, projectId: 7, paidAmount: 100 })),
    ...projectBills.slice(33),
    ...Array.from({ length: 64 }, (_, i) => ({ id: 2000 + i, projectId: 7, paidAmount: 100 })),
  ];

  it('reproduces the bug: one page + browser-side filter invents labor', async () => {
    const { fetchPage } = pagedSource(tenantBills);
    const firstPageOnly = (await fetchPage(0, 200)).content;

    const seen = firstPageOnly.filter(p => p.projectId === PROJECT);
    const { payableTotal, laborCost } = computeCostDistribution(CONSUMED, EXPENSES, seen);

    expect(seen).toHaveLength(33);
    expect(payableTotal).toBeCloseTo(14031.01, 2);
    expect(laborCost).toBeCloseTo(4745.20, 2); // the phantom
  });

  it('fixes it: draining the project-scoped list leaves no phantom labor', async () => {
    // What the fixed screen does — the server filters by project, the client
    // drains every page of that filtered list.
    const { fetchPage } = pagedSource(projectBills);

    const bills = await drainPages(fetchPage);
    const { payableTotal, laborCost } = computeCostDistribution(CONSUMED, EXPENSES, bills);

    expect(bills).toHaveLength(40);
    expect(payableTotal).toBeCloseTo(18776.21, 2);
    expect(laborCost).toBeCloseTo(0, 2); // no labor on this project, and none invented
  });
});
