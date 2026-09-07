// The shared catalogue and the two rules that are ours, not the API's.
//
// The names of the six states, the five categories, the eight history actions
// and the three traffic lights now live in `tools.*`. The point of moving them
// out of the component was that nothing on this screen — nor in the warehouse,
// the supervisor's or the mobile app — can print an English enum or a raw key
// at somebody, so that is what these check, in both languages.

import { describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import es from '../../../i18n/locales/es/tools.json';
import en from '../../../i18n/locales/en/tools.json';
import {
  actionName, categoryName, CATEGORIES, daysSince, isOut, lightName, pathsFrom, STATUSES, statusName,
} from './bits';

const t = i18n.getFixedT('es', ['tools', 'common']);
const tEn = i18n.getFixedT('en', ['tools', 'common']);

// Every action the contract can send, including the three that used to come
// out in English because they were a map inside the component.
const ACTIONS = [
  'Registered', 'Assigned', 'Returned', 'Status Changed', 'Reported',
  'Acceptance Pending', 'Accepted', 'Rejected',
];
const LIGHTS = ['In Stock', 'Low Stock', 'Out of Stock'];

describe('tools catalogue', () => {
  it('has the same keys in both languages, in the same order', () => {
    expect(Object.keys(es)).toEqual(Object.keys(en));
  });

  // In English several names legitimately equal the wire value ("Available",
  // "Measurement"); what must never happen is a key or a blank reaching the
  // screen, and in Spanish nothing may come out in English.
  it('resolves every state, category, action and light in both languages', () => {
    const cases: [(k: string) => string, string[]][] = [
      [s => statusName(t, s), STATUSES], [s => statusName(tEn, s), STATUSES],
      [s => categoryName(t, s), CATEGORIES], [s => categoryName(tEn, s), CATEGORIES],
      [s => actionName(t, s), ACTIONS], [s => actionName(tEn, s), ACTIONS],
      [s => lightName(t, s), LIGHTS], [s => lightName(tEn, s), LIGHTS],
    ];
    for (const [name, values] of cases) {
      for (const value of values) {
        expect(name(value)).not.toMatch(/^tools[.:]/);
        expect(name(value).trim()).not.toBe('');
      }
    }
  });

  it('says all of them in Spanish, none left in the wire\'s English', () => {
    for (const s of STATUSES) expect(statusName(t, s)).not.toBe(s);
    for (const c of CATEGORIES) expect(categoryName(t, c)).not.toBe(c);
    for (const a of ACTIONS) expect(actionName(t, a)).not.toBe(a);
    for (const l of LIGHTS) expect(lightName(t, l)).not.toBe(l);
  });

  it('falls back to the wire value rather than showing a key', () => {
    expect(statusName(t, 'Teleported')).toBe('Teleported');
    expect(actionName(t, 'Blessed')).toBe('Blessed');
  });
});

describe('pathsFrom', () => {
  it('never offers Assigned: assigning is a counter act, not a field', () => {
    for (const from of STATUSES) expect(pathsFrom(from)).not.toContain('Assigned');
  });

  it('never offers Pending Acceptance either, and never the status it is already in', () => {
    for (const from of STATUSES) {
      expect(pathsFrom(from)).not.toContain('Pending Acceptance');
      expect(pathsFrom(from)).not.toContain(from);
    }
  });

  it('offers nothing at all while the tool is out', () => {
    expect(pathsFrom('Assigned')).toEqual([]);
    expect(pathsFrom('Pending Acceptance')).toEqual([]);
  });

  it('offers the three legal paths from each status that has them', () => {
    expect(pathsFrom('Available')).toEqual(['In Review', 'Damaged', 'Lost']);
    expect(pathsFrom('In Review')).toEqual(['Available', 'Damaged', 'Lost']);
    expect(pathsFrom('Damaged')).toEqual(['In Review', 'Available', 'Lost']);
    expect(pathsFrom('Lost')).toEqual(['Available', 'In Review', 'Damaged']);
  });
});

describe('isOut', () => {
  it('counts the unsigned checkout as out, which is the whole thesis of the sheet', () => {
    expect(isOut('Pending Acceptance')).toBe(true);
    expect(isOut('Assigned')).toBe(true);
    expect(isOut('Available')).toBe(false);
    expect(isOut('In Review')).toBe(false);
    expect(isOut('Lost')).toBe(false);
  });
});

describe('daysSince', () => {
  it('is null with no date, so the row can print the date alone', () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince(undefined)).toBeNull();
  });

  it('counts whole days and never goes negative on a clock skew', () => {
    const now = Date.now();
    expect(daysSince(new Date(now - 2 * 86_400_000).toISOString())).toBe(2);
    expect(daysSince(new Date(now - 3600_000).toISOString())).toBe(0);
    expect(daysSince(new Date(now + 3600_000).toISOString())).toBe(0);
  });
});

describe('the counted phrases', () => {
  // Every number on this screen can be 1: one filter, one day unsigned, one
  // move in the history. i18next only reaches the plural forms when the key
  // has them, and a missing `_one` shows up as "1 días" — in Spanish first,
  // where nobody reading English tests would notice.
  const COUNTED = [
    'filter.clear', 'filter.conditions', 'row.unsigned', 'empty.filters.lead',
    'empty.filters.leadConsumables', 'detail.history', 'detail.holder.days',
    'detail.since', 'fixStatus.since',
  ];

  it('has _one and _other for every one of them, in both languages', () => {
    for (const dict of [es, en] as Record<string, string>[]) {
      for (const key of COUNTED) {
        expect(Object.keys(dict)).toContain(`${key}_one`);
        expect(Object.keys(dict)).toContain(`${key}_other`);
      }
    }
  });

  it('says "1 día" and not "1 días"', () => {
    expect(t('tools:detail.holder.days', { count: 1 })).toBe('1 día sin firmar');
    expect(t('tools:detail.holder.days', { count: 3 })).toBe('3 días sin firmar');
    expect(t('tools:filter.clear', { count: 1 })).toBe('Quitar el filtro');
    expect(t('tools:filter.clear', { count: 2 })).toBe('Quitar los 2 filtros');
  });

  it('composes the no-match line so its second number is plural too', () => {
    const one = t('tools:empty.filters.lead', { count: 9, conditions: t('tools:filter.conditions', { count: 1 }) });
    expect(one).toBe('Hay 9 herramientas, pero ninguna cumple la condición puesta.');
    const many = t('tools:empty.filters.lead', { count: 214, conditions: t('tools:filter.conditions', { count: 3 }) });
    expect(many).toBe('Hay 214 herramientas, pero ninguna cumple las 3 condiciones.');
  });
});
