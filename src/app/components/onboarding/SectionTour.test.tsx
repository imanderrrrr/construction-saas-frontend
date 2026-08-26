// BuildTrack — per-section guided tour.
//
// The contract users asked for, pinned: the tour must BLOCK the page (not sit
// beside it like the old banner), point at the real element, offer a skip, and
// remember it was seen. Plus the two degradations that keep it from breaking a
// screen: a section with no authored steps keeps the banner, and a step whose
// anchor is not on screen is dropped rather than spotlighting nothing.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { SectionTour } from './SectionTour';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Desktop by default — the tour is deliberately suppressed below 768px. */
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

/** jsdom gives every element offsetParent === null; the tour reads it to test
 *  visibility, so opt the anchors we plant into "visible". */
function plantAnchor(id: string) {
  const el = document.createElement('div');
  el.setAttribute('data-tour', id);
  Object.defineProperty(el, 'offsetParent', { get: () => document.body });
  el.scrollIntoView = vi.fn();
  el.getBoundingClientRect = () =>
    ({ top: 100, left: 100, width: 200, height: 50, right: 300, bottom: 150, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

describe('SectionTour', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    setViewport(true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.querySelectorAll('[data-tour]').forEach(el => el.remove());
    vi.useRealTimers();
  });

  it('spotlights the anchored element and blocks the page', async () => {
    plantAnchor('sec.users.kpis');
    await act(async () => {
      root.render(<SectionTour section="users" username="ana" replayNonce={0} />);
    });
    await advance(600);

    const card = document.querySelector('[data-testid="tour-spotlight-card"]');
    expect(card).not.toBeNull();
    // Blocking: a fixed, full-viewport modal layer — the old banner had none.
    const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
    expect(modal).not.toBeNull();
    expect(modal!.className).toContain('fixed inset-0');
    // Specific copy for THIS step, not a generic section blurb.
    expect(card!.textContent).toContain('sec.users.step.kpis.title');
  });

  it('drops steps whose anchor is not on screen', async () => {
    // Only one of the four authored `users` stops exists in the DOM.
    plantAnchor('sec.users.filters');
    await act(async () => {
      root.render(<SectionTour section="users" username="ana" replayNonce={0} />);
    });
    await advance(600);

    const card = document.querySelector('[data-testid="tour-spotlight-card"]')!;
    expect(card.textContent).toContain('sec.users.step.filters.title');
    // 1 of 1 — the three missing anchors are not counted as steps.
    expect(card.textContent).toContain('admin:tour.stepOf');
  });

  it('skipping closes the tour and does not re-open on revisit', async () => {
    plantAnchor('sec.audit.kpis');
    await act(async () => {
      root.render(<SectionTour section="audit" username="ana" replayNonce={0} />);
    });
    await advance(600);
    expect(document.querySelector('[data-testid="tour-spotlight-card"]')).not.toBeNull();

    const skip = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent?.includes('admin:tour.skip'),
    )!;
    await act(async () => skip.click());
    expect(document.querySelector('[data-testid="tour-spotlight-card"]')).toBeNull();

    // Second visit: seen is persisted, so nothing opens.
    await act(async () => {
      root.render(<SectionTour section="audit" username="ana" replayNonce={0} />);
    });
    await advance(600);
    expect(document.querySelector('[data-testid="tour-spotlight-card"]')).toBeNull();
  });

  it('falls back to the banner for a section with no authored steps', async () => {
    await act(async () => {
      root.render(<SectionTour section="billing" username="ana" replayNonce={0} />);
    });
    await advance(600);
    expect(document.querySelector('[data-testid="tour-spotlight-card"]')).toBeNull();
    // The banner keys are still rendered by the SectionIntro fallback.
    expect(container.textContent).not.toContain('sec.billing.step');
  });

  it('does not spotlight on mobile', async () => {
    setViewport(false);
    plantAnchor('sec.users.kpis');
    await act(async () => {
      root.render(<SectionTour section="users" username="ana" replayNonce={0} />);
    });
    await advance(600);
    expect(document.querySelector('[data-testid="tour-spotlight-card"]')).toBeNull();
  });

  it('a stale nonce does not resurrect banners the user already dismissed', async () => {
    // The topbar nonce stays >0 for the rest of the session after the first
    // "?". On mobile every section degrades to the banner and SectionIntro
    // remounts per section, so forwarding the raw nonce re-showed every
    // dismissed banner on every section visited until reload.
    setViewport(false);
    localStorage.setItem('bt.sectionintro.v1.ana.users', new Date().toISOString());

    // "?" pressed while on audit…
    await act(async () => {
      root.render(<SectionTour section="audit" username="ana" replayNonce={2} />);
    });
    await advance(4200);

    // …then the user navigates to users, whose banner they dismissed long ago.
    await act(async () => {
      root.render(<SectionTour section="users" username="ana" replayNonce={2} />);
    });
    await advance(4200); // past the anchor poll → banner fallback path
    expect(container.textContent).not.toContain('sec.users.title');
  });

  it('the "?" still re-shows the dismissed banner of the section on screen', async () => {
    setViewport(false);
    localStorage.setItem('bt.sectionintro.v1.ana.users', new Date().toISOString());

    await act(async () => {
      root.render(<SectionTour section="users" username="ana" replayNonce={0} />);
    });
    await advance(4200);
    expect(container.textContent).not.toContain('sec.users.title'); // dismissed stays hidden

    // Topbar "?" while on users.
    await act(async () => {
      root.render(<SectionTour section="users" username="ana" replayNonce={1} />);
    });
    await advance(100);
    expect(container.textContent).toContain('sec.users.title');
  });
});
