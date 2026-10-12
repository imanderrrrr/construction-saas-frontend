// The test build's translations: every table bundled, so a test can render
// and assert text synchronously. Swapped in for ./locales.ts by
// vitest.config.ts; never part of the app.

type Table = Record<string, string>;

const modules = import.meta.glob<{ default: Table }>('./locales/*/*.json', { eager: true });

export const bundledResources: Record<string, Record<string, Table>> = {};
for (const [path, mod] of Object.entries(modules)) {
  const [, , lng, file] = path.split('/');
  (bundledResources[lng] ??= {})[file.replace(/\.json$/, '')] = mod.default;
}

export const NAMESPACES: string[] = Object.keys(bundledResources.es ?? {}).sort();

export function loadLocale(lng: string, ns: string): Promise<Table> {
  const table = bundledResources[lng]?.[ns];
  return table ? Promise.resolve(table) : Promise.reject(new Error(`No translations for ${lng}/${ns}`));
}
