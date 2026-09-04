import { useEffect } from 'react';

/**
 * "The panel behind the welcome has painted."
 *
 * Each role's page calls this once. It stamps `data-dashboard-ready` on the
 * body while the page is mounted; the welcome overlay (lib/welcome) reads it
 * to know it can fade out and reveal a finished screen instead of a spinner.
 * Sitting on <body> rather than on the page's root keeps every dashboard's
 * markup untouched and lets the overlay poll one place.
 */
export const DASHBOARD_READY_ATTR = 'data-dashboard-ready';

export function useMarkDashboardReady() {
  useEffect(() => {
    document.body.setAttribute(DASHBOARD_READY_ATTR, '1');
    return () => { document.body.removeAttribute(DASHBOARD_READY_ATTR); };
  }, []);
}

export function isDashboardReady(): boolean {
  return document.body.hasAttribute(DASHBOARD_READY_ATTR);
}
