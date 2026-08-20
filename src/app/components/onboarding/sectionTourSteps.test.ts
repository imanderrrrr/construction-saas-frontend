// BuildTrack — the section-tour registry has three parts that must agree:
// the step list, a `data-tour` anchor in the JSX, and copy in both locales.
// Nothing at runtime enforces that: a step with no anchor is silently dropped
// and a step with no copy renders the raw i18n key at the user. These tests
// are the enforcement.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTION_TOUR_STEPS } from './sectionTourSteps';
import { INTRO_SECTIONS } from './SectionIntro';
import en from '../../../i18n/locales/en/admin.json';
import es from '../../../i18n/locales/es/admin.json';

const SRC = path.resolve(__dirname, '../..');

/**
 * Every section anchor declared in the app source.
 *
 * Two spellings count: the literal `data-tour="sec.…"` attribute, and
 * `tourAnchor="sec.…"` — the prop the three labor screens use to pass their
 * own anchor into the LaborFilters bar they share (a hardcoded one there would
 * resolve to whichever screen mounted last).
 *
 * The onboarding directory itself is skipped: it holds the template that
 * BUILDS the anchor (`sec.${section}.${key}`) and the doc comments describing
 * the convention, neither of which is a real anchor.
 */
function anchorsInSource(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'onboarding') walk(p);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/(?:data-tour|tourAnchor)="(sec\.[^"${}]+)"/g)) {
          found.add(m[1]);
        }
      }
    }
  };
  walk(SRC);
  return found;
}

describe('section tour registry', () => {
  const anchors = anchorsInSource();
  const steps = Object.entries(SECTION_TOUR_STEPS).flatMap(([section, keys]) =>
    keys.map(key => ({ section, key, anchor: `sec.${section}.${key}` })),
  );

  it('covers every section that used to show only a banner', () => {
    // The banner list is the bar: each of those sections now gets a real tour.
    expect(Object.keys(SECTION_TOUR_STEPS).length).toBeGreaterThanOrEqual(21);
  });

  it.each(steps)('$anchor has an anchor in the JSX', ({ anchor }) => {
    expect(anchors.has(anchor)).toBe(true);
  });

  it.each(steps)('$anchor has title + body copy in en and es', ({ section, key }) => {
    for (const [lang, dict] of [['en', en], ['es', es]] as const) {
      const d = dict as Record<string, string>;
      for (const field of ['title', 'body'] as const) {
        const k = `sec.${section}.step.${key}.${field}`;
        expect(d[k], `${lang} missing ${k}`).toBeTruthy();
      }
    }
  });

  it('has no orphan anchors — every sec.* anchor is a registered step', () => {
    const registered = new Set(steps.map(s => s.anchor));
    const orphans = [...anchors].filter(a => !registered.has(a));
    expect(orphans).toEqual([]);
  });
});

describe('section intro registry', () => {
  // The banner renders `t('admin:sec.<key>.<part>')` blindly, and it is the
  // fallback voice of every toured section on mobile — a missing key prints
  // the raw key at the user there. Same enforcement as the tour copy above.
  it.each([...INTRO_SECTIONS].map(section => [section]))(
    '%s has title/body/b1/b2 in en and es',
    section => {
      for (const [lang, dict] of [['en', en], ['es', es]] as const) {
        const d = dict as Record<string, string>;
        for (const part of ['title', 'body', 'b1', 'b2'] as const) {
          const k = `sec.${section}.${part}`;
          expect(d[k]?.trim(), `${lang} missing ${k}`).toBeTruthy();
        }
      }
    },
  );

  it('every toured section also has its banner fallback authored', () => {
    // SectionTour degrades to the banner on mobile and when anchors never
    // appear; a toured section missing from INTRO_SECTIONS would degrade to
    // nothing at all.
    const missing = Object.keys(SECTION_TOUR_STEPS).filter(s => !INTRO_SECTIONS.has(s));
    expect(missing).toEqual([]);
  });
});
