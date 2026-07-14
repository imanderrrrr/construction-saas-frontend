import { describe, it, expect } from 'vitest';
import { computeCostDistribution } from '../BudgetManagement';

// ════════════════════════════════════════════════════════════════════════
// Budget "Cost Distribution" calculation (labor / expenses / payables)
//
// Regression coverage for the production bug where a project made mostly of
// PAID material bills showed Accounts Payable at 0% and Labor at ~100%.
//
// Root cause: payableTotal summed the OUTSTANDING balance (amount − paidAmount),
// which is 0 once a bill is fully paid, so the AP donut slice vanished and the
// labor residual absorbed everything. The fix sums what was actually PAID.
//
// Ledger invariant (verified against the backend budget deductions):
//   consumed === approvedExpenses + Σ payable.paidAmount + payroll
// so with payableTotal = Σ paidAmount, the labor residual equals payroll and
// the three slices sum to consumed.
// ════════════════════════════════════════════════════════════════════════

/** Percentage each slice represents of consumed — mirrors the donut math. */
function pcts(consumed: number, d: { laborCost: number; expenseTotal: number; payableTotal: number }) {
  const total = consumed || 1;
  return {
    labor:    (d.laborCost   / total) * 100,
    expenses: (d.expenseTotal / total) * 100,
    payables: (d.payableTotal / total) * 100,
  };
}

describe('computeCostDistribution', () => {
  it('counts PAID payables as spent — the reported bug: AP must not read 0%', () => {
    // Client's scenario: spend is mostly PAID material bills, plus a little payroll.
    // consumed = expenses(0) + payablesPaid(9000) + payroll(1000)
    const payables = [
      { paidAmount: 5000 }, // Sherwin Williams, fully paid
      { paidAmount: 4000 }, // more materials, fully paid
    ];
    const d = computeCostDistribution(10000, 0, payables);

    expect(d.payableTotal).toBe(9000); // spent, NOT 0
    expect(d.laborCost).toBe(1000);    // residual = payroll

    const p = pcts(10000, d);
    expect(p.payables).toBeCloseTo(90); // AP shows its real 90%, not 0
    expect(p.labor).toBeCloseTo(10);    // labor is NOT 100%
  });

  it('makes the three slices sum to ~100% of consumed', () => {
    const payables = [{ paidAmount: 1200 }, { paidAmount: 800 }]; // 2000 paid
    const d = computeCostDistribution(5000, 1500, payables);      // payroll = 1500

    const p = pcts(5000, d);
    expect(p.labor + p.expenses + p.payables).toBeCloseTo(100);
    expect(d.laborCost + d.expenseTotal + d.payableTotal).toBeCloseTo(5000);
  });

  it('uses paidAmount — not the billed amount and not the outstanding balance', () => {
    // Partially-paid bill: billed 1000, paid 300. Only the 300 hit the budget.
    const d = computeCostDistribution(1000, 0, [{ paidAmount: 300 }]);
    expect(d.payableTotal).toBe(300); // not 1000 (billed), not 700 (remaining)
    expect(d.laborCost).toBe(700);    // residual = payroll
  });

  it('treats vendor bills (incl. "General Labor") as payables, not as the labor residual', () => {
    // A "General Labor" vendor bill is a payable; it must land in the payables
    // slice (already counted there), never double-counted into labor.
    const payables = [
      { paidAmount: 2000 }, // materials
      { paidAmount: 800 },  // "General Labor" vendor bill
    ];
    const d = computeCostDistribution(3000, 0, payables);
    expect(d.payableTotal).toBe(2800); // both bills counted in payables
    expect(d.laborCost).toBe(200);     // only true payroll remains as labor
  });

  it('never produces a negative slice (transient over-fetch is floored at 0)', () => {
    // Payables paid momentarily exceed consumed (read skew between the fetches).
    const d = computeCostDistribution(1000, 500, [{ paidAmount: 900 }]);
    expect(d.laborCost).toBeGreaterThanOrEqual(0);
    expect(d.expenseTotal).toBeGreaterThanOrEqual(0);
    expect(d.payableTotal).toBeGreaterThanOrEqual(0);
    expect(d.laborCost).toBe(0); // floored, not -400
  });

  it('pins the old vs new formula on fully-paid bills (regression guard)', () => {
    const bills = [
      { amount: 5000, paidAmount: 5000 },
      { amount: 4000, paidAmount: 4000 },
    ];
    // OLD (buggy) formula: outstanding balance → 0 once paid.
    const oldPayableTotal = bills.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
    expect(oldPayableTotal).toBe(0); // the bug

    // NEW formula: what was paid.
    const fixed = computeCostDistribution(10000, 0, bills);
    expect(fixed.payableTotal).toBe(9000); // the fix
  });

  it('handles no payables and no expenses (all labor)', () => {
    const d = computeCostDistribution(2000, 0, []);
    expect(d.payableTotal).toBe(0);
    expect(d.laborCost).toBe(2000);
  });

  it('handles zero consumed without dividing by zero', () => {
    const d = computeCostDistribution(0, 0, []);
    expect(d.laborCost).toBe(0);
    expect(pcts(0, d).labor).toBe(0);
  });
});
