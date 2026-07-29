import { useCallback, useEffect, useState } from 'react';

/**
 * Live health probe behind the public status page.
 *
 * Hits the backend's Spring actuator health endpoint, which answers with a
 * single aggregated verdict — `{"status":"UP"}` — covering the API *and* its
 * database. It deliberately exposes no component detail, so this hook reports
 * one signal and the page is careful not to claim more than that.
 *
 * `unknown` is a first-class outcome, not an error. The backend only allows the
 * production origin, so from localhost or a preview deployment the request is
 * rejected before it runs. That says nothing about the service, so it must
 * never render as an outage.
 */

// Public already — this is the same origin vercel.json proxies /api/* to.
const HEALTH_URL = 'https://construction-saas-backend-b00g.onrender.com/actuator/health';

// The backend sleeps when idle and a cold start is slow; give it room before
// giving up, rather than reporting a scary state for a service that's just yawning.
const TIMEOUT_MS = 15_000;

export type Health = 'checking' | 'up' | 'down' | 'unknown';

async function probe(signal: AbortSignal): Promise<Health> {
  try {
    const res = await fetch(HEALTH_URL, { signal, cache: 'no-store' });
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    if (body?.status === 'UP') return 'up';
    // Actuator answers DOWN / OUT_OF_SERVICE with a 503 and a body.
    if (body?.status) return 'down';
    return res.ok ? 'unknown' : 'down';
  } catch {
    // Blocked origin, offline, DNS, timeout — we simply don't know.
    return 'unknown';
  }
}

export function useSystemHealth(): { health: Health; checkedAt: Date | null; recheck: () => void } {
  const [health, setHealth] = useState<Health>('checking');
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [nonce, setNonce] = useState(0);

  const recheck = useCallback(() => {
    setHealth('checking');
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    let cancelled = false;

    probe(controller.signal).then((result) => {
      if (cancelled) return;
      setHealth(result);
      setCheckedAt(new Date());
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [nonce]);

  return { health, checkedAt, recheck };
}
