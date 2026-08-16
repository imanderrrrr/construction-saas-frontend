// Guards the app-identity screen against the raw-key bug — a `t('...')` call
// whose key exists in neither locale renders the key itself as UI text (the
// expenses screen still shows a literal `LABELS.TYPE` column header this way).
//
// Rather than listing the keys by hand, this reads them out of the component
// source, so a key added to the JSX without a translation fails here instead
// of shipping.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import en from '../../i18n/locales/en/admin.json';
import es from '../../i18n/locales/es/admin.json';

const enMap = en as Record<string, string>;
const esMap = es as Record<string, string>;

// Vitest runs from the project root; `import.meta.url` is not a file URL under
// the jsdom transform, so resolve from cwd instead.
const componentSource = readFileSync(
  resolve(process.cwd(), 'src/app/components/AppBrandingSettings.tsx'),
  'utf8',
);

/** Every `t('key')` literal in the component. */
const usedKeys = [...componentSource.matchAll(/\bt\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);

describe('app identity screen i18n', () => {
  it('finds the t() calls it is supposed to be checking', () => {
    // Fails loudly if the component is refactored past this regex, rather
    // than silently passing with an empty key list.
    expect(usedKeys.length).toBeGreaterThan(10);
  });

  it('every key the screen renders exists in EN and ES', () => {
    for (const key of usedKeys) {
      expect(enMap[key], `missing en:${key}`).toBeTruthy();
      expect(esMap[key], `missing es:${key}`).toBeTruthy();
    }
  });

  it('the nav entry and section header are translated in both languages', () => {
    for (const key of ['nav.appBranding', 'section.appBranding.title', 'section.appBranding.subtitle']) {
      expect(enMap[key], `missing en:${key}`).toBeTruthy();
      expect(esMap[key], `missing es:${key}`).toBeTruthy();
    }
  });

  it('the admin namespace stays in EN/ES parity', () => {
    expect(Object.keys(esMap).sort()).toEqual(Object.keys(enMap).sort());
  });

  it('no appBranding key is blank in either language', () => {
    const ours = Object.keys(enMap).filter((k) => k.startsWith('appBranding.'));
    expect(ours.length).toBeGreaterThan(0);
    for (const k of ours) {
      expect(enMap[k]?.trim(), `blank en:${k}`).toBeTruthy();
      expect(esMap[k]?.trim(), `blank es:${k}`).toBeTruthy();
    }
  });

  it('describes both link states, so the hint never contradicts the checkbox', () => {
    expect(enMap['appBranding.linkHintOn']).not.toEqual(enMap['appBranding.linkHintOff']);
    expect(esMap['appBranding.linkHintOn']).not.toEqual(esMap['appBranding.linkHintOff']);
  });
});
