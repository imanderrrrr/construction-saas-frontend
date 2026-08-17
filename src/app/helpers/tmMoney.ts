// BuildTrack — T&M arithmetic, in integer cents.
//
// The rule this file exists to keep: **format to display, never to calculate.**
// Money crosses the wire as `BigDecimal` scale 2 and lands in JavaScript as a
// double, which is fine to *print* and not fine to *multiply*. The capture form
// shows a running total while the encargado types, and that total is the number
// the client is about to sign — so it is computed here, in integers, and only
// turned into a string at the very end.
//
// `bigint` and not `number` for the product: the backend's own ceiling allows
// `999 personas × 99999,99 h × $1.000.000,00`, whose product in hundredths of a
// cent is ~1e18. That is past `Number.MAX_SAFE_INTEGER` (~9e15), where doubles
// stop counting by ones and start rounding — exactly the silent-wrong-number
// failure `TmTicket.computeLaborCents` uses `longValueExact()` to avoid on the
// server. Getting a *different* total than the backend is the one thing this
// preview must never do.

/**
 * Parse a user-typed decimal into integer minor units, or null if it is not a
 * clean number with at most [decimals] decimal places.
 *
 * String surgery, not `parseFloat`: `parseFloat('0.29') * 100` is 28.999…,
 * which floors to 28. Reading the digits directly is exact for every input the
 * form accepts, and rejecting (rather than rounding) anything with too many
 * decimals keeps the preview honest — the backend's `@Digits(fraction = 2)`
 * would reject it too, so silently rounding here would show a total the server
 * refuses to store.
 *
 * Accepts an optional leading `-`; the T&M fields are all non-negative, but the
 * parser has no business deciding that — the callers and the backend do.
 */
export function parseDecimalToMinorUnits(raw: string, decimals: number): bigint | null {
  const text = raw.trim();
  if (text === '') return null;

  const match = new RegExp(`^(-?)(\\d+)(?:[.,](\\d{0,${decimals}}))?$`).exec(text);
  if (!match) return null;

  const [, sign, whole, fraction = ''] = match;
  const scaled = BigInt(whole + fraction.padEnd(decimals, '0'));
  return sign === '-' ? -scaled : scaled;
}

/** `"20.50"` → `2050n`. Rejects a third decimal, as the backend does. */
export function parseAmountToCents(raw: string): bigint | null {
  return parseDecimalToMinorUnits(raw, 2);
}

/** `"7.5"` → `750n` hundredths of an hour. `hours` is `precision 7, scale 2`. */
export function parseHoursToHundredths(raw: string): bigint | null {
  return parseDecimalToMinorUnits(raw, 2);
}

/**
 * `personas × horas × tarifa`, rounded to a whole cent.
 *
 * Mirrors `TmTicket.computeLaborCents` and has to agree with it digit for
 * digit, because the encargado reads this number off the screen and says it out
 * loud before anyone signs anything.
 *
 * Two properties carried over from the Kotlin, both load-bearing:
 *
 *  - **Rounds once, at the end**, over the whole product — not per person and
 *    not per hour. Rounding earlier accumulates the error once per factor and
 *    the ticket stops adding up against itself.
 *  - **HALF_UP, not banker's rounding.** It is what someone doing this on paper
 *    does, and this number gets compared against theirs.
 *
 * @param hoursHundredths hours × 100, as an integer (`7.5 h` → `750n`)
 */
export function computeLaborCents(
  workerCount: bigint,
  hoursHundredths: bigint,
  hourlyRateCents: bigint,
): bigint {
  // Units: hundredths-of-an-hour × cents = cents × 100.
  const scaled = workerCount * hoursHundredths * hourlyRateCents;
  return divideRoundHalfUp(scaled, 100n);
}

/**
 * Integer division rounding halves **away from zero**, which is what
 * `RoundingMode.HALF_UP` means in Java (its name says "up", its behaviour is
 * "away from zero" — a distinction that only shows on negatives).
 *
 * No T&M field can currently be negative, so the negative branch is unreachable
 * from the form. It is written correctly anyway rather than assumed away: a
 * helper that is right only for the inputs its first caller happens to send is
 * a trap for the second one.
 */
export function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const negative = (numerator < 0n) !== (denominator < 0n);
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const absDenominator = denominator < 0n ? -denominator : denominator;

  const quotient = absNumerator / absDenominator;
  const remainder = absNumerator % absDenominator;
  const rounded = remainder * 2n >= absDenominator ? quotient + 1n : quotient;

  return negative ? -rounded : rounded;
}

/** The whole ticket: `labor + material`, both already in cents. */
export function computeTotalCents(laborCents: bigint, materialCents: bigint): bigint {
  return laborCents + materialCents;
}

/**
 * Money, the way the rest of this application writes it: `$1,850.00`.
 *
 * Deliberately NOT locale-aware, and that is the whole point. These helpers
 * used to run the amount through `Intl.NumberFormat(i18n.language, {style:
 * 'currency'})`, which in Spanish renders `1850,00 US$` — so a T&M total and
 * the budget figure on the neighbouring screen disagreed on both the separator
 * and where the symbol goes, with the decimal comma swapping meaning between
 * two panels of the same product.
 *
 * Every other money surface here is locale-independent and identical to this:
 * `BudgetOverview.fmtAmount` builds `$` + `toFixed(2)` + grouping by hand, and
 * `labor/shared.money` uses a hard `'en-US'`. Matching them is what makes the
 * numbers on adjacent screens comparable; being cleverer than them in one
 * module is what made T&M look foreign.
 *
 * A real currency migration (these amounts are quetzales, not dollars) is a
 * product decision for the whole app at once, not something one module gets to
 * do on its own.
 */
function formatMoney(value: number): string {
  // `toFixed` first so the grouping regex only ever sees a fixed 2-decimal
  // string, then insert separators into the integer part alone.
  const fixed = Math.abs(value).toFixed(2);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}$${grouped}.${fraction}`;
}

/**
 * Render integer cents as money.
 *
 * The one place a value is allowed to become a double, and only after every
 * multiplication is finished. Exact for anything inside `Number.MAX_SAFE_INTEGER`
 * — i.e. every amount short of the validation ceiling — and the ceiling itself
 * is unreachable through a form the backend would accept.
 *
 * Negatives are formatted, not suppressed. Nothing in this module clamps a
 * number at zero: on the budget gauges a negative *is* the answer, and a
 * formatter that hides it would be lying about how much an obra lost.
 */
export function formatCents(cents: bigint | number): string {
  return formatMoney(typeof cents === 'bigint' ? Number(cents) / 100 : cents / 100);
}

/**
 * Render a `BigDecimal` scale-2 field that arrived from the API.
 *
 * Jackson writes `BigDecimal` as a JSON number, so `total: 1234.56` reaches us
 * as a double. Printing it is safe; doing sums with it is not, which is why the
 * only thing this does is print.
 */
export function formatApiAmount(amount: number): string {
  return formatMoney(amount);
}
