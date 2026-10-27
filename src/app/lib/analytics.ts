// BuildTrack — analytics of the PUBLIC website (PostHog).
//
// Design notes:
//   - Public pages only: the landing, /docs, /status and the legal pages.
//     Inside the product (sign-in, panel, client portal, signing, payments,
//     platform console) nothing is captured: `before_send` drops the event and
//     the session recording stops until the visitor is back on a public page.
//   - `VITE_POSTHOG_KEY` is the PUBLIC project key. Without it nothing loads
//     and every call here is a no-op, so a build without the key ships no
//     analytics at all. Set it in Vercel only once the privacy policy that
//     names PostHog is live.
//   - The library is imported dynamically once the page is idle: it never
//     counts against the landing's JS budget nor delays the first paint.
//     Clicks that happen before it loads are queued and sent once it does.
//   - Events go to `/ingest` on our own domain (a Vercel rewrite to PostHog
//     US, see vercel.json), so an ad blocker that blocks posthog.com does not
//     hide the visit. `VITE_POSTHOG_HOST` overrides it (e.g. a preview build).
//   - Storage: localStorage only, no cookies. Recordings mask every input, and
//     anything inside `.ph-no-capture` (the assistant panel, where visitors
//     type to us) is neither recorded nor autocaptured.

import type { CaptureResult, PostHog } from 'posthog-js';

/** Paths whose visits we measure. Everything else is the product. */
const PUBLIC_PATHS = new Set(['/', '/docs', '/status', '/privacy', '/terms', '/support']);

export function isPublicPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_PATHS.has(path);
}

function projectKey(): string {
  const raw = import.meta.env.VITE_POSTHOG_KEY;
  return typeof raw === 'string' ? raw.trim() : '';
}

function apiHost(): string {
  const raw = import.meta.env.VITE_POSTHOG_HOST;
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : '/ingest';
}

/** True when the build carries a project key. */
export function isAnalyticsConfigured(): boolean {
  return projectKey() !== '';
}

type Pending = { event: string; properties?: Record<string, unknown> };

let client: PostHog | null = null;
let loading: Promise<void> | null = null;
let pending: Pending[] = [];
let recordingPaused = false;

/** Drops what happens outside the public site, and pauses the recording there. */
function keepPublicOnly(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  const onPublicPage = isPublicPath(window.location.pathname);
  if (event.event === '$pageview' && client) {
    if (!onPublicPage && !recordingPaused) {
      recordingPaused = true;
      client.stopSessionRecording();
    } else if (onPublicPage && recordingPaused) {
      recordingPaused = false;
      client.startSessionRecording();
    }
  }
  return onPublicPage ? event : null;
}

function load(): Promise<void> {
  const key = projectKey();
  return import('posthog-js').then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: apiHost(),
      ui_host: 'https://us.posthog.com',
      defaults: '2026-08-30',
      person_profiles: 'identified_only',
      persistence: 'localStorage',
      capture_pageview: 'history_change',
      capture_pageleave: true,
      autocapture: true,
      respect_dnt: true,
      session_recording: {
        maskAllInputs: true,
        blockSelector: '.ph-no-capture',
      },
      before_send: keepPublicOnly,
    });
    client = posthog;
    const queued = pending;
    pending = [];
    for (const { event, properties } of queued) posthog.capture(event, properties);
  });
}

function whenIdle(run: () => void): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    window.setTimeout(run, 1500);
  }
}

/**
 * Starts measuring this visit, once, when the browser is idle. Public pages
 * call it on mount; without a project key, or off the public site, it does
 * nothing.
 */
export function initAnalytics(): void {
  if (loading || !isAnalyticsConfigured() || !isPublicPath(window.location.pathname)) return;
  loading = new Promise<void>(resolve => whenIdle(resolve))
    .then(load)
    .catch(() => {
      // Blocked or offline: forget the attempt so a later page can retry, and
      // drop the queue rather than let it grow for a library that never came.
      loading = null;
      pending = [];
    });
}

/** Records a named moment (a CTA click, a lead sent). Queued until the library loads. */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!isAnalyticsConfigured()) return;
  if (client) {
    client.capture(event, properties);
    return;
  }
  pending.push({ event, properties });
}

/** Test seam: forget the loaded client and any queue. */
export function resetAnalyticsForTests(): void {
  client = null;
  loading = null;
  pending = [];
  recordingPaused = false;
}
