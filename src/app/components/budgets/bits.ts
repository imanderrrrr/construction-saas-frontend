/**
 * The arithmetic of Presupuestos, in one place (Claude Design "Presupuestos
 * BuildTrack" + "Presupuestos Reporte BuildTrack", 2026-09).
 *
 * It lives outside the components because the screen this replaces was four
 * components dividing the same two numbers four different ways: the admin's
 * list and the report divided spend by the COST budget, finance's list and
 * Finanzas de Proyecto divided it by the CONTRACT, and the same jobsite came
 * out at 33 % for the owner and 15 % for his accountant in the same second.
 *
 * One base, therefore, and it is `budgetBaseCents` — which the backend has
 * already resolved as `costBudgetCents ?? revisedContractCents`. Nothing here
 * re-derives that fallback; it only reports which of the two it landed on, so
 * a gauge measured against the sale price says so on the row.
 */

import type { ProjectResponse, ProjectStatus } from '../../services/projects';

// ── The row ────────────────────────────────────────────────────────────────

export interface BudgetRow {
  /** Project id. Every lookup keys on this — two jobsites may share a name. */
  id: number;
  name: string;
  clientId: number | null;
  clientName: string | null;
  costCode: string | null;
  status: ProjectStatus;
  closed: boolean;
  /** What the client is billed: original + signed change orders. */
  contract: number;
  /** What the company planned to spend. `null` when nobody ever typed one. */
  costBudget: number | null;
  /** The contract before change orders — the field the adjust window writes. */
  originalContract: number;
  /** Signed change orders, summed. Revised contract = original + these. */
  changeOrders: number;
  /** The gauge's denominator, resolved by the backend. */
  base: number;
  consumed: number;
  /** Contract minus spend: the figure no screen used to show. */
  margin: number;
  invoiced: number;
  collected: number;
  outstanding: number;
  createdAt: string;
}

const cents = (c: number | null | undefined): number => (c ?? 0) / 100;

export function toRow(p: ProjectResponse): BudgetRow {
  const contract = cents(p.revisedContractCents ?? p.originalContractCents);
  const consumed = cents(p.totalConsumedCents);
  return {
    id: p.id,
    name: p.name,
    clientId: p.clientId,
    clientName: p.client?.name ?? null,
    costCode: p.costCode,
    status: p.status,
    closed: p.status === 'CLOSED',
    contract,
    costBudget: p.costBudgetCents == null ? null : cents(p.costBudgetCents),
    originalContract: cents(p.originalContractCents),
    changeOrders: cents(p.changeOrdersTotalCents),
    base: cents(p.budgetBaseCents ?? p.revisedContractCents ?? p.originalContractCents),
    consumed,
    margin: contract - consumed,
    // Defaulted, not asserted: a frontend deploy can land before the backend
    // that introduces these, and `undefined / 100` reaches the screen as "$NaN".
    invoiced: cents(p.invoicedCents),
    collected: cents(p.collectedCents),
    outstanding: cents(p.outstandingCents),
    createdAt: p.createdAt,
  };
}

/**
 * A project joins the list once it has a contract. Without one there is no
 * budget to watch — it is a project record, and Proyectos is where it is
 * completed.
 */
export function isBudgeted(p: ProjectResponse): boolean {
  return p.originalContractCents != null;
}

// ── The gauge ──────────────────────────────────────────────────────────────

export type GaugeTone = 'ok' | 'limit' | 'over';

/** Spend against the base, as a percentage. 0 when there is no base to divide by. */
export function execPct(row: Pick<BudgetRow, 'consumed' | 'base'>): number {
  return row.base > 0 ? (row.consumed / row.base) * 100 : 0;
}

/** Three bands: ink below 90, orange to 100, red past it. Nothing is green. */
export function gaugeTone(pct: number): GaugeTone {
  if (pct > 100) return 'over';
  return pct >= 90 ? 'limit' : 'ok';
}

/** True when the gauge is dividing by the contract because no cost budget exists. */
export function againstContract(row: Pick<BudgetRow, 'costBudget'>): boolean {
  return row.costBudget == null;
}

// ── Filters ────────────────────────────────────────────────────────────────

export type StatusFilter = 'active' | 'all' | 'closed';
export type RiskFilter = 'all' | 'over' | 'over90' | 'no-cost-budget';

export interface Filters {
  search: string;
  clientId: number | 'all';
  status: StatusFilter;
  risk: RiskFilter;
}

export const EMPTY_FILTERS: Filters = { search: '', clientId: 'all', status: 'active', risk: 'all' };

/** How many of the four controls are narrowing the list right now. */
export function activeFilterCount(f: Filters): number {
  return [
    f.search.trim() !== '',
    f.clientId !== 'all',
    f.status !== 'active',
    f.risk !== 'all',
  ].filter(Boolean).length;
}

function matchesRisk(row: BudgetRow, risk: RiskFilter): boolean {
  if (risk === 'all') return true;
  if (risk === 'no-cost-budget') return row.costBudget == null;
  const pct = execPct(row);
  // "Over 90 %" is a band that contains the ones already past 100: an
  // over-budget jobsite has not stopped being over 90 %.
  return risk === 'over' ? pct > 100 : pct >= 90;
}

export function applyFilters(rows: BudgetRow[], f: Filters): BudgetRow[] {
  const needle = f.search.trim().toLowerCase();
  return rows.filter(row => {
    if (f.status === 'active' && row.closed) return false;
    if (f.status === 'closed' && !row.closed) return false;
    if (f.clientId !== 'all' && row.clientId !== f.clientId) return false;
    if (!matchesRisk(row, f.risk)) return false;
    if (needle) {
      const hay = `${row.name} ${row.clientName ?? ''} ${row.costCode ?? ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

// ── Sorting ────────────────────────────────────────────────────────────────
//
// The one control that does NOT survive a change of view. Two of each view's
// four options do not exist on the other side — there is no execution or
// margin in the report, and no outstanding or spend ordering in the jobsites
// list — so each view keeps its own and opens on its own default.

export type WorksSort = 'execution' | 'margin' | 'contract' | 'name';
export type ReportSort = 'outstanding' | 'consumed' | 'contract' | 'name';

export const WORKS_SORTS: WorksSort[] = ['execution', 'margin', 'contract', 'name'];
export const REPORT_SORTS: ReportSort[] = ['outstanding', 'consumed', 'contract', 'name'];

const byName = (a: BudgetRow, b: BudgetRow) => a.name.localeCompare(b.name);

export function sortWorks(rows: BudgetRow[], sort: WorksSort): BudgetRow[] {
  const out = [...rows];
  switch (sort) {
    case 'execution': return out.sort((a, b) => execPct(b) - execPct(a) || byName(a, b));
    case 'margin':    return out.sort((a, b) => a.margin - b.margin || byName(a, b));
    case 'contract':  return out.sort((a, b) => b.contract - a.contract || byName(a, b));
    default:          return out.sort(byName);
  }
}

export function sortReport(rows: BudgetRow[], sort: ReportSort): BudgetRow[] {
  const out = [...rows];
  switch (sort) {
    case 'outstanding': return out.sort((a, b) => b.outstanding - a.outstanding || byName(a, b));
    case 'consumed':    return out.sort((a, b) => b.consumed - a.consumed || byName(a, b));
    case 'contract':    return out.sort((a, b) => b.contract - a.contract || byName(a, b));
    default:            return out.sort(byName);
  }
}

// ── Totals ─────────────────────────────────────────────────────────────────
//
// Over the FILTERED rows, always. The bug that defined this screen was a
// header totalling four jobsites above a table showing one, while the guided
// tour promised the export carried "the filtered rows with their header
// indicators included".

export interface WorksTotals {
  contract: number;
  costBudget: number;
  /** How many of the rows have a cost budget at all, and out of how many. */
  withCostBudget: number;
  count: number;
  consumed: number;
  margin: number;
  /** Margin as a share of the contract; 0 with no contract to divide by. */
  marginPct: number;
}

export function worksTotals(rows: BudgetRow[]): WorksTotals {
  const contract = sum(rows, r => r.contract);
  const consumed = sum(rows, r => r.consumed);
  const margin = contract - consumed;
  return {
    contract,
    costBudget: sum(rows, r => r.costBudget ?? 0),
    withCostBudget: rows.filter(r => r.costBudget != null).length,
    count: rows.length,
    consumed,
    margin,
    marginPct: contract > 0 ? (margin / contract) * 100 : 0,
  };
}

export interface ReportTotals {
  invoiced: number;
  collected: number;
  outstanding: number;
  consumed: number;
  contract: number;
  /** Collected as a share of invoiced; 0 with nothing invoiced. */
  collectedPct: number;
  /** Jobsites with something still owed, and how many rows there are in all. */
  owing: number;
  count: number;
}

export function reportTotals(rows: BudgetRow[]): ReportTotals {
  const invoiced = sum(rows, r => r.invoiced);
  const collected = sum(rows, r => r.collected);
  return {
    invoiced,
    collected,
    outstanding: sum(rows, r => r.outstanding),
    consumed: sum(rows, r => r.consumed),
    contract: sum(rows, r => r.contract),
    collectedPct: invoiced > 0 ? (collected / invoiced) * 100 : 0,
    owing: rows.filter(r => r.outstanding > 0).length,
    count: rows.length,
  };
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

/** Collected over invoiced, per row. */
export function collectedPct(row: Pick<BudgetRow, 'invoiced' | 'collected'>): number {
  return row.invoiced > 0 ? (row.collected / row.invoiced) * 100 : 0;
}

// ── The urgency block ──────────────────────────────────────────────────────

/** Most urgent first, and never more than this many. */
export const URGENT_LIMIT = 5;

/**
 * The jobsites running out of budget.
 *
 * Only the ones with a cost budget: a jobsite measured against its contract is
 * being compared to the sale price, and calling that "96 % spent" is the very
 * lie this screen exists to stop repeating.
 */
export function urgentRows(rows: BudgetRow[]): BudgetRow[] {
  return rows
    .filter(row => row.costBudget != null && execPct(row) >= 90)
    .sort((a, b) => execPct(b) - execPct(a));
}

// ── Where the money went ───────────────────────────────────────────────────

export interface ConsumptionSplit {
  /** Payroll. See the note below: it is a residual, not a reported figure. */
  payroll: number;
  suppliers: number;
  expenses: number;
  /** False when the residual came out at or below zero — nothing is imputed. */
  payrollImputed: boolean;
}

/**
 * The spend of one jobsite, split by source.
 *
 * PROVISIONAL, and the sheet says so: the split does not exist in any response
 * today — spend arrives already summed — so payroll is deduced as what is left
 * after approved expenses and supplier payments. If one source is misreported
 * the error hides inside another. `GET /budgets/consumption-breakdown` is the
 * backend row that removes this; until it lands, a residual at or below zero
 * is drawn as "not imputed" rather than as a 0 % that would read like a fact.
 *
 * Suppliers must use what has been PAID, not the outstanding balance: the
 * balance is 0 for a settled bill, which used to collapse AP to nothing and
 * make payroll swallow the whole of a materials jobsite.
 */
export function splitConsumption(
  consumed: number,
  expenses: number,
  payables: ReadonlyArray<{ paidAmount: number }>,
): ConsumptionSplit {
  const suppliers = payables.reduce((total, p) => total + p.paidAmount, 0);
  const residual = consumed - expenses - suppliers;
  return {
    payroll: Math.max(residual, 0),
    suppliers,
    expenses,
    payrollImputed: residual > 0,
  };
}

/** A source's share of the jobsite's spend, one decimal. */
export function sharePct(part: number, consumed: number): number {
  return consumed > 0 ? Math.round((part / consumed) * 1000) / 10 : 0;
}

// ── Money ──────────────────────────────────────────────────────────────────

/**
 * "$1,234.56".
 *
 * Deliberately not locale-aware, like every other money surface in this app
 * (`subcontractors/bits.fmtMoney`, `labor/shared.money`, `helpers/tmMoney`):
 * two adjacent panels writing the same figure with different separators is
 * worse than either convention. The quetzal migration is a decision for the
 * whole product at once, not for one screen.
 */
export function money(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "$1,235" — the figure cells, where cents are noise at 36 px. */
export function moneyRound(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString('en-US')}`;
}

/** "33.3 %" in English, "33,3 %" in Spanish — a percentage is not money. */
export function pct(value: number, lang: string): string {
  const text = value.toFixed(1);
  return lang.startsWith('es') ? text.replace('.', ',') : text;
}
