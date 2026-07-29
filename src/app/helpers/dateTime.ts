/**
 * Centralized date/time utilities that respect the business timezone setting.
 *
 * All formatting and "today" computations use the timezone stored in
 * localStorage under `ofjr_business_timezone` (set by TimezoneSwitcher).
 */

const STORAGE_KEY = 'ofjr_business_timezone';
const DEFAULT_TZ = 'America/Panama';

// ── Core ────────────────────────────────────────────────────────────────

/** Read the configured business timezone. */
export function getBusinessTz(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_TZ;
}

// ── "Today" helpers ─────────────────────────────────────────────────────

/** Current date as YYYY-MM-DD in the business timezone. */
export function businessToday(): string {
  return formatInTz(new Date(), 'en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

/** Current month as YYYY-MM in the business timezone. */
export function currentMonth(): string {
  return businessToday().slice(0, 7);
}

/** Current business month formatted for display (e.g. "Jul 2026" / "jul 2026"). */
export function currentMonthLabel(locale: string = 'en-US'): string {
  // Local-midnight parse + local-tz format: the business-TZ month is already
  // baked into currentMonth(), so re-applying the business TZ here could
  // shift the label into the previous month.
  return new Date(`${currentMonth()}-01T00:00:00`)
    .toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}

/** Date N days ago as YYYY-MM-DD in the business timezone. */
export function nDaysAgo(n: number): string {
  // Walk back calendar days to avoid DST 23/25-hour issues
  const today = businessToday();
  const d = new Date(`${today}T12:00:00`); // noon avoids DST edge
  d.setDate(d.getDate() - n);
  return formatInTz(d, 'en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

/** Filename-safe stamp: YYYY-MM-DD in business timezone. */
export function todayStamp(): string {
  return businessToday();
}

// ── Display formatting ──────────────────────────────────────────────────

/** Format a date-only ISO string (YYYY-MM-DD) for display. */
export function fmtDate(iso: string, locale: string = 'en-US'): string {
  const date = iso.includes('T') ? new Date(iso) : new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(locale, {
    timeZone: getBusinessTz(),
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Format a date-only ISO string with short format (no year). */
export function fmtDateShort(iso: string, locale: string = 'en-US'): string {
  const date = iso.includes('T') ? new Date(iso) : new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(locale, {
    timeZone: getBusinessTz(),
    month: 'short', day: 'numeric',
  });
}

/** Format a full ISO timestamp for display (date + time). */
export function fmtDateTime(iso: string, locale: string = 'en-US'): string {
  return new Date(iso).toLocaleString(locale, {
    timeZone: getBusinessTz(),
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/** Format a full ISO timestamp showing date, time and seconds. */
export function fmtDateTimeFull(iso: string, locale: string = 'en-US'): string {
  return new Date(iso).toLocaleString(locale, {
    timeZone: getBusinessTz(),
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

/** Format only the time portion of an ISO timestamp. */
export function fmtTime(iso: string, locale: string = 'en-US'): string {
  return new Date(iso).toLocaleString(locale, {
    timeZone: getBusinessTz(),
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ── Date-range / filter helpers ─────────────────────────────────────────

/**
 * Convert a YYYY-MM-DD (in business TZ) to a UTC ISO string
 * representing midnight (00:00:00) in the business timezone.
 */
export function startOfDayISO(dateStr: string): string {
  const offsetMs = tzOffsetMs(new Date(`${dateStr}T00:00:00Z`));
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + offsetMs).toISOString();
}

/**
 * Convert a YYYY-MM-DD (in business TZ) to a UTC ISO string
 * representing end-of-day (23:59:59.999) in the business timezone.
 */
export function endOfDayISO(dateStr: string): string {
  const offsetMs = tzOffsetMs(new Date(`${dateStr}T23:59:59Z`));
  return new Date(new Date(`${dateStr}T23:59:59.999Z`).getTime() + offsetMs).toISOString();
}

// ── Business logic helpers ──────────────────────────────────────────────

/** Number of calendar days a due date is overdue (0 if not overdue). */
export function daysOverdue(dueDate: string): number {
  const today = businessToday();
  const t = new Date(`${today}T00:00:00`).getTime();
  const d = new Date(`${dueDate}T00:00:00`).getTime();
  return Math.max(0, Math.floor((t - d) / 86_400_000));
}

// ── Internal ────────────────────────────────────────────────────────────

/** Format a Date in the business timezone with the given Intl options. */
function formatInTz(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: getBusinessTz(),
  }).format(date);
}

/**
 * Compute the UTC offset (in ms) for the business timezone at a given instant.
 * Positive means the business TZ is behind UTC (e.g. UTC-5 → +18_000_000).
 */
function tzOffsetMs(refDate: Date): number {
  const tz = getBusinessTz();
  const utcStr = refDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = refDate.toLocaleString('en-US', { timeZone: tz });
  return new Date(utcStr).getTime() - new Date(tzStr).getTime();
}
