// BuildTrack — the T&M module says everything in both languages, and says it
// from keys that actually exist.
//
// The second half is the one that catches real bugs: a `t('tm:foo.bar')` with
// no entry behind it renders the raw key on screen, and nothing in typecheck or
// lint notices. So this reads the component sources and checks every key they
// ask for.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../../../i18n/locales/en/tm.json';
import es from '../../../i18n/locales/es/tm.json';
import enSignatures from '../../../i18n/locales/en/signatures.json';
import esSignatures from '../../../i18n/locales/es/signatures.json';
import { TM_TICKET_STATUSES } from '../../services/tm';

const enMap = en as Record<string, string>;
const esMap = es as Record<string, string>;

const tokens = (s: string): string[] =>
  (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map(x => x.replace(/\s/g, '')).sort();

describe('tm locale coverage', () => {
  it('EN and ES define identical key sets', () => {
    expect(Object.keys(esMap).sort()).toEqual(Object.keys(enMap).sort());
  });

  it('no key is empty in either language', () => {
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

  it('labels every status the API can return', () => {
    for (const status of TM_TICKET_STATUSES) {
      expect(enMap[`status.${status}`], `en status.${status}`).toBeTruthy();
      expect(esMap[`status.${status}`], `es status.${status}`).toBeTruthy();
    }
  });

  it('keeps PENDING_SIGNATURE and DECLINED distinguishable', () => {
    // Both are unauthorised work; only one is still waiting. A screen that
    // gives them the same words loses the distinction the client cares about.
    expect(enMap['status.PENDING_SIGNATURE']).not.toBe(enMap['status.DECLINED']);
    expect(esMap['status.PENDING_SIGNATURE']).not.toBe(esMap['status.DECLINED']);
  });

  it('labels a T&M document on the public signing page', () => {
    // Without this the client's superintendent is handed a sheet that
    // introduces itself as "Invoice TM-000123".
    for (const map of [enSignatures, esSignatures] as Record<string, string>[]) {
      expect(map['kind.timeAndMaterial']).toBeTruthy();
      expect(map['kind.document']).toBeTruthy();
      expect(map['kind.timeAndMaterial']).not.toBe(map['kind.invoice']);
    }
  });
});

describe('every key the T&M components ask for exists', () => {
  const here = dirname(fileURLToPath(import.meta.url));

  const sources = readdirSync(here)
    .filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('.test.'))
    .map(f => ({ file: f, text: readFileSync(join(here, f), 'utf8') }));

  it('finds the component sources (guards against this test silently passing)', () => {
    expect(sources.length).toBeGreaterThan(3);
  });

  for (const { file, text } of sources) {
    it(`${file} only uses defined keys`, () => {
      const used = new Set<string>();
      for (const m of text.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1]);

      for (const raw of used) {
        // Dynamic keys (`status.${x}`) are covered by the status test above.
        if (raw.includes('${')) continue;

        const [ns, key] = raw.includes(':') ? raw.split(':') : ['tm', raw];
        const table: Record<string, Record<string, string>> = {
          tm: enMap,
          signatures: enSignatures as Record<string, string>,
        };
        const enTable = table[ns];
        expect(enTable, `unknown namespace "${ns}" in ${file}`).toBeTruthy();

        // i18next resolves `foo` from `foo_one`/`foo_other` when a count is
        // passed, so a plural key counts as defined.
        const defined = key in enTable
          || `${key}_one` in enTable
          || `${key}_other` in enTable;
        expect(defined, `${file} uses ${ns}:${key}, which is not defined`).toBe(true);
      }
    });
  }
});
