import { useEffect } from 'react';

/**
 * What the route behind the welcome is doing, read from two body attributes.
 *
 * `data-dashboard-ready` — "the panel painted". Each role's page calls
 * `useMarkDashboardReady()` once; the attribute lives while the page is
 * mounted. The welcome overlay (components/WelcomeOverlay) reads it to know it
 * can fade out and reveal a finished screen instead of a spinner.
 *
 * `data-splash-active` — "something behind is still loading". The splash
 * (the guards' and the bootstrap's loading screen) marks it while mounted.
 * The welcome stays up while it is set, so a slow backend never produces the
 * sequence welcome → splash → dashboard: the greeting simply holds until the
 * panel is there. A page outside the dashboards (forced password change, a
 * guard's error screen) sets neither, and the welcome leaves after its
 * minimum.
 *
 * Both sit on <body> rather than on the pages' roots so every dashboard's
 * markup stays untouched and the overlay polls one place.
 */
export const DASHBOARD_READY_ATTR = 'data-dashboard-ready';
export const SPLASH_ACTIVE_ATTR = 'data-splash-active';

export function useMarkDashboardReady() {
  useEffect(() => {
    document.body.setAttribute(DASHBOARD_READY_ATTR, '1');
    return () => { document.body.removeAttribute(DASHBOARD_READY_ATTR); };
  }, []);
}

export function isDashboardReady(): boolean {
  return document.body.hasAttribute(DASHBOARD_READY_ATTR);
}

// Counted, not boolean: a guard's splash may be replaced by the next guard's
// in the same commit, and the attribute must survive that hand-over.
let splashes = 0;

export function useMarkSplashActive() {
  useEffect(() => {
    splashes += 1;
    document.body.setAttribute(SPLASH_ACTIVE_ATTR, '1');
    return () => {
      splashes = Math.max(0, splashes - 1);
      if (splashes === 0) document.body.removeAttribute(SPLASH_ACTIVE_ATTR);
    };
  }, []);
}

export function isSplashActive(): boolean {
  return document.body.hasAttribute(SPLASH_ACTIVE_ATTR);
}
