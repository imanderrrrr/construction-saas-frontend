import { describe, it, expect } from 'vitest';
import en from '../../../i18n/locales/en/rfi.json';
import es from '../../../i18n/locales/es/rfi.json';

const enMap = en as Record<string, string>;
const esMap = es as Record<string, string>;

const tokens = (s: string): string[] => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((x) => x.replace(/\s/g, '')).sort();

describe('rfi locale coverage', () => {
  it('EN and ES define identical key sets', () => {
    expect(Object.keys(esMap).sort()).toEqual(Object.keys(enMap).sort());
  });

  it('no key has an empty value in either language', () => {
    for (const [k, v] of Object.entries(enMap)) {
      expect(typeof v === 'string' && v.trim().length > 0, `en:${k}`).toBe(true);
    }
    for (const [k, v] of Object.entries(esMap)) {
      expect(typeof v === 'string' && v.trim().length > 0, `es:${k}`).toBe(true);
    }
  });

  it('interpolation tokens match between EN and ES for every key', () => {
    for (const k of Object.keys(enMap)) {
      expect(tokens(esMap[k]), `tokens differ for ${k}`).toEqual(tokens(enMap[k]));
    }
  });

  it('every status, ball, impact and event type is labeled', () => {
    for (const status of ['DRAFT', 'OPEN', 'RESPONDED', 'CLOSED']) {
      expect(enMap[`status.${status}`], `status.${status}`).toBeTruthy();
    }
    expect(enMap['status.overdue']).toBeTruthy();
    for (const ball of ['CLIENT', 'COMPANY']) {
      expect(enMap[`ball.${ball}`], `ball.${ball}`).toBeTruthy();
    }
    for (const impact of ['YES', 'NO', 'TBD']) {
      expect(enMap[`impact.${impact}`], `impact.${impact}`).toBeTruthy();
    }
    for (const event of ['CREATED', 'SUBMITTED', 'RESPONDED', 'COMMENTED', 'CLOSED']) {
      expect(enMap[`internal.event.${event}`], `internal.event.${event}`).toBeTruthy();
    }
  });
});
