import { useEffect, useSyncExternalStore } from 'react';

/**
 * Tour scope — which screen the guided tour should describe.
 *
 * The section tour is keyed by the sidebar section (`projects`, `users`…), but
 * a section can put a different screen in front of the user: the project
 * ficha has six tabs with their own stops, and the create/edit window covers
 * everything. When one of those is on screen it claims the tour by pushing a
 * scope here; SectionTour reads the top of the stack instead of the nav key,
 * so both the first-visit tour and the topbar "?" replay describe what the
 * user is actually looking at.
 *
 * A stack, not a single value: the edit window opens on top of a ficha tab
 * and must hand the scope back when it closes.
 *
 * The seen-key, the steps and the copy all derive from `key` exactly like a
 * section's — a scope is a section for every purpose but navigation.
 */
export interface TourScope {
  /** Registry key: `SECTION_TOUR_STEPS[key]`, copy under `sec.<key>.*`. */
  key: string;
  /** Kicker of the banner fallback ("Guía de sección · <label>"). */
  label?: string;
}

const stack: TourScope[] = [];
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
const top = (): TourScope | null => (stack.length ? stack[stack.length - 1] : null);

/** Claim the tour; returns the release. Releasing out of order is fine. */
export function pushTourScope(scope: TourScope): () => void {
  stack.push(scope);
  notify();
  return () => {
    const i = stack.lastIndexOf(scope);
    if (i >= 0) stack.splice(i, 1);
    notify();
  };
}

/** The scope on top of the stack, or null when the nav section owns the tour. */
export function useTourScope(): TourScope | null {
  return useSyncExternalStore(subscribe, top, () => null);
}

/** Claim the tour for as long as the caller is mounted (and re-claim on key change). */
export function useTourScopeWhileMounted(key: string | null, label?: string) {
  useEffect(() => {
    if (!key) return;
    return pushTourScope({ key, label });
  }, [key, label]);
}

/** Tests only. */
export function resetTourScope() {
  stack.length = 0;
  notify();
}
