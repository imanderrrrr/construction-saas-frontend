// Translations, one chunk per language and namespace (AUD-019).
//
// They used to be 56 static imports — both languages, every namespace — in
// the entry chunk, ~0.93 MB that every visitor downloaded before the landing
// could paint. Each file is now its own chunk, fetched when a route asks for
// its namespaces (see ./index.ts). Tests resolve this module to
// ./locales.eager.ts instead (vitest.config.ts), which bundles them all.

type Table = Record<string, string>;

const loaders = import.meta.glob<{ default: Table }>('./locales/*/*.json');

const parse = (path: string) => {
  const [, , lng, file] = path.split('/');
  return { lng, ns: file.replace(/\.json$/, '') };
};

/** Every namespace, as the files name them. */
export const NAMESPACES: string[] = [...new Set(Object.keys(loaders).map(p => parse(p).ns))].sort();

/** null here: the app fetches; only the test build bundles the tables. */
export const bundledResources: Record<string, Record<string, Table>> | null = null;

export function loadLocale(lng: string, ns: string): Promise<Table> {
  const load = loaders[`./locales/${lng}/${ns}.json`];
  if (!load) return Promise.reject(new Error(`No translations for ${lng}/${ns}`));
  return load().then(m => m.default);
}
