import { describe, it, expect } from 'vitest';
import {
  computeLaborCents,
  computeTotalCents,
  divideRoundHalfUp,
  formatApiAmount,
  formatCents,
  parseAmountToCents,
  parseDecimalToMinorUnits,
  parseHoursToHundredths,
} from './tmMoney';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

describe('parseAmountToCents', () => {
  it('reads the digits exactly where parseFloat would not', () => {
    // The canonical float trap: parseFloat('0.29') * 100 === 28.999999999999996,
    // which truncates to 28 — a cent lost on a number the client signs.
    expect(Math.trunc(parseFloat('0.29') * 100)).toBe(28);
    expect(parseAmountToCents('0.29')).toBe(29n);

    expect(parseAmountToCents('1.10')).toBe(110n);
    expect(parseAmountToCents('20')).toBe(2000n);
    expect(parseAmountToCents('20.5')).toBe(2050n);
    expect(parseAmountToCents('1000000.00')).toBe(100000000n);
  });

  it('accepts a comma as the decimal mark, for a Spanish keyboard', () => {
    expect(parseAmountToCents('20,50')).toBe(2050n);
  });

  it('rejects a third decimal instead of rounding it away', () => {
    // The backend's @Digits(fraction = 2) would refuse this. Rounding here
    // would show a total the server will not store.
    expect(parseAmountToCents('1.234')).toBeNull();
  });

  it('rejects junk, blanks and lone separators', () => {
    for (const bad of ['', '   ', 'abc', '1.2.3', '-', '.', '$20', '1e3', '2 0']) {
      expect(parseAmountToCents(bad), `for ${JSON.stringify(bad)}`).toBeNull();
    }
  });

  it('tolerates the half-typed "20." mid-keystroke rather than blanking the total', () => {
    expect(parseAmountToCents('20.')).toBe(2000n);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseAmountToCents('  20.50  ')).toBe(2050n);
  });
});

describe('parseHoursToHundredths', () => {
  it('scales hours by 100', () => {
    expect(parseHoursToHundredths('7.5')).toBe(750n);
    expect(parseHoursToHundredths('8')).toBe(800n);
    expect(parseHoursToHundredths('99999.99')).toBe(9999999n);
  });
});

describe('parseDecimalToMinorUnits', () => {
  it('honours the requested number of decimals', () => {
    expect(parseDecimalToMinorUnits('1.5', 3)).toBe(1500n);
    expect(parseDecimalToMinorUnits('1.5', 0)).toBeNull();
    expect(parseDecimalToMinorUnits('1', 0)).toBe(1n);
  });

  it('carries a negative sign through', () => {
    expect(parseDecimalToMinorUnits('-2.50', 2)).toBe(-250n);
  });
});

describe('divideRoundHalfUp', () => {
  it('rounds halves away from zero, like Java HALF_UP', () => {
    expect(divideRoundHalfUp(150n, 100n)).toBe(2n);
    expect(divideRoundHalfUp(250n, 100n)).toBe(3n); // not 2n — this is not HALF_EVEN
    expect(divideRoundHalfUp(149n, 100n)).toBe(1n);
    expect(divideRoundHalfUp(-150n, 100n)).toBe(-2n);
    expect(divideRoundHalfUp(-149n, 100n)).toBe(-1n);
  });
});

describe('computeLaborCents', () => {
  it('matches the worked example: 3 people x 7.5 h x $20.00', () => {
    // 3 × 7.5 × 2000 cents = 45000 cents = $450.00
    expect(computeLaborCents(3n, 750n, 2000n)).toBe(45000n);
  });

  it('rounds once over the whole product, not per factor', () => {
    // 3 × 1.00 h × $0.335 is not expressible, so use a rate whose per-person
    // product is fractional: 7 people × 0.33 h × $10.01 = 23.1231 → 2312 cents.
    // Rounding each person's share first (0.33 × 1001 = 330.33 → 330) and then
    // multiplying gives 2310 — two cents adrift on a signed document.
    expect(computeLaborCents(7n, 33n, 1001n)).toBe(2312n);
    expect(divideRoundHalfUp(33n * 1001n, 100n) * 7n).toBe(2310n);
  });

  it('rounds an exact half-cent up, and anything under it down', () => {
    // 1 × 0.10 h × $0.05 = 0.5 cents — the tie. HALF_UP takes it to 1.
    expect(computeLaborCents(1n, 10n, 5n)).toBe(1n);
    // 1 × 0.09 h × $0.05 = 0.45 cents — under the tie, so down to 0.
    expect(computeLaborCents(1n, 9n, 5n)).toBe(0n);
  });

  it('stays exact where a Number implementation loses a cent', () => {
    // 990 people × 99990.05 h × $999,999.99 — all inside the backend's own
    // @Max / @DecimalMax ceilings, so this is a ticket the server would accept.
    // The product lands past Number.MAX_SAFE_INTEGER, where doubles stop
    // counting by ones: the same arithmetic in Number comes out one cent low.
    const exact = computeLaborCents(990n, 9999005n, 99999999n);

    expect(exact).toBe(9899014851009851n);
    expect(exact > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(BigInt(Math.round((990 * 9999005 * 99999999) / 100))).toBe(9899014851009850n);
  });

  it('is zero when any factor is zero', () => {
    expect(computeLaborCents(0n, 750n, 2000n)).toBe(0n);
    expect(computeLaborCents(3n, 0n, 2000n)).toBe(0n);
    expect(computeLaborCents(3n, 750n, 0n)).toBe(0n);
  });
});

describe('computeTotalCents', () => {
  it('adds material to labour', () => {
    expect(computeTotalCents(45000n, 12550n)).toBe(57550n);
  });
});

describe('formatCents', () => {
  it('formats bigint cents as money', () => {
    expect(formatCents(57550n)).toBe('$575.50');
    expect(formatCents(0n)).toBe('$0.00');
  });

  it('shows a negative as negative — the gauge never clamps at zero', () => {
    expect(formatCents(-57550n)).toBe('-$575.50');
  });

  it('groups thousands the way the rest of the app does', () => {
    expect(formatCents(185000n)).toBe('$1,850.00');
    expect(formatCents(123456789n)).toBe('$1,234,567.89');
  });
});

describe('formatApiAmount', () => {
  it('prints a scale-2 amount that arrived as a JSON number', () => {
    expect(formatApiAmount(575.5)).toBe('$575.50');
    expect(formatApiAmount(-575.5)).toBe('-$575.50');
  });

  /**
   * The bug this format exists to prevent: these helpers used to take the
   * active i18n language, so the same amount read `$1,850.00` next to a budget
   * figure in English and `1850,00 US$` in Spanish — the decimal comma
   * swapping meaning between two panels of the same product.
   */
  it('does not change with the interface language', () => {
    const before = Intl.NumberFormat;
    try {
      // Any locale-aware path would show up here as a different string.
      Intl.NumberFormat = (() => { throw new Error('formatting must not be locale-aware'); }) as never;
      expect(formatApiAmount(1850)).toBe('$1,850.00');
      expect(formatCents(185000n)).toBe('$1,850.00');
    } finally {
      Intl.NumberFormat = before;
    }
  });
});

describe('the mirror of FieldLimits.kt', () => {
  it('carries the money ceiling and its integer-digit count, in agreement', () => {
    expect(FIELD_LIMITS.MONEY_AMOUNT).toBe('1000000.00');
    expect(FIELD_LIMITS.MONEY_INTEGER_DIGITS).toBe(7);

    // The pair has to agree: the digit count must describe the ceiling, or one
    // bound silently permits what the other rejects.
    const [whole] = FIELD_LIMITS.MONEY_AMOUNT.split('.');
    expect(whole.length).toBe(FIELD_LIMITS.MONEY_INTEGER_DIGITS);
  });

  it('is parseable by the same parser the form uses', () => {
    expect(parseAmountToCents(FIELD_LIMITS.MONEY_AMOUNT)).toBe(100000000n);
  });
});
