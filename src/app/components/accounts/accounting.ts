import type { Payable, PayableSummary, Receivable } from '../../services/finance';

/**
 * The arithmetic behind Cobrar and Pagar — all of it, and nothing else.
 *
 * It lives apart from the two screens because the redesign's promise is that
 * the figures reconcile: "vencido + por vencer = total por cobrar" is printed
 * under the strip, so it has to be true by construction rather than by two
 * independent `reduce`s that drifted (the screens this replaces showed
 * $107,150.00 in the card and $103,150.00 in the footer of the same table).
 *
 * Three rules the server imposes, and this module obeys:
 *
 *  1. **A balance is `amount − paidAmount`.** Never the full amount: half of a
 *     partial invoice is already collected and is not owed any more.
 *  2. **`overdue` is not a stored state.** ReceivableServiceImpl and
 *     PayableServiceImpl derive it on read from the due date and the tenant's
 *     zone, so it arrives right per row but cannot be filtered or summed
 *     server-side. Everything here is therefore derived from `dueDate` against
 *     the business day, which keeps the buckets and the figures consistent
 *     with each other by construction.
 *  3. **Unapproved and rejected change orders are not receivable.** The list
 *     endpoint hides PENDING_APPROVAL unless asked for it, but REJECTED does
 *     come through; neither is money anybody owes, so both are dropped before
 *     a single figure is computed.
 */

/* ── Days ──────────────────────────────────────────────────────────────── */

/**
 * Whole days from one business date to another, both `YYYY-MM-DD`.
 *
 * Parsed at UTC midnight on both sides on purpose: these are calendar dates,
 * not instants, so the difference must not change with the reader's zone (a
 * local-midnight parse turns 30 days into 29.958 across a DST boundary).
 */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Days past due: positive when late, 0 when due today, negative when ahead. */
export function daysLate(dueDate: string, today: string): number {
  return daysBetween(dueDate, today);
}

/** `YYYY-MM-DD`, n days after the given business date. */
export function addDays(iso: string, n: number): string {
  const base = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(base)) return iso;
  return new Date(base + n * 86_400_000).toISOString().slice(0, 10);
}

/* ── The shape both screens reduce to ──────────────────────────────────── */

/** What the maths needs from a document, whether it is owed to us or by us. */
export interface Owed {
  id: number;
  /** Client (receivables) or vendor (payables) — the aging groups by this. */
  party: string;
  projectId: number;
  project: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  /** Server status, lowercased: pending | partial | paid | overdue | … */
  status: string;
}

export function balanceOf(d: Pick<Owed, 'amount' | 'paidAmount'>): number {
  return round2(d.amount - d.paidAmount);
}

export function isSettled(d: Owed): boolean {
  return d.status === 'paid' || balanceOf(d) <= 0;
}

/** Cents are the unit of truth; two decimals is the unit of display. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sumBalances(docs: Owed[]): number {
  return round2(docs.reduce((s, d) => s + balanceOf(d), 0));
}

/* ── Receivables and payables, normalised ──────────────────────────────── */

/** A receivable that is actually receivable: billable, unsettled or settled. */
export function receivableToOwed(r: Receivable): Owed {
  return {
    id: r.id,
    party: r.client,
    projectId: r.projectId,
    project: r.project,
    dueDate: r.dueDate,
    amount: r.amount,
    paidAmount: r.paidAmount,
    status: r.status.toLowerCase(),
  };
}

export function payableToOwed(p: Payable): Owed {
  return {
    id: p.id,
    party: p.vendor,
    projectId: p.projectId,
    project: p.project,
    dueDate: p.dueDate,
    amount: p.amount,
    paidAmount: p.paidAmount,
    status: p.status.toLowerCase(),
  };
}

/** PENDING_APPROVAL and REJECTED are not money owed — see rule 3 above. */
export function isBillable(r: Pick<Receivable, 'status'>): boolean {
  const s = r.status.toLowerCase();
  return s !== 'pending_approval' && s !== 'rejected';
}

/* ── Aging ─────────────────────────────────────────────────────────────── */

export type AgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd60plus';

export const AGING_BUCKETS: AgingBucket[] = ['current', 'd1_30', 'd31_60', 'd60plus'];

/** Which column of the aging table a document falls in. */
export function bucketOf(dueDate: string, today: string): AgingBucket {
  const late = daysLate(dueDate, today);
  if (late <= 0) return 'current';
  if (late <= 30) return 'd1_30';
  if (late <= 60) return 'd31_60';
  return 'd60plus';
}

export interface AgingRow {
  /** Grouping key — the client's or the vendor's name. */
  party: string;
  /** Jobsites touched, in first-seen order; the row's subtitle names them. */
  projects: string[];
  docs: Owed[];
  current: number;
  d1_30: number;
  d31_60: number;
  d60plus: number;
  /** current + d1_30 + d31_60 + d60plus. */
  total: number;
  /** d1_30 + d31_60 + d60plus — what the Vencido figure counts for this row. */
  overdue: number;
}

/**
 * One row per client (or vendor), with the four aging columns.
 *
 * Settled documents never reach a bucket — they have no balance to age — but
 * they stay out of `docs` too, so the expanded row shows what is still owed.
 * Rows are ordered by what is overdue first, then by total: the screen's job
 * is to say who to call today.
 */
export function agingByParty(docs: Owed[], today: string): AgingRow[] {
  const rows = new Map<string, AgingRow>();
  for (const d of docs) {
    if (isSettled(d)) continue;
    const row = rows.get(d.party) ?? {
      party: d.party, projects: [], docs: [],
      current: 0, d1_30: 0, d31_60: 0, d60plus: 0, total: 0, overdue: 0,
    };
    row.docs.push(d);
    if (d.project && !row.projects.includes(d.project)) row.projects.push(d.project);
    row[bucketOf(d.dueDate, today)] += balanceOf(d);
    rows.set(d.party, row);
  }
  return [...rows.values()]
    .map(row => {
      const current = round2(row.current);
      const d1_30 = round2(row.d1_30);
      const d31_60 = round2(row.d31_60);
      const d60plus = round2(row.d60plus);
      return {
        ...row,
        current, d1_30, d31_60, d60plus,
        overdue: round2(d1_30 + d31_60 + d60plus),
        total: round2(current + d1_30 + d31_60 + d60plus),
        docs: [...row.docs].sort(byUrgency(today)),
      };
    })
    .sort((a, b) => b.overdue - a.overdue || b.total - a.total || a.party.localeCompare(b.party));
}

/** The totals row under the aging table — the same four columns, summed. */
export function agingTotals(rows: AgingRow[]): Omit<AgingRow, 'party' | 'projects' | 'docs'> {
  const acc = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0, total: 0, overdue: 0 };
  for (const r of rows) {
    acc.current += r.current; acc.d1_30 += r.d1_30;
    acc.d31_60 += r.d31_60; acc.d60plus += r.d60plus;
  }
  acc.overdue = round2(acc.d1_30 + acc.d31_60 + acc.d60plus);
  acc.total = round2(acc.current + acc.overdue);
  return {
    current: round2(acc.current), d1_30: round2(acc.d1_30),
    d31_60: round2(acc.d31_60), d60plus: round2(acc.d60plus),
    overdue: acc.overdue, total: acc.total,
  };
}

/** Most urgent first: what is overdue, oldest first; then by due date. */
export function byUrgency(today: string) {
  return (a: Owed, b: Owed) => {
    const settled = Number(isSettled(a)) - Number(isSettled(b));
    if (settled !== 0) return settled;
    const late = daysLate(b.dueDate, today) - daysLate(a.dueDate, today);
    if (late !== 0) return late;
    return a.dueDate.localeCompare(b.dueDate);
  };
}

/* ── Lanes (Pagar) ─────────────────────────────────────────────────────── */

export type LaneKey = 'overdue' | 'week' | 'next30' | 'later' | 'paid';

export const LANE_ORDER: LaneKey[] = ['overdue', 'week', 'next30', 'later', 'paid'];

/** Which lane a bill belongs to. Paid wins: it is a lane, not a due date. */
export function laneOf(d: Owed, today: string): LaneKey {
  if (isSettled(d)) return 'paid';
  const late = daysLate(d.dueDate, today);
  if (late > 0) return 'overdue';
  if (late >= -7) return 'week';
  if (late >= -30) return 'next30';
  return 'later';
}

export interface Lane {
  key: LaneKey;
  docs: Owed[];
  /** Sum of balances; zero for an empty lane and for the paid one. */
  total: number;
}

/**
 * The five lanes, always all five.
 *
 * An empty lane is drawn too — "Después · nada vence tras el 16 oct · $0.00"
 * is information, and a lane that appears and disappears with the data makes
 * the list change shape under the reader.
 */
export function lanesOf(docs: Owed[], today: string): Lane[] {
  const byLane = new Map<LaneKey, Owed[]>(LANE_ORDER.map(k => [k, []]));
  for (const d of docs) byLane.get(laneOf(d, today))!.push(d);
  return LANE_ORDER.map(key => {
    const rows = byLane.get(key)!.sort(byUrgency(today));
    return { key, docs: rows, total: key === 'paid' ? 0 : sumBalances(rows) };
  });
}

/* ── The three figures of each screen ──────────────────────────────────── */

export interface MoneyFigure {
  amount: number;
  count: number;
}

export interface ReceivableFigures {
  /** Past due and still owed — the first figure, in orange. */
  overdue: MoneyFigure;
  /** Days since the oldest overdue document's due date; 0 when none. */
  oldestOverdueDays: number;
  /** Not yet due, partials included. */
  notYetDue: MoneyFigure;
  /** Collected this accounting month, across every document. */
  collected: MoneyFigure;
  /** overdue + notYetDue — printed under the strip so it can be checked. */
  total: number;
}

export function receivableFigures(docs: Owed[], payments: DatedAmount[], today: string, month: string): ReceivableFigures {
  const open = docs.filter(d => !isSettled(d));
  const overdue = open.filter(d => daysLate(d.dueDate, today) > 0);
  const notYetDue = open.filter(d => daysLate(d.dueDate, today) <= 0);
  const inMonth = payments.filter(p => p.date.startsWith(month));
  const overdueAmount = sumBalances(overdue);
  const notYetDueAmount = sumBalances(notYetDue);
  return {
    overdue: { amount: overdueAmount, count: overdue.length },
    oldestOverdueDays: overdue.reduce((m, d) => Math.max(m, daysLate(d.dueDate, today)), 0),
    notYetDue: { amount: notYetDueAmount, count: notYetDue.length },
    collected: { amount: round2(inMonth.reduce((s, p) => s + p.amount, 0)), count: inMonth.length },
    total: round2(overdueAmount + notYetDueAmount),
  };
}

export interface PayableFigures {
  /** Due within seven days, today included — the figure the week is built on. */
  dueThisWeek: MoneyFigure;
  /** The first due date in that window, or null when the window is empty. */
  firstDue: string | null;
  overdue: MoneyFigure;
  oldestOverdueDays: number;
  /** Every open balance, the two figures above included. */
  outstanding: MoneyFigure;
  paid: MoneyFigure;
}

export function payableFigures(docs: Owed[], payments: DatedAmount[], today: string, month: string): PayableFigures {
  const open = docs.filter(d => !isSettled(d));
  const week = open.filter(d => { const l = daysLate(d.dueDate, today); return l <= 0 && l >= -7; });
  const overdue = open.filter(d => daysLate(d.dueDate, today) > 0);
  const inMonth = payments.filter(p => p.date.startsWith(month));
  return {
    dueThisWeek: { amount: sumBalances(week), count: week.length },
    firstDue: week.length ? week.reduce((min, d) => (d.dueDate < min ? d.dueDate : min), week[0].dueDate) : null,
    overdue: { amount: sumBalances(overdue), count: overdue.length },
    oldestOverdueDays: overdue.reduce((m, d) => Math.max(m, daysLate(d.dueDate, today)), 0),
    outstanding: { amount: sumBalances(open), count: open.length },
    paid: { amount: round2(inMonth.reduce((s, p) => s + p.amount, 0)), count: inMonth.length },
  };
}

/**
 * The same four figures, taken from the server's summary instead of from the
 * loaded rows. The server resolves "today", "this week" and "this month" in the
 * tenant's timezone, which is the authoritative reading; the rules are otherwise
 * identical to `payableFigures`, so the numbers must not move.
 *
 * Two bits of meta the summary does not carry — which bill comes first this week
 * and how old the oldest overdue one is — stay derived from the rows, which are
 * the same set the summary measured.
 */
export function payableFiguresFromSummary(summary: PayableSummary, fromRows: PayableFigures): PayableFigures {
  const cents = (n: number) => round2(n / 100);
  return {
    dueThisWeek: { amount: cents(summary.dueThisWeekCents), count: summary.dueThisWeekCount },
    firstDue: fromRows.firstDue,
    overdue: { amount: cents(summary.overdueCents), count: summary.overdueCount },
    oldestOverdueDays: fromRows.oldestOverdueDays,
    outstanding: { amount: cents(summary.outstandingCents), count: summary.outstandingCount },
    paid: { amount: cents(summary.paidThisMonthCents), count: summary.paidThisMonthCount },
  };
}

/** A payment reduced to what the month figures need. */
export interface DatedAmount {
  date: string;
  amount: number;
}

/** Every collection that still counts: a voided one stays listed but not counted. */
export function receivablePayments(rows: Receivable[]): DatedAmount[] {
  return rows.flatMap(r => r.payments.filter(p => !p.voided).map(p => ({ date: p.date, amount: p.amount })));
}

/** Every payment that still counts: a voided one stays listed but not counted. */
export function payablePayments(rows: Payable[]): DatedAmount[] {
  return rows.flatMap(p => p.payments.filter(x => !x.voided).map(x => ({ date: x.date, amount: x.amount })));
}

/* ── The week's cash bridge ────────────────────────────────────────────── */

export interface CashBridge {
  inbound: MoneyFigure;
  outbound: MoneyFigure;
  /** inbound − outbound: negative means the week takes more than it brings. */
  net: number;
}

/**
 * What the next seven days bring in and take out, side by side.
 *
 * It is the only figure that needs both screens' data, and the only one that
 * answers the question a small builder actually asks on a Monday: whether what
 * the clients owe this week covers what the suppliers are owed this week.
 */
export function cashBridge(receivables: Owed[], payables: Owed[], today: string): CashBridge {
  const window = (docs: Owed[]) => docs.filter(d => {
    if (isSettled(d)) return false;
    const late = daysLate(d.dueDate, today);
    return late <= 0 && late >= -7;
  });
  const inRows = window(receivables);
  const outRows = window(payables);
  const inbound = sumBalances(inRows);
  const outbound = sumBalances(outRows);
  return {
    inbound: { amount: inbound, count: inRows.length },
    outbound: { amount: outbound, count: outRows.length },
    net: round2(inbound - outbound),
  };
}

/* ── Search ────────────────────────────────────────────────────────────── */

/** Accent- and case-insensitive contains, for the one search box. */
export function matches(haystack: Array<string | null | undefined>, needle: string): boolean {
  const q = fold(needle);
  if (!q) return true;
  return haystack.some(h => fold(h ?? '').includes(q));
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
