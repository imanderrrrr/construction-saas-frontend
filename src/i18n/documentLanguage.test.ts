// <html lang> has to name the language on screen. It used to stay "en" while
// the site spoke Spanish, so screen readers read Spanish with an English voice
// and search engines filed the pages as English.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import i18n, { i18nReady } from './index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('<html lang>', () => {
  it('starts with the language detected at load', async () => {
    await i18nReady;
    expect(document.documentElement.lang).toBe(i18n.resolvedLanguage);
  });

  it('follows every language change', async () => {
    await i18n.changeLanguage('es');
    expect(document.documentElement.lang).toBe('es');
    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    await i18n.changeLanguage('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('names the language, not the region', async () => {
    await i18n.changeLanguage('es-GT');
    expect(document.documentElement.lang).toBe('es');
  });

  it('ships Spanish, the fallback language, before the app runs', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/<html lang="es">/);
  });
});
