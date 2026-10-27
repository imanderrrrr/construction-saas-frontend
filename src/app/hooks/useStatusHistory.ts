import { useEffect, useState } from 'react';

/**
 * The measured history behind the public status page: for each component, one
 * uptime figure per day over the last 90 days, recorded by the backend's own
 * probes (`GET /api/v1/public/status`).
 *
 * Same-origin on purpose: Vercel (and Vite in dev) proxy `/api/*` to the
 * backend, so this also works on previews, where the direct health probe in
 * `useSystemHealth` is refused by CORS.
 *
 * Nothing here is invented. A day the backend has no record for arrives as
 * `null` and is drawn as "no data"; if the endpoint can't be reached at all the
 * page says so and draws every day as "no data".
 */

export const STATUS_HISTORY_URL = '/api/v1/public/status';

export type StatusComponentKey = 'web' | 'api' | 'database' | 'files';
export type StatusCurrent = 'OPERATIONAL' | 'DOWN' | 'UNKNOWN';

export type StatusDay = { date: string; uptimePercent: number | null };

export type StatusComponent = {
  key: StatusComponentKey;
  current: StatusCurrent;
  uptimePercent: number | null;
  history: StatusDay[];
};

export type StatusHistory = {
  generatedAt: string;
  timezone: string;
  /** First day with any record, in the backend's business time zone; null before the first check. */
  trackingSince: string | null;
  days: number;
  components: StatusComponent[];
};

export type StatusHistoryResult =
  | { state: 'loading' }
  | { state: 'ready'; data: StatusHistory }
  | { state: 'unavailable' };

const TIMEOUT_MS = 15_000;

function isHistory(body: unknown): body is StatusHistory {
  const candidate = body as Partial<StatusHistory> | null;
  return (
    !!candidate &&
    Array.isArray(candidate.components) &&
    candidate.components.every(c => typeof c?.key === 'string' && Array.isArray(c.history))
  );
}

/** @param nonce bump it to fetch again (the page's "check again" button). */
export function useStatusHistory(nonce = 0): StatusHistoryResult {
  const [result, setResult] = useState<StatusHistoryResult>({ state: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    let cancelled = false;
    setResult({ state: 'loading' });

    fetch(STATUS_HISTORY_URL, { signal: controller.signal, cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .catch(() => null)
      .then(body => {
        if (cancelled) return;
        setResult(isHistory(body) ? { state: 'ready', data: body } : { state: 'unavailable' });
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [nonce]);

  return result;
}
