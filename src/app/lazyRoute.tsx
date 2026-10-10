// Route-level code splitting (AUD-019).
//
// Every page used to be a static import of routes.tsx, so the entry chunk
// carried all five dashboards, the platform console and their PDF exporters
// for a visitor who only opened the landing. A route's page is now a chunk of
// its own, fetched together with its translations when the route renders —
// and only once its guards have let the visitor through.

import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import i18n, { loadRouteNamespaces, type RouteGroup } from '../i18n';

const CHUNK_ERROR_RE = /(ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ERR_CACHE_READ_FAILURE)/i;

/** Retries a chunk import that failed on the network (a flaky connection, a deploy mid-session). */
export async function withChunkRetry<T>(importer: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await importer();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!CHUNK_ERROR_RE.test(message) || i === attempts - 1) break;
      await new Promise(resolve => setTimeout(resolve, 250 * (i + 1)));
    }
  }
  throw lastError;
}

/**
 * A page loaded with its route group's translations. Starting both fetches
 * together keeps them off each other's critical path. `preload()` starts them
 * before the router renders (main.tsx does it for the page on screen); a
 * failed attempt is forgotten so the next one fetches again.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy's own constraint
export function lazyRoute<C extends ComponentType<any>>(group: RouteGroup, importer: () => Promise<C>) {
  let pending: Promise<{ default: C }> | undefined;
  const load = () => {
    pending ??= Promise.all([withChunkRetry(importer), loadRouteNamespaces(group)])
      .then(([Page]) => ({ default: Page }))
      .catch(error => { pending = undefined; throw error; });
    return pending;
  };
  return Object.assign(lazy(load), { preload: load });
}

/**
 * The words of the error screen, in both languages, inline: it is shown
 * exactly when a chunk or a translation table could not be fetched, so it
 * cannot depend on one.
 */
const FAILED = {
  es: { title: 'No se pudo cargar esta página', body: 'Revisa tu conexión y vuelve a intentarlo.', retry: 'Reintentar' },
  en: { title: 'This page could not be loaded', body: 'Check your connection and try again.', retry: 'Try again' },
};

class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const words = (i18n.resolvedLanguage ?? i18n.language ?? 'es').startsWith('en') ? FAILED.en : FAILED.es;
    return (
      <div role="alert" className="min-h-screen bg-[#F5F1E8] flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-[#0A0A0A]">{words.title}</p>
          <p className="text-sm text-[#5A5346] mt-2">{words.body}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] px-4 py-2 text-sm font-semibold transition-colors"
          >
            {words.retry}
          </button>
        </div>
      </div>
    );
  }
}

/** Shown while a page's chunk arrives: the page's paper, no spinner flash. */
function RouteFallback() {
  return <div role="status" aria-busy="true" data-route-loading="" className="min-h-screen bg-[#F5F1E8]" />;
}

/** Wraps a lazy page: its loading state and its load-failure screen. */
export function RoutePage({ children }: { children: ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}
