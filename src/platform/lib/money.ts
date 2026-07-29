/**
 * USD-cents helpers for the console's billing surfaces. The wire format is
 * integer cents everywhere (backend `Long`); staff type dollars.
 */

/**
 * Backend bounds for a negotiated Paddle price, mirrored from
 * PlatformTenantProvisioningService (MIN/MAX_CUSTOM_PRICE_CENTS). A
 * fat-finger guard, not a business rule: $10.00–$50,000.00 per period.
 */
export const MIN_CUSTOM_PRICE_CENTS = 1_000;
export const MAX_CUSTOM_PRICE_CENTS = 5_000_000;

/** USD cents → "$1,234.50". Console has no shared money util; matches BudgetManagement. */
export function fmtCents(cents: number): string {
  const dollars = cents / 100;
  const sign = dollars < 0 ? '-' : '';
  return `${sign}$${Math.abs(dollars).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Parse a staff-typed USD amount ("350", "350.5", "$1,250.00") to integer
 * cents. Returns null unless it is a plain positive amount with at most two
 * decimals — anything fancier (negatives, exponents, stray text) is a typo,
 * not money.
 */
export function parseUsdToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}
