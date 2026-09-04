// The welcome ceremony: starts when the login asks for it, greets by name
// (username when there is no full name), shows the company once branding
// answers, holds the screen at least the sheet's minimum, leaves when the
// dashboard says it painted, never later than the cap — and takes its turn
// in the first-run row (after the brand intro, before the tour).

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.rev ? `${key}:${opts.rev}` : key), i18n: { language: 'es' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { WelcomeOverlay, Splash, WELCOME_MIN_MS, WELCOME_MAX_MS, WELCOME_FADE_MS } from './WelcomeOverlay';
import { endWelcome, resetWelcome, setWelcomeCompany, startWelcome } from '../lib/welcome';
import { FIRST_RUN_ORDER, firstRunHolder, resetFirstRunQueue, useFirstRunTurn } from '../lib/firstRunQueue';
import { DASHBOARD_READY_ATTR } from '../lib/dashboardReady';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** A stand-in for the brand intro: claims the first place in the row while `pending`. */
function FakeIntro({ pending }: { pending: boolean }) {
  const myTurn = useFirstRunTurn('brandIntro', pending);
  return myTurn ? <div data-first-run="brandIntro" /> : null;
}

const overlay = () => document.querySelector<HTMLElement>('[data-testid="welcome-overlay"]');

describe('WelcomeOverlay', () => {
  let container: HTMLDivElement;
  let root: Root;

  const advance = async (ms: number) => {
    await act(async () => { vi.advanceTimersByTime(ms); await Promise.resolve(); });
  };
  const render = async (node: React.ReactNode) => {
    await act(async () => { root.render(node); });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    resetFirstRunQueue();
    resetWelcome();
    document.body.removeAttribute(DASHBOARD_READY_ATTR);
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    resetFirstRunQueue();
    resetWelcome();
    document.body.removeAttribute(DASHBOARD_READY_ATTR);
    vi.useRealTimers();
  });

  it('has a place in the first-run row right after the brand intro', () => {
    expect(FIRST_RUN_ORDER.indexOf('welcome')).toBe(FIRST_RUN_ORDER.indexOf('brandIntro') + 1);
    expect(FIRST_RUN_ORDER.indexOf('welcome')).toBeLessThan(FIRST_RUN_ORDER.indexOf('onboardingTour'));
  });

  it('is not on screen until the login asks for it, then greets by name', async () => {
    await render(<WelcomeOverlay />);
    expect(overlay()).toBeNull();

    await act(async () => startWelcome('Ana Ruiz'));
    expect(overlay()).not.toBeNull();
    expect(overlay()!.textContent).toContain('auth:welcome.kicker');
    expect(overlay()!.textContent).toContain('Ana Ruiz');
    expect(overlay()!.textContent).toContain('auth:welcome.entering');
    expect(overlay()!.getAttribute('data-first-run')).toBe('welcome');
    expect(firstRunHolder()).toBe('welcome');
  });

  it('adds the company to the seal when branding answers', async () => {
    await render(<WelcomeOverlay />);
    await act(async () => startWelcome('Ana Ruiz'));
    expect(overlay()!.textContent).not.toContain('Constructora Andes');
    await act(async () => setWelcomeCompany('Constructora Andes'));
    expect(overlay()!.textContent).toContain('auth:welcome.entering · Constructora Andes');
  });

  it('holds the minimum even when the dashboard is ready at once, then fades and hands the row over', async () => {
    document.body.setAttribute(DASHBOARD_READY_ATTR, '1');
    await render(<WelcomeOverlay />);
    await act(async () => startWelcome('Ana Ruiz'));

    await advance(WELCOME_MIN_MS - 50);
    expect(overlay()!.getAttribute('data-fading')).toBe('false');

    await advance(100);
    expect(overlay()!.getAttribute('data-fading')).toBe('true');

    await advance(WELCOME_FADE_MS + 10);
    expect(overlay()).toBeNull();
    expect(firstRunHolder()).toBeNull();
  });

  it('waits for the dashboard past the minimum, and leaves the moment it is ready', async () => {
    await render(<WelcomeOverlay />);
    await act(async () => startWelcome('Ana Ruiz'));

    await advance(WELCOME_MIN_MS + 1_000);
    expect(overlay()!.getAttribute('data-fading')).toBe('false');

    document.body.setAttribute(DASHBOARD_READY_ATTR, '1');
    await advance(200);
    expect(overlay()!.getAttribute('data-fading')).toBe('true');
  });

  it('never holds the screen past the cap, dashboard or not', async () => {
    await render(<WelcomeOverlay />);
    await act(async () => startWelcome('Ana Ruiz'));

    await advance(WELCOME_MAX_MS + 200);
    expect(overlay()!.getAttribute('data-fading')).toBe('true');
    await advance(WELCOME_FADE_MS + 10);
    expect(overlay()).toBeNull();
  });

  it('waits its turn behind the brand intro and plays in full once it has the screen', async () => {
    await render(<><FakeIntro pending /><WelcomeOverlay /></>);
    await act(async () => startWelcome('Ana Ruiz'));
    // The intro holds the row: no greeting underneath it.
    expect(firstRunHolder()).toBe('brandIntro');
    expect(overlay()).toBeNull();

    await advance(3_000);
    await render(<><FakeIntro pending={false} /><WelcomeOverlay /></>);
    expect(firstRunHolder()).toBe('welcome');
    expect(overlay()).not.toBeNull();

    // The clock started now, not when the login asked: still up after the earlier wait.
    document.body.setAttribute(DASHBOARD_READY_ATTR, '1');
    await advance(WELCOME_MIN_MS - 50);
    expect(overlay()!.getAttribute('data-fading')).toBe('false');
  });

  it('a sign-out mid-ceremony clears it', async () => {
    await render(<WelcomeOverlay />);
    await act(async () => startWelcome('Ana Ruiz'));
    await act(async () => endWelcome());
    expect(overlay()).toBeNull();
    expect(firstRunHolder()).toBeNull();
  });

  it('the splash is the same screen without the greeting', async () => {
    await render(<Splash />);
    const splash = document.querySelector('[data-testid="splash"]')!;
    expect(splash.textContent).toContain('auth:welcome.loading');
    expect(splash.textContent).not.toContain('auth:welcome.kicker');
    expect(splash.getAttribute('data-first-run')).toBeNull();
  });
});
