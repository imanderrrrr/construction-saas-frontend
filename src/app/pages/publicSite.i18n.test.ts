import { describe, it, expect } from 'vitest';

import enLanding from '../../i18n/locales/en/landing.json';
import esLanding from '../../i18n/locales/es/landing.json';
import enDocs from '../../i18n/locales/en/docs.json';
import esDocs from '../../i18n/locales/es/docs.json';
import enStatus from '../../i18n/locales/en/status.json';
import esStatus from '../../i18n/locales/es/status.json';

type Bundle = Record<string, string>;

const NAMESPACES: [name: string, en: Bundle, es: Bundle][] = [
  ['landing', enLanding as Bundle, esLanding as Bundle],
  ['docs', enDocs as Bundle, esDocs as Bundle],
  ['status', enStatus as Bundle, esStatus as Bundle],
];

const tokens = (s: string): string[] =>
  (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((x) => x.replace(/\s/g, '')).sort();

describe.each(NAMESPACES)('%s locale coverage', (_name, en, es) => {
  it('EN and ES define identical key sets', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('no key has an empty value in either language', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(typeof v === 'string' && v.trim().length > 0, `en:${k}`).toBe(true);
    }
    for (const [k, v] of Object.entries(es)) {
      expect(typeof v === 'string' && v.trim().length > 0, `es:${k}`).toBe(true);
    }
  });

  it('interpolation tokens match between EN and ES for every key', () => {
    for (const k of Object.keys(en)) {
      expect(tokens(es[k]), `tokens differ for ${k}`).toEqual(tokens(en[k]));
    }
  });
});

describe('public site content rules', () => {
  // The site quotes project by project: no plan table, no amount, anywhere.
  // Quetzal figures inside the dashboard mock are jobsite data, not a price —
  // this guards the thing that must never come back: what BuildTrack costs.
  it('publishes no currency price anywhere on the public site', () => {
    for (const [name, en, es] of NAMESPACES) {
      for (const bundle of [en, es]) {
        for (const [k, v] of Object.entries(bundle)) {
          expect(/\$\s?\d/.test(v), `${name}:${k} mentions a price: ${v}`).toBe(false);
        }
      }
    }
  });

  it('states the beta is free', () => {
    expect((esLanding as Bundle)['beta.2.value'].toLowerCase()).toContain('gratis');
    expect((enLanding as Bundle)['beta.2.value'].toLowerCase()).toContain('free');
  });

  // The docs may only describe what the product actually does. Company signup
  // takes a company name + admin account — it never asks for a tax id (NIT) or
  // a currency choice, so the guide must not invent those steps.
  it('does not invent company-creation fields in the docs', () => {
    for (const bundle of [enDocs as Bundle, esDocs as Bundle]) {
      const signup = bundle['s0.step.1.rest'].toLowerCase();
      expect(signup).not.toContain('nit');
      expect(signup).not.toMatch(/moneda|currency/);
    }
  });

  it('keeps the contract amount optional when creating a project in the docs', () => {
    expect((esDocs as Bundle)['s0.step.3.rest']).toContain('opcionales');
    expect((enDocs as Bundle)['s0.step.3.rest']).toContain('optional');
  });

  // Anderson's call: the status page shows a live check and an honest empty
  // history. It must never regain the design's invented uptime figures.
  it('claims no uptime percentage on the status page', () => {
    for (const [k, v] of Object.entries({ ...(enStatus as Bundle), ...(esStatus as Bundle) })) {
      expect(/\d{2}\.\d{1,2}\s?%/.test(v), `status:${k} claims uptime: ${v}`).toBe(false);
    }
  });
});
