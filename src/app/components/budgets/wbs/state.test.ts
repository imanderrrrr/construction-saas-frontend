import { describe, expect, it } from 'vitest';
import { parseWbsImport, varianceFromSpend, varianceStatus, WbsImportError } from './state';

describe('WBS variance boundaries', () => {
  it.each([[0, 'OK'], [84.99, 'OK'], [85, 'WARNING'], [99.99, 'WARNING'], [100, 'OVER_BUDGET'], [168, 'OVER_BUDGET']] as const)('classifies %s percent as %s', (pct, expected) => {
    expect(varianceStatus(pct)).toBe(expected);
  });
  it('handles zero budget with spend as an overrun without blocking it', () => {
    expect(varianceFromSpend(0, 0)).toBe('OK');
    expect(varianceFromSpend(1, 0)).toBe('OVER_BUDGET');
    expect(varianceFromSpend(135_000_00, 80_000_00)).toBe('OVER_BUDGET');
  });
});

describe('WBS bulk import', () => {
  it('parses Excel tabs and Spanish headers/categories with exact cents', () => {
    expect(parseWbsImport('Código\tNombre\tCategoría\tMonto\n01.01\tExcavación\tGeneral\t80000.01\n01.02\tZapatas\tMateriales\t9.10')).toEqual([
      { code: '01.01', name: 'Excavación', category: 'GENERAL', originalBudgetCents: 8000001 },
      { code: '01.02', name: 'Zapatas', category: 'MATERIAL', originalBudgetCents: 910 },
    ]);
  });
  it('preserves quoted CSV names and grouped money', () => {
    expect(parseWbsImport('01.01,"Walls, concrete",LABOR,"$1,200.50"')[0]).toEqual({ code: '01.01', name: 'Walls, concrete', category: 'LABOR', originalBudgetCents: 120050 });
  });
  it('ignores separators inside quotes when detecting the file format', () => {
    expect(parseWbsImport('01.01,"Walls; concrete",LABOR,1200.50')[0].name).toBe('Walls; concrete');
  });
  it('handles semicolon exports and zero allocations', () => {
    expect(parseWbsImport('01;Planning;GENERAL;0')[0].originalBudgetCents).toBe(0);
  });
  it('rejects imports beyond the atomic API limit', () => {
    expect(() => parseWbsImport(Array.from({ length: 501 }, (_, i) => `${i},Name,GENERAL,1`).join('\n'))).toThrow('501: limit');
  });
  it.each([
    ['', 'empty'], ['code,name,category,amount', 'empty'],
    ['01,Name,GENERAL', 'columns'], ['01,,GENERAL,12', 'required'],
    ['01,Name,UNKNOWN,12', 'category'], ['01,Name,GENERAL,-1', 'amount'],
    ['01,Name,GENERAL,1.001', 'amount'], ['01,Name,GENERAL,1\n01,Other,GENERAL,2', 'duplicate'],
    ['01;Name;GENERAL;123,45', 'amount'],
    ['01,"Name,GENERAL,1', 'quote'],
  ])('rejects invalid input (%s) before the transaction: %s', (text, reason) => {
    try { parseWbsImport(text); throw new Error('accepted'); }
    catch (error) { expect(error).toBeInstanceOf(WbsImportError); expect((error as WbsImportError).reason).toBe(reason); }
  });
});
