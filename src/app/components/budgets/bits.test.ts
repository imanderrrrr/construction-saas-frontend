// The arithmetic of Presupuestos.
//
// Everything here is the reason the screen was rebuilt, so the tests are
// written as the defects they close: one base rather than two, figures over
// the FILTERED rows, jobsites identified by id, and a residual that says
// "not imputed" instead of drawing a zero that looks like a measurement.

import { describe, expect, it } from 'vitest';
import type { ProjectResponse } from '../../services/projects';
import {
  applyFilters, EMPTY_FILTERS, execPct, gaugeTone, isBudgeted, money, moneyRound,
  reportTotals, sharePct, sortReport, sortWorks, splitConsumption, toRow,
  urgentRows, worksTotals,
} from './bits';

/** The sheet's own four jobsites, in the API's shape. */
function project(over: Partial<ProjectResponse> & { id: number; name: string }): ProjectResponse {
  return {
    status: 'ACTIVE',
    clientId: null,
    client: null,
    costCode: null,
    originalContractCents: null,
    changeOrdersTotalCents: 0,
    revisedContractCents: null,
    contractAmountCents: null,
    approvedExpensesCents: 0,
    totalConsumedCents: 0,
    costBudgetCents: null,
    budgetBaseCents: null,
    remainingBudgetCents: null,
    invoicedCents: 0,
    collectedCents: 0,
    outstandingCents: 0,
    address: null,
    latitude: null,
    longitude: null,
    geofenceRadiusMeters: 200,
    assignedUserIds: [],
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-09-07T00:00:00Z',
    ...over,
  } as ProjectResponse;
}

const MARISOL = { id: 1, name: 'Grupo Marisol' };
const ANDES = { id: 2, name: 'Inmobiliaria Andes' };

const RESIDENCIAL = project({
  id: 4804, name: 'Residencial Sur', clientId: 1, client: MARISOL, costCode: 'CC-2026-004',
  originalContractCents: 200_000_00, changeOrdersTotalCents: 60_000_00, revisedContractCents: 260_000_00,
  costBudgetCents: 120_000_00, budgetBaseCents: 120_000_00, totalConsumedCents: 40_000_00,
  invoicedCents: 255_000_00, collectedCents: 180_000_00, outstandingCents: 75_000_00,
});
const AMPLIACION = project({
  id: 4816, name: 'Ampliación Zona 4', clientId: 2, client: ANDES, costCode: 'CC-2026-014',
  originalContractCents: 140_000_00, revisedContractCents: 140_000_00,
  costBudgetCents: 95_000_00, budgetBaseCents: 95_000_00, totalConsumedCents: 101_300_00,
  invoicedCents: 120_000_00, collectedCents: 60_000_00, outstandingCents: 60_000_00,
});
const TORRE = project({
  id: 4801, name: 'Torre Norte', clientId: 1, client: MARISOL, costCode: 'CC-2026-001',
  originalContractCents: 175_000_00, revisedContractCents: 175_000_00,
  // No cost budget: the backend falls the base back to the revised contract.
  costBudgetCents: null, budgetBaseCents: 175_000_00, totalConsumedCents: 25_000_00,
  invoicedCents: 40_000_00, collectedCents: 28_000_00, outstandingCents: 12_000_00,
});
const BODEGA = project({
  id: 4812, name: 'Bodega Km 22', clientId: 1, client: MARISOL, costCode: 'CC-2026-009',
  originalContractCents: 90_000_00, revisedContractCents: 90_000_00,
  costBudgetCents: 72_000_00, budgetBaseCents: 72_000_00, totalConsumedCents: 69_100_00,
  invoicedCents: 85_000_00, collectedCents: 85_000_00, outstandingCents: 0,
});

const ROWS = [RESIDENCIAL, AMPLIACION, TORRE, BODEGA].map(toRow);

describe('toRow', () => {
  it('reads the contract as the revised one, change orders included', () => {
    expect(toRow(RESIDENCIAL).contract).toBe(260_000);
    expect(toRow(RESIDENCIAL).originalContract).toBe(200_000);
    expect(toRow(RESIDENCIAL).changeOrders).toBe(60_000);
  });

  it('gives the margin no screen used to show: contract minus spend', () => {
    expect(toRow(RESIDENCIAL).margin).toBe(220_000);
    expect(toRow(AMPLIACION).margin).toBe(38_700);
  });

  it('keeps the backend-resolved base, and only reports the fallback', () => {
    expect(toRow(TORRE).costBudget).toBeNull();
    expect(toRow(TORRE).base).toBe(175_000);
    expect(toRow(BODEGA).base).toBe(72_000);
  });

  it('reads a field the backend may not send yet as 0, never NaN', () => {
    const early = toRow(project({ id: 1, name: 'Sin cobro', originalContractCents: 1_000_00 }));
    expect(early.invoiced).toBe(0);
    expect(Number.isNaN(early.outstanding)).toBe(false);
  });

  it('leaves out a project with no contract — there is no budget to watch', () => {
    expect(isBudgeted(project({ id: 9, name: 'Sin contrato' }))).toBe(false);
    expect(isBudgeted(RESIDENCIAL)).toBe(true);
  });
});

describe('the gauge divides by one base and says which', () => {
  it('measures spend against the cost budget when there is one', () => {
    expect(execPct(toRow(RESIDENCIAL))).toBeCloseTo(33.3, 1);
    expect(execPct(toRow(BODEGA))).toBeCloseTo(96.0, 1);
    expect(execPct(toRow(AMPLIACION))).toBeCloseTo(106.6, 1);
  });

  it('falls back to the contract, and that is the 14.3 % that looked healthy', () => {
    expect(execPct(toRow(TORRE))).toBeCloseTo(14.3, 1);
  });

  it('bands at 90 and at 100', () => {
    expect(gaugeTone(33.3)).toBe('ok');
    expect(gaugeTone(89.9)).toBe('ok');
    expect(gaugeTone(96)).toBe('limit');
    expect(gaugeTone(100)).toBe('limit');
    expect(gaugeTone(106.6)).toBe('over');
  });
});

describe('filters', () => {
  it('filters by client id, not by name', () => {
    const out = applyFilters(ROWS, { ...EMPTY_FILTERS, clientId: 1 });
    expect(out.map(r => r.id)).toEqual([4804, 4801, 4812]);
  });

  it('keeps two jobsites of the same name apart', () => {
    const twins = [
      toRow(project({ id: 11, name: 'Bodega', clientId: 1, client: MARISOL, originalContractCents: 10_00 })),
      toRow(project({ id: 12, name: 'Bodega', clientId: 2, client: ANDES, originalContractCents: 10_00 })),
    ];
    expect(applyFilters(twins, { ...EMPTY_FILTERS, clientId: 2 }).map(r => r.id)).toEqual([12]);
  });

  it('counts "above 90 %" as a band that still contains the over-budget ones', () => {
    const out = applyFilters(ROWS, { ...EMPTY_FILTERS, risk: 'over90' });
    expect(out.map(r => r.name).sort()).toEqual(['Ampliación Zona 4', 'Bodega Km 22']);
  });

  it('separates "over budget" from "above 90 %"', () => {
    expect(applyFilters(ROWS, { ...EMPTY_FILTERS, risk: 'over' }).map(r => r.name)).toEqual(['Ampliación Zona 4']);
  });

  it('finds the jobsites without a cost budget', () => {
    expect(applyFilters(ROWS, { ...EMPTY_FILTERS, risk: 'no-cost-budget' }).map(r => r.name)).toEqual(['Torre Norte']);
  });

  it('searches name, client and cost code', () => {
    expect(applyFilters(ROWS, { ...EMPTY_FILTERS, search: 'cc-2026-009' }).map(r => r.name)).toEqual(['Bodega Km 22']);
    expect(applyFilters(ROWS, { ...EMPTY_FILTERS, search: 'andes' }).map(r => r.name)).toEqual(['Ampliación Zona 4']);
  });

  it('hides closed jobsites by default and shows them on demand', () => {
    const withClosed = [...ROWS, toRow(project({ id: 99, name: 'Cerrada', status: 'CLOSED', originalContractCents: 1_00 }))];
    expect(applyFilters(withClosed, EMPTY_FILTERS).map(r => r.id)).not.toContain(99);
    expect(applyFilters(withClosed, { ...EMPTY_FILTERS, status: 'closed' }).map(r => r.id)).toEqual([99]);
    expect(applyFilters(withClosed, { ...EMPTY_FILTERS, status: 'all' })).toHaveLength(5);
  });
});

describe('each view sorts on its own axis', () => {
  it('orders the jobsites view by execution, margin, contract or name', () => {
    expect(sortWorks(ROWS, 'execution').map(r => r.name)[0]).toBe('Ampliación Zona 4');
    // Margin ascending: the thinnest first, which is Bodega at $20,900.
    expect(sortWorks(ROWS, 'margin').map(r => r.name)[0]).toBe('Bodega Km 22');
    expect(sortWorks(ROWS, 'contract').map(r => r.name)[0]).toBe('Residencial Sur');
    expect(sortWorks(ROWS, 'name').map(r => r.name)[0]).toBe('Ampliación Zona 4');
  });

  it('orders the report by what is owed, by spend, by contract or by name', () => {
    expect(sortReport(ROWS, 'outstanding').map(r => r.name)[0]).toBe('Residencial Sur');
    expect(sortReport(ROWS, 'consumed').map(r => r.name)[0]).toBe('Ampliación Zona 4');
    expect(sortReport(ROWS, 'contract').map(r => r.name)[0]).toBe('Residencial Sur');
    expect(sortReport(ROWS, 'name').map(r => r.name)[0]).toBe('Ampliación Zona 4');
  });

  it('does not mutate the array it is given', () => {
    const before = ROWS.map(r => r.id);
    sortWorks(ROWS, 'contract');
    expect(ROWS.map(r => r.id)).toEqual(before);
  });
});

describe('the figures are totalled over the filtered rows', () => {
  it('adds up the whole tenant with no filter', () => {
    const works = worksTotals(ROWS);
    expect(works.contract).toBe(665_000);
    expect(works.costBudget).toBe(287_000);
    expect(works.withCostBudget).toBe(3);
    expect(works.consumed).toBe(235_400);
    expect(works.margin).toBe(429_600);
    expect(works.marginPct).toBeCloseTo(64.6, 1);

    const report = reportTotals(ROWS);
    expect(report.invoiced).toBe(500_000);
    expect(report.collected).toBe(353_000);
    expect(report.outstanding).toBe(147_000);
    expect(report.collectedPct).toBeCloseTo(70.6, 1);
    expect(report.owing).toBe(3);
  });

  // The defect the screen was built to remove: filter to one client and the
  // header kept adding up all four while the table said "1 project".
  it('follows the filter down to the client', () => {
    const marisol = applyFilters(ROWS, { ...EMPTY_FILTERS, clientId: 1 });
    const report = reportTotals(marisol);
    expect(report.invoiced).toBe(380_000);
    expect(report.collected).toBe(293_000);
    expect(report.outstanding).toBe(87_000);
    expect(report.consumed).toBe(134_100);
    expect(report.collectedPct).toBeCloseTo(77.1, 1);
    expect(report.owing).toBe(2);
    expect(worksTotals(marisol).contract).toBe(525_000);
  });

  it('adds to $0 for zero rows, which is the true total of nothing', () => {
    expect(reportTotals([]).invoiced).toBe(0);
    expect(worksTotals([]).marginPct).toBe(0);
  });
});

describe('what is running out of budget', () => {
  it('lists only jobsites with a cost budget, most urgent first', () => {
    expect(urgentRows(ROWS).map(r => r.name)).toEqual(['Ampliación Zona 4', 'Bodega Km 22']);
  });

  // Torre Norte sits at 14.3 % of its CONTRACT. Warning about a jobsite whose
  // gauge is measuring the sale price is the lie the screen came to stop.
  it('never warns about a jobsite that is only being measured against its contract', () => {
    const noBudgetHigh = toRow(project({
      id: 77, name: 'Sin costo', originalContractCents: 10_000_00, revisedContractCents: 10_000_00,
      budgetBaseCents: 10_000_00, totalConsumedCents: 9_900_00,
    }));
    expect(urgentRows([noBudgetHigh])).toEqual([]);
  });
});

describe('where the spend went — provisional until the server splits it', () => {
  it('deduces payroll as the residual, suppliers by what was PAID', () => {
    const split = splitConsumption(69_100, 4_837, [{ paidAmount: 21_421 }]);
    expect(split.suppliers).toBe(21_421);
    expect(split.payroll).toBe(42_842);
    expect(split.payrollImputed).toBe(true);
    expect(sharePct(split.payroll, 69_100)).toBe(62);
    expect(sharePct(split.suppliers, 69_100)).toBe(31);
    expect(sharePct(split.expenses, 69_100)).toBe(7);
  });

  // A 0 % would read as a measurement. It is an absence of data.
  it('says nothing is imputed rather than drawing a zero', () => {
    const split = splitConsumption(40_000, 0, [{ paidAmount: 40_000 }]);
    expect(split.payroll).toBe(0);
    expect(split.payrollImputed).toBe(false);
  });

  it('floors a negative residual instead of showing money that went nowhere', () => {
    const split = splitConsumption(100, 60, [{ paidAmount: 60 }]);
    expect(split.payroll).toBe(0);
    expect(split.payrollImputed).toBe(false);
  });
});

describe('money reads the same as every other screen', () => {
  it('writes $1,234.56, with the sign outside the symbol', () => {
    expect(money(1234.56)).toBe('$1,234.56');
    expect(money(-500)).toBe('-$500.00');
    expect(money(0)).toBe('$0.00');
  });

  it('drops the cents in the display figures, where they are noise at 36 px', () => {
    expect(moneyRound(500_000)).toBe('$500,000');
    expect(moneyRound(235_400.49)).toBe('$235,400');
  });
});
