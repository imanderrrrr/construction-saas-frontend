import { useSyncExternalStore } from 'react';

/**
 * The welcome ceremony's state — who just signed in, and for which company.
 *
 * Set by the login page the moment credentials are accepted, read by the
 * WelcomeOverlay mounted in App.tsx above the router. A module-level store
 * (like lib/firstRunQueue) because the two live in different trees and the
 * overlay must survive the route change from /login to the dashboard: that
 * change is exactly what it is there to cover.
 */
export interface WelcomeState {
  /** Display name — full name when the backend has one, else the username. */
  name: string;
  /** The tenant's organisation name; arrives a beat later from /branding. */
  company: string | null;
  /** performance.now() when the ceremony was requested. */
  startedAt: number;
}

let state: WelcomeState | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

/** Start the ceremony for the person who just signed in. */
export function startWelcome(name: string) {
  state = { name, company: null, startedAt: performance.now() };
  notify();
}

/** The company name landed (branding is fetched after the credentials pass). */
export function setWelcomeCompany(company: string | null) {
  if (!state) return;
  state = { ...state, company };
  notify();
}

/** The overlay finished (or the user signed out mid-way). */
export function endWelcome() {
  if (!state) return;
  state = null;
  notify();
}

export function useWelcome(): WelcomeState | null {
  return useSyncExternalStore(subscribe, () => state, () => null);
}

/** Tests only. */
export function resetWelcome() {
  state = null;
  notify();
}
