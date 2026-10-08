import { describe, expect, it } from 'vitest';
import { moneyInputCents } from './moneyInput';

describe('unit cost entry', () => {
  it.each([['0', 0], ['10.00', 1000], ['0.29', 29], ['1234.56', 123456]])('parses %s in integer cents', (input, cents) => {
    expect(moneyInputCents(input)).toBe(cents);
  });
  it.each(['-1', '1.001', 'NaN', '', '90071992547410', '1e2'])('rejects invalid or unsafe amount %s', input => {
    expect(moneyInputCents(input)).toBeNull();
  });
});
