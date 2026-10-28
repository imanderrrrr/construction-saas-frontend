import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import enLanding from '../../i18n/locales/en/landing.json';
import esLanding from '../../i18n/locales/es/landing.json';
import enDocs from '../../i18n/locales/en/docs.json';
import esDocs from '../../i18n/locales/es/docs.json';
import enStatus from '../../i18n/locales/en/status.json';
import esStatus from '../../i18n/locales/es/status.json';
import enBilling from '../../i18n/locales/en/billing.json';
import esBilling from '../../i18n/locales/es/billing.json';
import enPay from '../../i18n/locales/en/pay.json';
import esPay from '../../i18n/locales/es/pay.json';

type Bundle = Record<string, string>;

const NAMESPACES: [name: string, en: Bundle, es: Bundle][] = [
  ['landing', enLanding as Bundle, esLanding as Bundle],
  ['docs', enDocs as Bundle, esDocs as Bundle],
  ['status', enStatus as Bundle, esStatus as Bundle],
  // `billing` is not public, but /admin/billing is where a locked tenant is
  // sent — the one logged-in surface that used to quote a plan price and
  // take money. It lives under the same rule as the public site.
  ['billing', enBilling as Bundle, esBilling as Bundle],
  // `/pay` is the most public page of all: the customer's payment link.
  ['pay', enPay as Bundle, esPay as Bundle],
];

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../../../public');

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

const COUNTRY = /guatemal|zona \d|zone \d|\bC\.A\.|\bUGC\b|quetzal|14\.6349/i;

// Claims the 2026-10-27 audit found in the old guide — and on the landing —
// with nothing behind them in the panel, the API or the field app. Each one
// was a promise a demo would have broken.
const NOT_IN_THE_PRODUCT: [RegExp, string][] = [
  [/avance f[ií]sico|physical progress/i, 'there is no physical-progress field; "avance" is spend vs. budget'],
  [/estimaci[oó]n|progress billing/i, 'receivables are invoices and change orders, not progress billings'],
  [/solo vale adentro|only count inside/i, 'a clock-in outside the geofence is recorded and flagged, never refused'],
  [/se arma sola|builds itself/i, 'payroll pays approved hours × rate after someone confirms it'],
  [/notificaci[oó]n(es)? push|push notification/i, 'notifications are an in-app inbox; there is no push'],
  [/solo lectura|read-only/i, 'the client answers RFIs and reports punch items from the portal'],
];

describe('public site content rules', () => {
  // We quote project by project: no plan table, no amount, anywhere.
  // This guards the thing that must never come back: what BuildTrack costs.
  // dash.k2sub is a fictional jobsite's contract inside the dashboard mock, not
  // a price; it only escaped this regex before because the mock still read "Q".
  const MOCK_AMOUNT_KEYS = new Set(['landing:dash.k2sub']);

  it('publishes no currency price anywhere on the public site', () => {
    for (const [name, en, es] of NAMESPACES) {
      for (const bundle of [en, es]) {
        for (const [k, v] of Object.entries(bundle)) {
          if (MOCK_AMOUNT_KEYS.has(`${name}:${k}`)) continue;
          expect(/\$\s?\d/.test(v), `${name}:${k} mentions a price: ${v}`).toBe(false);
        }
      }
    }
  });

  // BuildTrack works in dollars and is not sold to one country. The landing
  // used to read as Guatemalan through and through — coordinates of the
  // capital, "Zona 16", a local cement brand, "Hecho en Guatemala" — and a
  // buyer anywhere else read that as "not for me".
  it('does not pitch the site to one country', () => {
    for (const [name, en, es] of NAMESPACES) {
      for (const bundle of [en, es]) {
        for (const [k, v] of Object.entries(bundle)) {
          expect(COUNTRY.test(v), `${name}:${k} pitches a country: ${v}`).toBe(false);
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

  // The project form has required the contract amount since 2026-09
  // (ProjectWindow: projectForm.contractAmountRequired); the client, the map
  // and the cost budget are what stays optional. The guide said the opposite
  // for six weeks.
  it('describes project creation the way the form works', () => {
    expect((esDocs as Bundle)['s0.step.3.rest']).toMatch(/nombre y el monto del contrato/);
    expect((esDocs as Bundle)['s0.step.3.rest']).toContain('opcionales');
    expect((enDocs as Bundle)['s0.step.3.rest']).toMatch(/name and the contract amount/);
    expect((enDocs as Bundle)['s0.step.3.rest']).toContain('optional');
  });

  it('does not promise what the product does not do', () => {
    const bundles: [string, Bundle][] = [
      ['docs', enDocs as Bundle],
      ['docs', esDocs as Bundle],
      ['landing', enLanding as Bundle],
      ['landing', esLanding as Bundle],
    ];
    for (const [name, bundle] of bundles) {
      for (const [k, v] of Object.entries(bundle)) {
        for (const [pattern, why] of NOT_IN_THE_PRODUCT) {
          expect(pattern.test(v), `${name}:${k} — ${why}: ${v}`).toBe(false);
        }
      }
    }
  });

  // The welcome film (BT-V00) starts muted with its captions on screen: they
  // are words on the landing like any other, in both languages.
  it('holds the welcome film captions to the same rules', () => {
    for (const lang of ['es', 'en']) {
      const vtt = readFileSync(join(publicDir, 'demos', lang, 'bienvenida.vtt'), 'utf8');
      expect(vtt.startsWith('WEBVTT'), `${lang}: not a WebVTT file`).toBe(true);
      expect(COUNTRY.test(vtt), `${lang} captions pitch a country`).toBe(false);
      expect(/\$\s?\d/.test(vtt), `${lang} captions mention a price`).toBe(false);
      for (const [pattern, why] of NOT_IN_THE_PRODUCT) {
        expect(pattern.test(vtt), `${lang} captions — ${why}`).toBe(false);
      }
    }
  });

  it('keeps an RFI apart from change orders in the docs', () => {
    // Only time & materials tickets convert into change orders.
    for (const bundle of [enDocs as Bundle, esDocs as Bundle]) {
      const rfi = Object.entries(bundle).filter(([k]) => k.startsWith('s12.')).map(([, v]) => v).join(' ');
      expect(rfi).not.toMatch(/orden de cambio|change order/i);
    }
  });

  // Anderson's call: the status page never shows invented uptime figures. Its
  // percentages and day bars come only from the backend's measurements
  // (GET /api/v1/public/status); no copy string may carry one of its own.
  it('claims no uptime percentage on the status page', () => {
    for (const [k, v] of Object.entries({ ...(enStatus as Bundle), ...(esStatus as Bundle) })) {
      expect(/\d{2}\.\d{1,2}\s?%/.test(v), `status:${k} claims uptime: ${v}`).toBe(false);
    }
  });
});
