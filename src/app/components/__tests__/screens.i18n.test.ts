// BuildTrack — the five screens that used to speak English in a Spanish panel.
//
// Typecheck and lint are both blind to this class of bug: a literal `Pending`
// in JSX, or `toLocaleDateString('en-US')`, is valid TypeScript. It only shows
// up when someone looks at the panel — which is how these five were found.
//
// So this test reads the component sources and asserts two things:
//   1. every key they ask for is defined, in BOTH languages;
//   2. they do not pin a display locale to English.
//
// The second half is the regression guard. The first half is the one that
// catches the other direction — a `t()` with nothing behind it renders the raw
// key on screen, and nothing else in the build notices.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPONENTS = join(HERE, '..');
const LOCALES = join(HERE, '../../../i18n/locales');

/** The screens this PR put through i18n, relative to src/app/components. */
const SCREENS = [
  'SupervisorProjects.tsx',
  'MyHours.tsx',
  'phase2/ApprovalStatusBadge.tsx',
  'ProjectFinancials.tsx',
  'ToolInventory.tsx',
  'ClosedProjectBanner.tsx',
];

type Table = Record<string, string>;

const cache = new Map<string, Table>();
function locale(lang: 'es' | 'en', ns: string): Table {
  const id = `${lang}/${ns}`;
  if (!cache.has(id)) {
    cache.set(id, JSON.parse(readFileSync(join(LOCALES, lang, `${ns}.json`), 'utf8')) as Table);
  }
  return cache.get(id)!;
}

const source = (rel: string) => readFileSync(join(COMPONENTS, rel), 'utf8');

/**
 * Namespaces a file may resolve an unqualified key against.
 *
 * A file can hold several `useTranslation(...)` calls with different
 * namespaces — ToolInventory's pagination reads `common` while the rest of the
 * screen reads `inventory` — so an unqualified key counts as defined when any
 * declared namespace defines it.
 */
function declaredNamespaces(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/useTranslation\(\s*(\[[^\]]*\]|'[^']+')/g)) {
    for (const q of m[1].matchAll(/'([^']+)'/g)) found.add(q[1]);
  }
  for (const m of text.matchAll(/\bns:\s*'([^']+)'/g)) found.add(m[1]);
  return [...found];
}

/** Static keys the file asks for. Template keys (`apr.st.${x}`) are covered separately. */
function requestedKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(/\bt\(\s*'([^']+)'/g)) {
    if (!m[1].includes('${')) keys.add(m[1]);
  }
  return [...keys];
}

/** i18next resolves `foo` from `foo_one`/`foo_other` when a count is passed. */
const defines = (table: Table, key: string) =>
  key in table || `${key}_one` in table || `${key}_other` in table;

describe('the five screens only ask for keys that exist', () => {
  it('finds the sources (guards against this test silently passing)', () => {
    for (const rel of SCREENS) expect(source(rel).length, rel).toBeGreaterThan(200);
  });

  for (const rel of SCREENS) {
    it(`${basename(rel)} resolves every key in both languages`, () => {
      const text = source(rel);
      const declared = declaredNamespaces(text);
      expect(declared.length, `${rel} calls useTranslation with no namespace`).toBeGreaterThan(0);

      for (const raw of requestedKeys(text)) {
        const [ns, key] = raw.includes(':') ? [raw.split(':')[0], raw.split(':').slice(1).join(':')] : [null, raw];
        const candidates = ns ? [ns] : declared;

        for (const lang of ['es', 'en'] as const) {
          const hit = candidates.some(c => defines(locale(lang, c), key));
          expect(hit, `${rel} asks for ${ns ?? candidates.join('|')}:${key}, undefined in ${lang}`).toBe(true);
        }
      }
    });
  }
});

describe('no screen pins a display locale to English', () => {
  for (const rel of SCREENS) {
    it(`${basename(rel)} formats dates in the active language`, () => {
      const text = source(rel);
      // `toLocaleDateString('en-US', …)` renders "Thu, Sep 17" to a reader who
      // set the panel to Spanish. The locale has to come from i18n.language.
      const pinned = [...text.matchAll(/toLocale(?:Date|Time|)String\(\s*'([^']+)'/g)].map(m => m[1]);
      expect(pinned, `${rel} pins a locale: ${pinned.join(', ')}`).toEqual([]);
    });
  }
});

describe('the approval badge reads the labels the rest of the app uses', () => {
  const text = source('phase2/ApprovalStatusBadge.tsx');

  it('carries no English labels of its own', () => {
    // The labels used to live in STYLES, which is why Supervisor › Aprobación
    // de Horas said "Pending" while the inbox two clicks away said "Pendientes".
    for (const label of ['Pending', 'Approved', 'Observed', 'Rejected', 'Auto-rejected', 'In review']) {
      expect(text, `still hardcodes "${label}"`).not.toContain(`'${label}'`);
    }
    expect(text).toContain('apr.st.${status}');
  });

  it('labels every ApprovalStatus in both languages', () => {
    // Read the statuses from the type rather than restating them: a seventh
    // status added to the union has to arrive with words in both languages.
    const types = readFileSync(join(HERE, '../../types/index.ts'), 'utf8');
    const union = /export type ApprovalStatus =([^;]+);/.exec(types);
    expect(union, 'ApprovalStatus union not found').toBeTruthy();
    const statuses = [...union![1].matchAll(/'([A-Z_]+)'/g)].map(m => m[1]);
    expect(statuses.length).toBeGreaterThanOrEqual(6);

    for (const status of statuses) {
      for (const lang of ['es', 'en'] as const) {
        expect(locale(lang, 'admin')[`apr.st.${status}`], `${lang} apr.st.${status}`).toBeTruthy();
      }
    }
  });

  it('keeps AUTO_REJECTED readable as something other than REJECTED', () => {
    // One is a supervisor's decision, the other is the clock running out.
    for (const lang of ['es', 'en'] as const) {
      const admin = locale(lang, 'admin');
      expect(admin['apr.st.AUTO_REJECTED']).not.toBe(admin['apr.st.REJECTED']);
    }
  });

  it('still gives every status its own colours', () => {
    const styles = /const STYLES[^{]+\{([\s\S]*?)\n\};/.exec(text);
    expect(styles, 'STYLES record not found').toBeTruthy();
    for (const status of ['PENDING', 'APPROVED', 'OBSERVED', 'REJECTED', 'AUTO_REJECTED', 'PARTIAL']) {
      expect(styles![1], `STYLES is missing ${status}`).toContain(`${status}:`);
    }
    // Auto-rejection is not a rejection; it should not photograph as one.
    expect(styles![1]).toContain('orange');
  });
});
