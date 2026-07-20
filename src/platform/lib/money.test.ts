import { describe, expect, it } from 'vitest';

import { fmtCents, MAX_CUSTOM_PRICE_CENTS, MIN_CUSTOM_PRICE_CENTS, parseUsdToCents } from './money';

describe('parseUsdToCents', () => {
  it('parses whole dollars', () => {
    expect(parseUsdToCents('350')).toBe(35_000);
  });

  it('parses one and two decimal places', () => {
    expect(parseUsdToCents('350.5')).toBe(35_050);
    // 349.99 * 100 is 34998.999… in floats — the round must land on 34999.
    expect(parseUsdToCents('349.99')).toBe(34_999);
  });

  it('tolerates a leading $ and thousands separators', () => {
    expect(parseUsdToCents('$1,250')).toBe(125_000);
    expect(parseUsdToCents(' 1,250.75 ')).toBe(125_075);
  });

  it('rejects anything that is not a plain positive amount', () => {
    expect(parseUsdToCents('')).toBeNull();
    expect(parseUsdToCents('abc')).toBeNull();
    expect(parseUsdToCents('35o')).toBeNull();
    expect(parseUsdToCents('-5')).toBeNull();
    expect(parseUsdToCents('10.999')).toBeNull(); // sub-cent precision
    expect(parseUsdToCents('1e3')).toBeNull();
    expect(parseUsdToCents('10.')).toBeNull();
  });

  it('brackets the backend bounds exactly', () => {
    expect(parseUsdToCents('10')).toBe(MIN_CUSTOM_PRICE_CENTS);
    expect(parseUsdToCents('50000')).toBe(MAX_CUSTOM_PRICE_CENTS);
  });
});

describe('fmtCents', () => {
  it('formats cents as grouped dollars', () => {
    expect(fmtCents(35_000)).toBe('$350.00');
    expect(fmtCents(125_075)).toBe('$1,250.75');
    expect(fmtCents(5_000_000)).toBe('$50,000.00');
  });
});
