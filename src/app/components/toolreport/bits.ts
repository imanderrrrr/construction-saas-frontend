/**
 * The rules of the report that are ours, not the API's.
 *
 * Two of them decide colours and one decides a column of numbers, and all
 * three are here rather than inside a component so the screen — and, when it
 * exists, the document — cannot round or colour the same figure two different
 * ways.
 */

/** Out longer than this and somebody has to make a phone call. */
export const OVERDUE_DAYS = 30;
/** The quiet stretch: a number that needs no colour. */
export const CALM_DAYS = 7;

export type DaysTone = 'calm' | 'warn' | 'late';

/**
 * Three stretches, two colours.
 *
 * The cuts are the ones the site already recognises. What changed is the
 * middle colour: the amber was a fourth accent inherited from the warehouse
 * panel and it is gone here too, so the middle stretch is the system orange
 * and the high one is solid red. The calm stretch is not painted green — a
 * number nobody has to act on does not need a colour.
 */
export function daysTone(days: number | null | undefined): DaysTone {
  if (days == null) return 'calm';
  if (days > OVERDUE_DAYS) return 'late';
  return days > CALM_DAYS ? 'warn' : 'calm';
}

/**
 * Percentages of one decimal that add to exactly 100.
 *
 * Rounding each share on its own leaves the column at 99.9 or 100.1, and a
 * report whose own total contradicts its rows is not a report. The difference
 * goes to the largest remainder, which is the standard way of settling it and
 * the one the sheet asks for by name.
 *
 * Returns tenths-of-a-percent as integers so callers can format them without
 * re-introducing floating point drift; `[]` when there is nothing to divide.
 */
export function largestRemainder(counts: number[], total: number): number[] {
  if (total <= 0) return counts.map(() => 0);

  const exact = counts.map(c => (c * 1000) / total);
  const floors = exact.map(Math.floor);
  let left = 1000 - floors.reduce((a, b) => a + b, 0);

  // Ties go to the bigger count, then to the earlier row: the order is the
  // enum's, so the same inventory always produces the same column.
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value), count: counts[index] }))
    .sort((a, b) => b.remainder - a.remainder || b.count - a.count || a.index - b.index);

  const out = [...floors];
  for (const row of order) {
    if (left <= 0) break;
    out[row.index] += 1;
    left -= 1;
  }
  return out;
}

/** 589 → "58,9" in Spanish, "58.9" in English. */
export function formatTenths(tenths: number, lang: string): string {
  const value = (tenths / 10).toFixed(1);
  return lang.startsWith('es') ? value.replace('.', ',') : value;
}

/** 8.4 → "8,4" / "8.4". The unit is a translated phrase, never appended here. */
export function formatOneDecimal(value: number, lang: string): string {
  const text = value.toFixed(1);
  return lang.startsWith('es') ? text.replace('.', ',') : text;
}

/** "12 jul" — the day a tool left, short enough for a table cell. */
export function stampDay(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

/** "7 de septiembre de 2026" — for the line that says what the report covers. */
export function stampLongDay(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** "14:32". */
export function stampTime(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString(lang.startsWith('es') ? 'es-GT' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}
