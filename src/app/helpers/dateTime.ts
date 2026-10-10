/**
 * Centralized date/time utilities that respect the business timezone setting.
 *
 * The authenticated tenant setting is held only for this session.
 */

let businessTimezone = 'America/Panama';
const DEFAULT_TZ = 'America/Panama';

// ── Core ────────────────────────────────────────────────────────────────

/** Read the configured business timezone. */
export function getBusinessTz(): string {
  return businessTimezone;
}

export function setBusinessTz(tz: string): void {
  // Validate before replacing the session's setting. Never inherit another tenant's cache.
  new Intl.DateTimeFormat('en', { timeZone: tz }).format();
  businessTimezone = tz;
}
export function resetBusinessTz(): void { businessTimezone = DEFAULT_TZ; }
export function businessDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: getBusinessTz(), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const value = (type: string) => parts.find(p => p.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
/** A civil date/time in the tenant zone. Reject DST gaps and repeated hours. */
export function businessDateTimeToISO(date: string, time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error('Invalid business time');
  const target = `${date}T${match[1].padStart(2, '0')}:${match[2]}`;
  const base = Date.parse(`${target}:00Z`);
  if (!Number.isFinite(base)) throw new Error('Invalid business date/time');
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: getBusinessTz(), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const local = (ms: number) => {
    const ps = fmt.formatToParts(new Date(ms));
    const v = (t: string) => ps.find(p => p.type === t)!.value;
    return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;
  };
  const candidates = new Set<number>();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const probe = base + delta * 3600000;
    const offset = Date.parse(`${local(probe)}:00Z`) - probe;
    const candidate = base - offset;
    if (local(candidate) === target) candidates.add(candidate);
  }
  if (candidates.size !== 1) throw new Error('Invalid or ambiguous business time');
  return new Date([...candidates][0]).toISOString();
}

// ── "Today" helpers ─────────────────────────────────────────────────────

/** Current date as YYYY-MM-DD in the business timezone. */
export function businessToday(): string {
  return businessDate(new Date().toISOString());
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
  const d = new Date(`${businessToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Filename-safe stamp: YYYY-MM-DD in business timezone. */
export function todayStamp(): string {
  return businessToday();
}

// ── Display formatting ──────────────────────────────────────────────────

/** Format a date-only ISO string (YYYY-MM-DD) for display. */
export function fmtDate(iso: string, locale: string = 'en-US'): string {
  const date = iso.includes('T') ? new Date(iso) : new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(locale, {
    timeZone: iso.includes('T') ? getBusinessTz() : 'UTC',
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Format a date-only ISO string with short format (no year). */
export function fmtDateShort(iso: string, locale: string = 'en-US'): string {
  const date = iso.includes('T') ? new Date(iso) : new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(locale, {
    timeZone: iso.includes('T') ? getBusinessTz() : 'UTC',
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
  return businessDateTimeToISO(dateStr, '00:00');
}

/**
 * Convert a YYYY-MM-DD (in business TZ) to a UTC ISO string
 * representing end-of-day (23:59:59.999) in the business timezone.
 */
export function endOfDayISO(dateStr: string): string {
  return new Date(Date.parse(businessDateTimeToISO(dateStr, '23:59')) + 59999).toISOString();
}

// ── Business logic helpers ──────────────────────────────────────────────

/** Number of calendar days a due date is overdue (0 if not overdue). */
export function daysOverdue(dueDate: string): number {
  const today = businessToday();
  const t = new Date(`${today}T00:00:00Z`).getTime();
  const d = new Date(`${dueDate}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((t - d) / 86_400_000));
}
