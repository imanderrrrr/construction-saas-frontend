// BuildTrack — every text Cobrar and Pagar ask for exists in both languages.
//
// A `t('finance:foo')` with no entry behind it renders the raw key on screen,
// and neither typecheck nor lint notices. OFJR's QuickBooks end-to-end test
// caught exactly that on its receivables screen (a 409 on "record payment"
// toasted «receivable.toast.paymentFailed»), so this reads the sources and
// checks every literal key they name — the QuickBooks phase-4 ones included,
// also those picked by a ternary inside t(…).

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import enFinance from '../../../i18n/locales/en/finance.json';
import esFinance from '../../../i18n/locales/es/finance.json';
import enCommon from '../../../i18n/locales/en/common.json';
import esCommon from '../../../i18n/locales/es/common.json';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCES = readdirSync(HERE)
  .filter(f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map(f => ({ file: f, text: readFileSync(join(HERE, f), 'utf8') }));

type Table = Record<string, string>;
const TABLES: Record<'en' | 'es', Record<'finance' | 'common', Table>> = {
  en: { finance: enFinance as Table, common: enCommon as Table },
  es: { finance: esFinance as Table, common: esCommon as Table },
};

/** i18next resolves `foo` from `foo_one`/`foo_other` when a count is passed. */
const defines = (table: Table, key: string) => key in table || `${key}_one` in table || `${key}_other` in table;

/** Whether `ns:key` (or a bare key, which these screens look up in finance, then common) exists. */
function resolves(lang: 'en' | 'es', raw: string): boolean {
  const [ns, key] = raw.includes(':') ? raw.split(':', 2) as [string, string] : [null, raw];
  if (ns === 'finance' || ns === 'common') return defines(TABLES[lang][ns], key);
  if (ns) return true; // another namespace: its own screens' tests own it
  return defines(TABLES[lang].finance, key) || defines(TABLES[lang].common, key);
}

describe('finance texts named by Cobrar and Pagar', () => {
  it('every literal key passed to t(…) exists in Spanish and English', () => {
    let checked = 0;
    for (const { file, text } of SOURCES) {
      for (const m of text.matchAll(/\bt\(\s*'([^'`$]+)'/g)) {
        checked++;
        expect(resolves('es', m[1]), `${file}: es ${m[1]}`).toBe(true);
        expect(resolves('en', m[1]), `${file}: en ${m[1]}`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('the QuickBooks phase-4 texts, picked by a ternary inside t(…), exist in both languages', () => {
    const quoted = SOURCES.flatMap(({ text }) =>
      [...text.matchAll(/'((?:finance:)?(?:paymentOrigin|payable\.delete|payable\.reassign|receivable\.delete|receivable\.action)\.[\w.]+)'/g)].map(m => m[1]));
    const keys = [...new Set(quoted)];
    expect(keys).toEqual(expect.arrayContaining([
      'finance:payable.delete.quickbooksPaymentsHint', 'finance:payable.delete.hasQuickBooksPayments',
      'finance:payable.reassign.quickbooksPaymentsHint', 'finance:receivable.action.deleteBlockedQuickBooks',
    ]));
    for (const k of keys) {
      expect(resolves('es', k), `es ${k}`).toBe(true);
      expect(resolves('en', k), `en ${k}`).toBe(true);
    }
  });

  it('the reassign refusal has a sentence for a bill paid in QuickBooks, as the dialog builds its key', () => {
    for (const lang of ['es', 'en'] as const) {
      expect(defines(TABLES[lang].finance, 'payable.reassign.hasQuickBooksPayments'), lang).toBe(true);
      expect(defines(TABLES[lang].finance, 'receivable.delete.hasQuickBooksPayments'), lang).toBe(true);
    }
  });
});
