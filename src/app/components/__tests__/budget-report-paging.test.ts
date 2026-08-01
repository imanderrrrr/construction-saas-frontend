import { describe, it, expect } from 'vitest';
import { drainPages } from '../../lib/paging';

// ════════════════════════════════════════════════════════════════════════
// The budget report totals what it received, so it has to receive everything.
//
// It used to ask for `{ size: 500 }` and treat the reply as the whole set. The
// backend caps page size at 100 (ProjectServiceImpl: size.coerceIn(1, 100)),
// so past 100 projects the report silently dropped the rest — and the KPI row
// summed only what arrived. Same shape as the paged-total bug that once turned
// seven missing invoices into a phantom labour figure: no error, no empty
// state, just a smaller number that looks perfectly normal.
//
// This matters more now that the report carries "collected" and "outstanding":
// a short total there is a wrong answer to "how much do they owe me".
// ════════════════════════════════════════════════════════════════════════

interface ProjectRow {
  id: number;
  collectedCents: number;
  outstandingCents: number;
}

/** A fake paged endpoint that enforces the server's 100-row cap. */
function cappedPagedSource(rows: ProjectRow[]) {
  const calls: { page: number; size: number }[] = [];
  const fetchPage = async (page: number, size: number) => {
    const effective = Math.min(size, 100); // the server's coerceIn(1, 100)
    calls.push({ page, size: effective });
    const from = page * effective;
    return {
      content: rows.slice(from, from + effective),
      page,
      size: effective,
      totalElements: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / effective)),
    };
  };
  return { fetchPage, calls };
}

const projects: ProjectRow[] = Array.from({ length: 271 }, (_, i) => ({
  id: i,
  collectedCents: 1_000,
  outstandingCents: 500,
}));

describe('budget report project sweep', () => {
  it('collects every project even though the server caps a page at 100', async () => {
    const { fetchPage, calls } = cappedPagedSource(projects);

    const all = await drainPages<ProjectRow>((page, size) => fetchPage(page, size));

    expect(all).toHaveLength(271);
    expect(calls.map(c => c.page)).toEqual([0, 1, 2]);
  });

  it('asking for one big page instead loses everything past the cap', async () => {
    // What the report did before: one call, size 500, trusted as the whole set.
    const { fetchPage } = cappedPagedSource(projects);
    const firstPageOnly = await fetchPage(0, 500);

    expect(firstPageOnly.content).toHaveLength(100);
    // 171 projects — and their receivables — were simply absent.
    expect(firstPageOnly.content.length).toBeLessThan(projects.length);
  });

  it('totals the collected and outstanding figures across every page', async () => {
    const { fetchPage } = cappedPagedSource(projects);

    const all = await drainPages<ProjectRow>((page, size) => fetchPage(page, size));
    const collected = all.reduce((s, p) => s + p.collectedCents, 0);
    const outstanding = all.reduce((s, p) => s + p.outstandingCents, 0);

    expect(collected).toBe(271_000);
    expect(outstanding).toBe(135_500);
  });
});

// ════════════════════════════════════════════════════════════════════════
// A frontend deploy can land before the backend that introduces a field.
// `undefined / 100` is NaN, and NaN.toFixed(2) is the string "NaN" — which
// reaches a finance screen as "$NaN". Defaulting is not decoration here.
// ════════════════════════════════════════════════════════════════════════

/** The report's money mapping, extracted verbatim from BudgetReport. */
function toMoney(cents: number | undefined): number {
  return (cents ?? 0) / 100;
}

describe('money fields the backend may not send yet', () => {
  it('reads a missing field as 0, never NaN', () => {
    expect(toMoney(undefined)).toBe(0);
    expect(Number.isNaN(toMoney(undefined))).toBe(false);
  });

  it('still converts cents normally when the field is present', () => {
    expect(toMoney(80_000)).toBe(800);
    expect(toMoney(0)).toBe(0);
  });

  it('shows what the undefended version would have rendered', () => {
    const undefended = (cents: number | undefined) => (cents as number) / 100;
    expect(Number.isNaN(undefended(undefined))).toBe(true);
    expect(`$${(undefended(undefined)).toFixed(2)}`).toBe('$NaN');
  });
});
