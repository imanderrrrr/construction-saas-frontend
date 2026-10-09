// AUD-019 — the app's translation loader (not the bundled tables the rest of
// the test suite uses): one file per language and namespace, fetched on
// request, nothing bundled.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bundledResources, loadLocale, NAMESPACES } from './locales';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('the per-file translation loader', () => {
  it('bundles nothing', () => {
    expect(bundledResources).toBeNull();
  });

  it('knows every namespace from the files', () => {
    expect(NAMESPACES).toContain('common');
    expect(NAMESPACES).toContain('admin');
    expect(NAMESPACES.length).toBe(28);
  });

  it.each([['es', 'landing'], ['en', 'admin']])('loads %s/%s as written on disk', async (lng, ns) => {
    const disk = JSON.parse(readFileSync(join(HERE, 'locales', lng, `${ns}.json`), 'utf8'));
    expect(await loadLocale(lng, ns)).toEqual(disk);
  });

  it('refuses a language or namespace it does not have', async () => {
    await expect(loadLocale('fr', 'landing')).rejects.toThrow('No translations for fr/landing');
    await expect(loadLocale('es', 'nope')).rejects.toThrow('No translations for es/nope');
  });
});
