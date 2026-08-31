// BuildTrack — the first-run row, end to end, with the REAL three notices.
//
// The bug this pins: an admin's first desktop visit opened the what's-new
// carousel and the guided tour ON TOP OF EACH OTHER (and the brand intro over
// both). The order Anderson asked for is intro → tour → what's new: teach the
// system first, announce what changed in it second.
//
// The load-bearing assertion is `visibleNotices()`: at every step of the
// sequence, AT MOST ONE notice may be on screen and it must be one the row
// handed a turn to. Anything blocking that is not queued shows up in that list
// as UNQUEUED and fails — which is what happens to a fourth notice mounted
// here without a place in FIRST_RUN_ORDER.
//
// react-i18next is mocked with t: key => key, so buttons are found by their
// i18n key, never by literal copy.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  isAuthenticated: vi.fn(() => true),
  getRole: vi.fn(() => 'ADMIN'),
  getUsername: vi.fn(() => 'ana' as string | null),
}));

vi.mock('./services/auth', () => ({
  AuthService: {
    isAuthenticated: () => auth.isAuthenticated(),
    getRole: () => auth.getRole(),
    getUsername: () => auth.getUsername(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { IntroOverlay } from './components/IntroOverlay';
import { INTRO_ANIMATION_DURATION_MS } from './components/IntroAnimation';
import { OnboardingTour } from './components/onboarding/OnboardingTour';
import { WhatsNewModal } from './components/WhatsNewModal';
import { WHATS_NEW_VERSION } from './components/WhatsNewModal';
import { FIRST_RUN_ORDER, resetFirstRunQueue } from './lib/firstRunQueue';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** The brand intro runs its animation, then holds, then fades out. */
const INTRO_TOTAL_MS = INTRO_ANIMATION_DURATION_MS + 1_200 + 800;
/** The tour waits for the dashboard to paint before the welcome lands. */
const WELCOME_DELAY_MS = 600;

/**
 * Production mounting, reproduced: the brand intro sits at the App level
 * (outside the router), the tour lives deep inside the admin dashboard, and
 * the what's-new modal is a sibling of the page inside BillingGuard. Three
 * different subtrees — which is the whole reason the row is a module-level
 * store and not a context somebody has to remember to wrap things in.
 */
function FirstRunStack() {
  return (
    <>
      <IntroOverlay />
      <div data-testid="router">
        <div data-testid="billing-guard">
          <div data-testid="admin-dashboard">
            <OnboardingTour username="ana" replayNonce={0} />
          </div>
          <WhatsNewModal />
        </div>
      </div>
    </>
  );
}

/**
 * Anything that blocks the screen. Deliberately GENERIC (role=dialog, the
 * intro's own root, and the row's marker) rather than a list of the three
 * components we know about: a notice that ships later and skips the row still
 * matches, and still fails the assertions below.
 */
const BLOCKING_OVERLAY = '[role="dialog"], .intro-overlay-root, [data-first-run]';

/** Which notices are on screen — by the id the row gave them. A blocking
 *  overlay with no id never went through the row: it is reported, not ignored. */
function visibleNotices(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(BLOCKING_OVERLAY)).map(
    el => el.getAttribute('data-first-run')
      ?? `UNQUEUED:<${el.tagName.toLowerCase()} class="${el.className}">`,
  );
}

/** jsdom gives every element offsetParent === null; the tour reads it to test
 *  visibility, so opt the anchors we plant into "visible". */
function plantAnchor(key: string) {
  const el = document.createElement('div');
  el.setAttribute('data-tour', key);
  Object.defineProperty(el, 'offsetParent', { get: () => document.body });
  el.scrollIntoView = vi.fn();
  el.getBoundingClientRect = () =>
    ({ top: 100, left: 100, width: 200, height: 50, right: 300, bottom: 150, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
}

function setViewport(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('first-run row — intro, then tour, then what\'s new', () => {
  let container: HTMLDivElement;
  let root: Root;

  /** t() returns keys, so every control is found by its i18n key. */
  const button = (key: string) =>
    Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(key));
  const click = async (key: string) => {
    const el = button(key);
    expect(el, `no button for "${key}" — on screen: ${visibleNotices().join(', ')}`).toBeTruthy();
    await act(async () => { el!.click(); });
  };
  const advance = async (ms: number) => {
    await act(async () => { vi.advanceTimersByTime(ms); await Promise.resolve(); });
  };
  const render = async () => {
    await act(async () => { root.render(<FirstRunStack />); });
  };
  /** The X in the carousel header — its only label is an i18n key. */
  const closeWhatsNew = async () => {
    const el = document.querySelector<HTMLButtonElement>('button[aria-label="buttons.close"]');
    expect(el).toBeTruthy();
    await act(async () => { el!.click(); });
  };
  /** Play the intro out, THEN let the tour's paint delay run: the delay only
   *  starts once the intro hands the row over, so these cannot be one step. */
  const reachTheTour = async () => {
    await advance(INTRO_TOTAL_MS);
    await advance(WELCOME_DELAY_MS);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    resetFirstRunQueue();
    localStorage.clear();
    auth.isAuthenticated.mockReturnValue(true);
    auth.getRole.mockReturnValue('ADMIN');
    auth.getUsername.mockReturnValue('ana');
    setViewport(true);
    // IntroAnimation scales itself to its box; jsdom has no ResizeObserver.
    globalThis.ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    } as unknown as typeof ResizeObserver;
    ['money', 'today'].forEach(plantAnchor);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    document.querySelectorAll('[data-tour]').forEach(el => el.remove());
    resetFirstRunQueue();
    vi.useRealTimers();
  });

  it('never has two notices open at the same time, all the way through', async () => {
    await render();
    // 1 — the brand intro has the screen; nothing opens underneath it.
    expect(visibleNotices()).toEqual(['brandIntro']);

    await advance(INTRO_TOTAL_MS);
    // The intro is done and the tour has only just started its paint delay.
    expect(visibleNotices()).toEqual([]);

    await advance(WELCOME_DELAY_MS);
    // 2 — the tour, alone.
    expect(visibleNotices()).toEqual(['onboardingTour']);

    await click('admin:tour.welcome.start');
    expect(visibleNotices()).toEqual(['onboardingTour']); // spotlight, step 1/2

    await click('admin:tour.next');
    expect(visibleNotices()).toEqual(['onboardingTour']); // step 2/2

    await click('admin:tour.done');
    // 3 — and only now the news.
    expect(visibleNotices()).toEqual(['whatsNew']);

    await closeWhatsNew();
    expect(visibleNotices()).toEqual([]);
  });

  it('opens the what\'s-new modal once the tour is FINISHED', async () => {
    await render();
    await reachTheTour();
    expect(visibleNotices()).toEqual(['onboardingTour']);

    await click('admin:tour.welcome.start');
    await click('admin:tour.next');
    await click('admin:tour.done');

    // Same session, same mounted tree — the news was queued, not dropped.
    expect(visibleNotices()).toEqual(['whatsNew']);
  });

  it('opens the what\'s-new modal once the tour is SKIPPED from the welcome', async () => {
    await render();
    await reachTheTour();
    expect(visibleNotices()).toEqual(['onboardingTour']);

    await click('admin:tour.welcome.skip');

    expect(visibleNotices()).toEqual(['whatsNew']);
  });

  it('opens the what\'s-new modal once the tour is SKIPPED mid-spotlight', async () => {
    await render();
    await reachTheTour();
    await click('admin:tour.welcome.start');
    expect(visibleNotices()).toEqual(['onboardingTour']);

    await click('admin:tour.skip'); // "Saltar recorrido", on step 1 of 2

    expect(visibleNotices()).toEqual(['whatsNew']);
  });

  it('holds the tour and the news back while the brand intro is playing', async () => {
    await render();

    // Past the tour's paint delay and well into the intro: still only the intro.
    await advance(WELCOME_DELAY_MS * 3);
    expect(visibleNotices()).toEqual(['brandIntro']);

    await advance(INTRO_TOTAL_MS);
    expect(visibleNotices()).not.toContain('brandIntro');
  });

  it('lets the news through immediately on mobile, where the tour never runs', async () => {
    // The tour is suppressed below 768px, so it must not hold a turn it will
    // never use — otherwise mobile users would never see the news at all.
    setViewport(false);
    await render();

    expect(visibleNotices()).toEqual(['whatsNew']);
  });

  it('leaves the row empty for a user who has already seen everything', async () => {
    localStorage.setItem('buildtrack:intro-v2-seen', '1');
    localStorage.setItem('bt.onboarding.v2.ana', '2026-01-01T00:00:00.000Z');
    localStorage.setItem('bt.whatsnew.ana', WHATS_NEW_VERSION);

    await render();
    await reachTheTour();

    expect(visibleNotices()).toEqual([]);
  });

  it('every notice in the app has declared its place in the row', () => {
    // A fourth notice cannot show itself without asking the row for a turn
    // (that is the only API), and it cannot ask without a declared place
    // (useFirstRunTurn throws). This catches the third way to get it wrong:
    // asking with an id nobody put in the order.
    const srcRoot = resolve(process.cwd(), 'src');
    const files: string[] = [];
    (function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(full);
      }
    })(srcRoot);

    const claimed = new Set<string>();
    for (const file of files) {
      for (const m of readFileSync(file, 'utf8').matchAll(/useFirstRunTurn\(\s*'([^']+)'/g)) {
        claimed.add(m[1]);
      }
    }

    expect([...claimed].sort()).toEqual([...FIRST_RUN_ORDER].sort());
  });
});
