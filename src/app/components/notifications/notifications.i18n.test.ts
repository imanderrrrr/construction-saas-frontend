// BuildTrack — the notifications catalogue.
//
// Ported from the mobile app's app_en.arb / app_es.arb: the 99 `notif*` keys
// the backend may name in `notifications.i18n`, plus the web inbox's own
// chrome. Beyond the usual EN/ES parity, this pins the two things a port can
// get wrong silently — a key the resolver composes but the catalogue lacks
// (renders the raw key) and a param the sentence names but the resolver never
// fills (renders "{{project}}" or an empty hole).

import { describe, expect, it } from 'vitest';
import en from '../../../i18n/locales/en/notifications.json';
import es from '../../../i18n/locales/es/notifications.json';
import i18n from '../../../i18n';
import { notificationText, type Translate } from '../../lib/notificationText';

const enMap = en as Record<string, string>;
const esMap = es as Record<string, string>;

const tokens = (s: string): string[] => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map(x => x.replace(/\s/g, '')).sort();

describe('notifications locale coverage', () => {
  it('EN and ES define identical key sets', () => {
    expect(Object.keys(esMap).sort()).toEqual(Object.keys(enMap).sort());
  });

  it('carries the 99 notif* keys of the mobile catalogue and the inbox chrome', () => {
    expect(Object.keys(enMap).filter(k => k.startsWith('notif'))).toHaveLength(99);
    expect(Object.keys(enMap).filter(k => k.startsWith('inbox.')).length).toBeGreaterThan(0);
  });

  it('no key has an empty value in either language', () => {
    for (const [k, v] of Object.entries(enMap)) expect(typeof v === 'string' && v.trim().length > 0, `en:${k}`).toBe(true);
    for (const [k, v] of Object.entries(esMap)) expect(typeof v === 'string' && v.trim().length > 0, `es:${k}`).toBe(true);
  });

  it('interpolation tokens match between EN and ES for every key', () => {
    for (const k of Object.keys(enMap)) expect(tokens(esMap[k]), `tokens differ for ${k}`).toEqual(tokens(enMap[k]));
  });

  it('uses i18next braces only — no ARB {param} left behind', () => {
    for (const table of [enMap, esMap]) {
      for (const [k, v] of Object.entries(table)) {
        expect(v, k).not.toMatch(/(?<!\{)\{(?!\{)\w+\}(?!\})/);
      }
    }
  });
});

describe('every body key the server may send composes with no hole left', () => {
  const tEs = i18n.getFixedT('es') as unknown as Translate;
  const tEn = i18n.getFixedT('en') as unknown as Translate;

  // One value for every param name the backend emits, so a sentence that
  // names a param the resolver forgot shows up as a literal "{{…}}".
  const FULL_PARAMS = {
    reviewer: 'Ana', event: 'CHECK_IN', date: '2026-09-19', project: 'Torre Norte', comment: 'Bien',
    actor: 'admin1', marks: [{ type: 'CHECK_IN', time: '07:00' }],
    worker: 'Luis', from: 'Bodega', to: 'Torre Norte', reason: 'Tráfico', minutes: 15, awardedMinutes: 135,
    user: 'luis', role: 'WORKER',
    itemNumber: 12, itemTitle: 'Fuga', location: 'Baño 2',
    job: 'Fundición', status: 'IN_REVIEW', amountCents: 125050, reference: 'TRX-9',
    tool: 'Taladro', code: 'T-01', deliveredBy: 'bodega1', receivedBy: 'luis',
    rfiNumber: 7, subject: 'Anclaje', dueDate: '2026-10-01',
  };

  // The one body key that is a variant, not a server key: the resolver reaches
  // it from notifTransitCancelledBody when `from` is absent (as on mobile).
  const VARIANTS = new Set(['notifTransitCancelledUnknownOriginBody']);

  const bodyKeys = Object.keys(enMap).filter(k => k.startsWith('notif') && k.endsWith('Body') && !VARIANTS.has(k));
  const titleFor = (bodyKey: string) => {
    // Every family has one title; the body names the family up to its variant suffix.
    const stem = bodyKey.replace(/Body$/, '');
    const candidates = [
      `${stem}Title`,
      `${stem.replace(/(NoCheckOut|TransitOnly|OnlyCheckIn|Created|Completed|Due)$/, '')}Title`,
    ];
    const hit = candidates.find(c => c in enMap);
    if (!hit) throw new Error(`no title for ${bodyKey}`);
    return hit;
  };

  it('covers every catalogue body key', () => {
    expect(bodyKeys.length).toBeGreaterThanOrEqual(40);
  });

  for (const bodyKey of bodyKeys) {
    it(bodyKey, () => {
      const n = { type: 'X', title: 'SERVER TITLE', message: 'SERVER MESSAGE', i18n: { titleKey: titleFor(bodyKey), bodyKey, params: FULL_PARAMS } };
      for (const [lang, t] of [['es', tEs], ['en', tEn]] as const) {
        const text = notificationText(n, t, lang);
        expect(text.body, `${lang}: fell back to the server`).not.toBe('SERVER MESSAGE');
        expect(text.body, `${lang}: unfilled param`).not.toMatch(/\{\{|\}\}/);
        expect(text.body, `${lang}: raw key`).not.toContain('notif');
        expect(text.body, `${lang}: empty hole`).not.toMatch(/“”|\(\)| {2}/);
      }
    });
  }

  it('the unknown-origin variant is reachable', () => {
    const n = { type: 'X', title: '', message: '', i18n: { titleKey: 'notifTransitCancelledTitle', bodyKey: 'notifTransitCancelledBody', params: { worker: 'Luis', to: 'T', reason: 'R' } } };
    expect(notificationText(n, tEs, 'es').body).toBe(esMap.notifTransitCancelledUnknownOriginBody.replace('{{worker}}', 'Luis').replace('{{to}}', 'T').replace('{{reason}}', 'R'));
  });
});
