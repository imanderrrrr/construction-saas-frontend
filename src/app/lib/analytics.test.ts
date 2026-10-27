// BuildTrack — analytics of the public website.
//
// What must hold: nothing loads without the key, nothing loads inside the
// product, what happens inside the product is dropped even when the library
// is already running, and a click before the library arrives is not lost.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  stopSessionRecording: vi.fn(),
  startSessionRecording: vi.fn(),
}));
vi.mock('posthog-js', () => ({ default: posthog }));

import { initAnalytics, isPublicPath, resetAnalyticsForTests, track } from './analytics';

type InitConfig = {
  api_host: string;
  persistence: string;
  session_recording: { maskAllInputs: boolean; blockSelector: string };
  before_send: (event: { event: string } | null) => { event: string } | null;
};

/** Lets the idle callback and the dynamic import settle. */
async function settle() {
  vi.runAllTimers();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await vi.dynamicImportSettled();
}

function initConfig(): InitConfig {
  return posthog.init.mock.calls[0][1] as InitConfig;
}

describe('analytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAnalyticsForTests();
    Object.values(posthog).forEach((fn) => fn.mockClear());
    window.history.replaceState(null, '', '/');
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  it('knows the public pages from the product', () => {
    for (const path of ['/', '/docs', '/docs/', '/status', '/privacy', '/terms', '/support']) {
      expect(isPublicPath(path), path).toBe(true);
    }
    for (const path of ['/login', '/admin', '/admin/projects', '/c/abc', '/sign/x', '/pay/x', '/platform/leads']) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });

  it('loads nothing and records nothing without a project key', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    initAnalytics();
    track('cta_click', { cta: 'demo' });
    await settle();
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('loads nothing when the visit starts inside the product', async () => {
    window.history.replaceState(null, '', '/admin');
    initAnalytics();
    await settle();
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('starts once on a public page, through our own domain, without cookies, masking what people type', async () => {
    initAnalytics();
    initAnalytics();
    await settle();

    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init.mock.calls[0][0]).toBe('phc_test');
    const config = initConfig();
    expect(config.api_host).toBe('/ingest');
    expect(config.persistence).toBe('localStorage');
    expect(config.session_recording.maskAllInputs).toBe(true);
    expect(config.session_recording.blockSelector).toBe('.ph-no-capture');
  });

  it('sends a click made before the library loaded once it does', async () => {
    initAnalytics();
    track('cta_click', { cta: 'demo', place: 'hero' });
    expect(posthog.capture).not.toHaveBeenCalled();

    await settle();
    expect(posthog.capture).toHaveBeenCalledWith('cta_click', { cta: 'demo', place: 'hero' });

    track('lead_submitted', { interest: 'DEMO' });
    expect(posthog.capture).toHaveBeenLastCalledWith('lead_submitted', { interest: 'DEMO' });
  });

  it('drops what happens inside the product and pauses the recording there', async () => {
    initAnalytics();
    await settle();
    const beforeSend = initConfig().before_send;

    expect(beforeSend({ event: '$autocapture' })).toEqual({ event: '$autocapture' });

    window.history.replaceState(null, '', '/login');
    expect(beforeSend({ event: '$pageview' })).toBeNull();
    expect(beforeSend({ event: '$autocapture' })).toBeNull();
    expect(posthog.stopSessionRecording).toHaveBeenCalledTimes(1);

    window.history.replaceState(null, '', '/');
    expect(beforeSend({ event: '$pageview' })).toEqual({ event: '$pageview' });
    expect(posthog.startSessionRecording).toHaveBeenCalledTimes(1);
  });
});
