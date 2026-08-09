import { describe, it, expect } from 'vitest';
import en from '../../i18n/locales/en/signatures.json';
import es from '../../i18n/locales/es/signatures.json';

const enMap = en as Record<string, string>;
const esMap = es as Record<string, string>;

const tokens = (s: string): string[] => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((x) => x.replace(/\s/g, '')).sort();

describe('signatures locale coverage', () => {
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

  it('never promises legal validity — that is a lawyer call, not a UI label', () => {
    // The client asked for signatures partly for court. What makes them useful
    // there is the trail, not a label we print; and "electronic signature"
    // has a specific, jurisdiction-dependent meaning we must not claim.
    const forbidden = /legalmente v[áa]lid|validez legal|legally binding|legally valid|firma electr[óo]nica avanzada/i;
    for (const [k, v] of [...Object.entries(enMap), ...Object.entries(esMap)]) {
      expect(forbidden.test(v), `${k} claims legal validity: "${v}"`).toBe(false);
    }
  });
});
