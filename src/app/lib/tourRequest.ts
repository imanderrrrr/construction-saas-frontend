import { useSyncExternalStore } from 'react';

/**
 * Tour request — a stop of the section tour, asked for by name.
 *
 * The section tour starts on its own on a first visit and on the topbar "?",
 * always at its first stop. Facturas needs a third way in: the notice it
 * shows after issuing a document offers «Ver cómo» for the customer's
 * signature, and that block lives in Cuentas por Cobrar. So the notice writes
 * the stop here, navigates, and SectionTour — which reads this on every
 * section — opens that section's tour at that stop once its anchor is on
 * screen. Like the "?", an explicit request marks nothing as seen: the
 * first-visit tour of the section still runs on a later visit.
 *
 * One slot, taken by the tour that honours it, so a request never fires
 * twice. Not an event bus: a request names a section and a stop that
 * SECTION_TOUR_STEPS must know, exactly as the registry spells them.
 */
export interface TourRequest {
  /** Registry key: `SECTION_TOUR_STEPS[section]`. */
  section: string;
  /** One of that section's stops. */
  key: string;
}

let current: TourRequest | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
const read = (): TourRequest | null => current;

/** Ask for `section`'s stop `key`. Replaces a request still waiting. */
export function requestTourStop(section: string, key: string): void {
  current = { section, key };
  notify();
}

/** The request waiting, if any — a plain read, for code outside React's render. */
export function peekTourRequest(): TourRequest | null {
  return current;
}

/** The request waiting, if any — live. */
export function useTourRequest(): TourRequest | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Take the request out of the slot; null when nothing was asked for. */
export function consumeTourRequest(): TourRequest | null {
  const taken = current;
  current = null;
  if (taken) notify();
  return taken;
}

/** Tests only. */
export function resetTourRequests(): void {
  current = null;
  notify();
}
