// BuildTrack — the QuickBooks section speaks both languages, from keys that
// exist, and has a sentence for every way the trip through Intuit can end. A
// missing `outcome.X` would put the raw code on screen at the worst possible
// moment: right after the admin came back from Intuit wondering whether it
// worked. REALM_IN_USE is the multi-tenant ending OFJR never had.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../../../i18n/locales/en/quickbooks.json';
import es from '../../../i18n/locales/es/quickbooks.json';
import enAdmin from '../../../i18n/locales/en/admin.json';
import esAdmin from '../../../i18n/locales/es/admin.json';
import { parseQuickBooksOutcome, QUICKBOOKS_OUTCOMES } from '../../services/quickbooks';

const enMap = en as Record<string, string>;
const esMap = es as Record<string, string>;

const tokens = (s: string): string[] =>
  (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map(x => x.replace(/\s/g, '')).sort();

const HERE = dirname(fileURLToPath(import.meta.url));
const source = (file: string) => readFileSync(join(HERE, file), 'utf8');

/** i18next resolves `foo` from `foo_one`/`foo_other` when a count is passed. */
const defines = (table: Record<string, string>, key: string) =>
  key in table || `${key}_one` in table || `${key}_other` in table;

describe('quickbooks locale coverage', () => {
  it('EN and ES define identical key sets, none empty', () => {
    expect(Object.keys(esMap).sort()).toEqual(Object.keys(enMap).sort());
    for (const [k, v] of [...Object.entries(enMap), ...Object.entries(esMap)]) {
      expect(v.trim().length > 0, k).toBe(true);
    }
  });

  it('interpolation tokens match between EN and ES', () => {
    for (const k of Object.keys(enMap)) {
      expect(tokens(esMap[k]), k).toEqual(tokens(enMap[k]));
    }
  });

  it('has a sentence for every callback outcome, REALM_IN_USE included', () => {
    expect(QUICKBOOKS_OUTCOMES).toContain('REALM_IN_USE');
    for (const outcome of QUICKBOOKS_OUTCOMES) {
      expect(enMap[`outcome.${outcome}`], `en outcome.${outcome}`).toBeTruthy();
      expect(esMap[`outcome.${outcome}`], `es outcome.${outcome}`).toBeTruthy();
    }
  });

  it('has a sentence for every lastError code the server stores', () => {
    for (const code of ['REFRESH_REJECTED', 'COMPANY_INFO_FAILED', 'ENVIRONMENT_CHANGED']) {
      expect(enMap[`error.${code}`], code).toBeTruthy();
      expect(esMap[`error.${code}`], code).toBeTruthy();
    }
  });

  it('every static key the two screens ask for is defined in both languages', () => {
    for (const file of ['QuickBooksSection.tsx', 'QuickBooksMapping.tsx']) {
      const text = source(file);
      for (const m of text.matchAll(/\bt\(\s*'([^']+)'/g)) {
        const key = m[1];
        if (key.includes('${')) continue;
        const bare = key.startsWith('quickbooks:') ? key.slice('quickbooks:'.length) : key;
        if (bare.startsWith('finance:')) continue;
        expect(defines(enMap, bare), `${file}: en ${bare}`).toBe(true);
        expect(defines(esMap, bare), `${file}: es ${bare}`).toBe(true);
      }
    }
  });

  it('labels the section in the admin menu, header and first-visit banner', () => {
    for (const map of [enAdmin, esAdmin] as Record<string, string>[]) {
      expect(map['nav.quickbooks']).toBeTruthy();
      expect(map['section.quickbooks.title']).toBeTruthy();
      expect(map['section.quickbooks.subtitle']).toBeTruthy();
      for (const k of ['title', 'body', 'b1', 'b2']) expect(map[`sec.quickbooks.${k}`], `sec.quickbooks.${k}`).toBeTruthy();
    }
  });
});

describe('parseQuickBooksOutcome', () => {
  it('reads a known outcome and ignores anything else', () => {
    expect(parseQuickBooksOutcome('?quickbooks=CONNECTED')).toBe('CONNECTED');
    expect(parseQuickBooksOutcome('?x=1&quickbooks=REALM_IN_USE')).toBe('REALM_IN_USE');
    expect(parseQuickBooksOutcome('?quickbooks=<script>')).toBeNull();
    expect(parseQuickBooksOutcome('')).toBeNull();
  });
});
