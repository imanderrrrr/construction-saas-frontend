// The three rules that are ours, not the API's.

import { describe, expect, it } from 'vitest';
import { CALM_DAYS, daysTone, formatOneDecimal, formatTenths, largestRemainder, OVERDUE_DAYS } from './bits';

describe('largestRemainder', () => {
  // The whole point of the block: a column that adds to exactly 100,0.
  const adds = (counts: number[]) => {
    const total = counts.reduce((a, b) => a + b, 0);
    return largestRemainder(counts, total).reduce((a, b) => a + b, 0);
  };

  it('adds to 1000 tenths on the sheet\'s own inventory', () => {
    const shares = largestRemainder([126, 61, 14, 7, 4, 2], 214);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(shares.map(s => formatTenths(s, 'es'))).toEqual(['58,9', '28,5', '6,5', '3,3', '1,9', '0,9']);
  });

  it('adds to 100 for every split that would otherwise round to 99,9 or 100,1', () => {
    expect(adds([1, 1, 1])).toBe(1000);
    expect(adds([1, 1, 1, 1, 1, 1, 1])).toBe(1000);
    expect(adds([2, 2, 2, 1])).toBe(1000);
    expect(adds([33, 33, 33, 1])).toBe(1000);
    expect(adds([5, 5, 5, 5, 5, 5])).toBe(1000);
  });

  it('draws a state with no rows as a real zero', () => {
    const shares = largestRemainder([33, 24, 6, 3, 2, 0], 68);
    expect(shares[5]).toBe(0);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('has nothing to divide when the universe is empty', () => {
    expect(largestRemainder([0, 0, 0], 0)).toEqual([0, 0, 0]);
  });

  it('settles a tie by count, then by the enum order, so the column is stable', () => {
    expect(largestRemainder([1, 1, 1], 3)).toEqual([334, 333, 333]);
  });
});

describe('daysTone', () => {
  it('leaves the quiet stretch without colour', () => {
    expect(daysTone(0)).toBe('calm');
    expect(daysTone(CALM_DAYS)).toBe('calm');
    expect(daysTone(null)).toBe('calm');
  });

  it('turns orange past a week and red past a month, with no amber in between', () => {
    expect(daysTone(CALM_DAYS + 1)).toBe('warn');
    expect(daysTone(OVERDUE_DAYS)).toBe('warn');
    expect(daysTone(OVERDUE_DAYS + 1)).toBe('late');
    expect(daysTone(57)).toBe('late');
  });
});

describe('the decimal comma', () => {
  it('writes a comma in Spanish and a point in English', () => {
    expect(formatOneDecimal(8.4, 'es')).toBe('8,4');
    expect(formatOneDecimal(8.4, 'en')).toBe('8.4');
    expect(formatTenths(350, 'es')).toBe('35,0');
    expect(formatTenths(350, 'en-US')).toBe('35.0');
  });
});
