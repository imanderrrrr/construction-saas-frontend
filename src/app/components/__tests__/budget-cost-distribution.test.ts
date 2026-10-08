import { describe, it, expect } from 'vitest';
import { ledgerConsumption } from '../budgets/bits';

describe('job cost distribution from the consumption ledger', () => {
  it('keeps paid supplier costs separate from own labour and subcontractors', () => {
    const split = ledgerConsumption({ payrollCents: 100_000, subcontractorCents: 200_000, supplierCents: 900_000, warehouseCents: 50_000, expenseCents: 25_000, totalConsumedCents: 1_275_000 });
    expect(split.payroll).toBe(1000);
    expect(split.subcontractors).toBe(2000);
    expect(split.suppliers).toBe(9000);
    expect(split.warehouse).toBe(500);
    expect(split.expenses).toBe(250);
    expect(split.payroll + split.subcontractors + split.suppliers + split.warehouse + split.expenses).toBe(12750);
  });
  it('does not derive phantom payroll from a short or inconsistent browser bill list', () => {
    const split = ledgerConsumption({ payrollCents: 0, subcontractorCents: 0, supplierCents: 1_877_621, warehouseCents: 0, expenseCents: 0, totalConsumedCents: 1_877_621 });
    expect(split.payroll).toBe(0);
    expect(split.payrollImputed).toBe(true);
    expect(split.suppliers).toBe(18776.21);
  });
});
