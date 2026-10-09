// AUD-019 — English no longer falls back to Spanish: an English visitor
// downloads only the English tables. That is safe only while both languages
// carry the same keys, every one of them with text. This is that guarantee.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const LOCALES = join(dirname(fileURLToPath(import.meta.url)), 'locales');
const table = (lng: string, ns: string) => JSON.parse(readFileSync(join(LOCALES, lng, `${ns}.json`), 'utf8')) as Record<string, unknown>;
const namespaces = (lng: string) => readdirSync(join(LOCALES, lng)).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort();

describe('es and en are complete twins', () => {
  it('have the same namespaces', () => {
    expect(namespaces('en')).toEqual(namespaces('es'));
    expect(namespaces('es').length).toBeGreaterThan(20);
  });

  it.each(namespaces('es'))('%s has the same keys in both languages, each with text', ns => {
    const es = table('es', ns);
    const en = table('en', ns);
    expect(Object.keys(en).filter(k => !(k in es)), `only in en/${ns}`).toEqual([]);
    expect(Object.keys(es).filter(k => !(k in en)), `only in es/${ns}`).toEqual([]);
    for (const [lng, t] of [['es', es], ['en', en]] as const) {
      const blank = Object.entries(t).filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k);
      expect(blank, `blank values in ${lng}/${ns}`).toEqual([]);
    }
  });
});
