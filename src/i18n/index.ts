import i18n, { type BackendModule } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { bundledResources, loadLocale, NAMESPACES } from '@buildtrack/i18n-locales';
import ROUTE_NAMESPACES from './route-namespaces.json';

/**
 * Translations load per language and namespace (AUD-019): only the visitor's
 * language, and only the namespaces the route on screen can use. They used
 * to ship in the entry chunk — both languages, all 28 namespaces — so the
 * landing paid for the admin panel's 430 KB of strings before painting.
 *
 * - The shell's namespaces (what main.tsx renders statically) load before
 *   the first render: `i18nReady`.
 * - Each lazy route loads its group's namespaces together with its chunk
 *   (`loadRouteNamespaces`, see app/lazyRoute.tsx); the lists live in
 *   ./route-namespaces.json and a test checks they cover every namespace the
 *   route's code names. The authenticated workspaces load all of them ('*').
 * - Changing language fetches every namespace already in use for the new one
 *   before switching, so nothing renders half-translated.
 * - Safety net: a key asked for in a namespace nobody loaded triggers its
 *   load, and components re-render when it arrives.
 */

export type RouteGroup = keyof typeof ROUTE_NAMESPACES;

export const LANGUAGES = ['es', 'en'] as const;

export function routeNamespaces(group: RouteGroup): string[] {
  const declared = ROUTE_NAMESPACES[group] as string[] | string;
  return typeof declared === 'string' ? NAMESPACES : declared;
}

const backend: BackendModule = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    loadLocale(language, namespace).then(
      table => callback(null, table),
      error => callback(error, null),
    );
  },
};

if (!bundledResources) i18n.use(backend);

export const i18nReady = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    ...(bundledResources ? { resources: bundledResources } : {}),
    // Detect the language and request the shell's tables right now, not on
    // the next tick: a route preloading its namespaces in the same tick then
    // asks for the right language, in parallel with these.
    initAsync: false,
    supportedLngs: [...LANGUAGES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    // Spanish for any language we do not have. English is complete — a test
    // keeps both languages key for key — so it needs no Spanish behind it,
    // and an English visitor no longer downloads both.
    fallbackLng: { en: [], default: ['es'] },
    defaultNS: 'common',
    ns: bundledResources ? NAMESPACES : routeNamespaces('shell'),
    keySeparator: false,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ofjr_language',
      caches: ['localStorage'],
    },
    react: {
      // Re-render when a namespace arrives, not only on a language change.
      bindI18n: 'languageChanged loaded',
    },
    saveMissing: !bundledResources,
    missingKeyHandler: (_languages, namespace) => {
      if (namespace && !i18n.hasLoadedNamespace(namespace)) void i18n.loadNamespaces(namespace);
    },
  });

/** The language the tables are loaded for ('en-US' resolves to 'en'). */
function activeLanguage(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? 'es';
}

/**
 * Load a route group's namespaces for the active language. Rejects when a
 * table could not be fetched even after one retry, so the route's error
 * boundary offers a reload instead of a screen of raw keys.
 */
export async function loadRouteNamespaces(group: RouteGroup): Promise<void> {
  const namespaces = routeNamespaces(group);
  await i18n.loadNamespaces(namespaces);
  await i18nReady;
  const missing = () => namespaces.filter(ns => !i18n.hasResourceBundle(activeLanguage(), ns));
  if (missing().length) await i18n.reloadResources([activeLanguage()], missing());
  const still = missing();
  if (still.length) throw new Error(`Failed to load translations: ${still.join(', ')}`);
}

export default i18n;
