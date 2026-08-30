// BuildTrack — WhatsNewModal tests.
//
// The modal announces the release's changes once per version PER USER (the
// seen-flag key carries the username: several users from different companies
// can share one browser). These tests pin the behaviours that matter:
//   - shows once to an in-audience user and dismissing persists the flag
//   - a dismissal by user A does not hide the news from user B
//   - an older stored version means the user has NOT seen this round
//   - out-of-audience roles and logged-out visitors are never interrupted
//   - an inaccessible localStorage (private mode) never crashes the app
//
// react-i18next is mocked with t: key => key, so assertions target keys and
// aria wiring, not literal copy (the copy lives in common.json and is
// Anderson's to approve).

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
  getRole: vi.fn(),
  getUsername: vi.fn(),
}));

vi.mock('../../services/auth', () => ({
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

import { WhatsNewModal, WHATS_NEW_VERSION } from '../WhatsNewModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SEEN_KEY = (username: string) => `bt.whatsnew.${username}`;
const SLIDE_COUNT = 6;

describe('WhatsNewModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getRole.mockReturnValue('ADMIN');
    auth.getUsername.mockReturnValue('ana');
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  const render = () => act(() => { root.render(<WhatsNewModal />); });
  const dialog = () => container.querySelector('[role="dialog"]');
  // t() returns keys, so buttons are found by their i18n key text.
  const btn = (key: string) =>
    Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(key));
  // The X button has no text — only its aria-label (also an i18n key).
  const closeBtn = () =>
    container.querySelector<HTMLButtonElement>('button[aria-label="buttons.close"]');
  const dots = () =>
    Array.from(container.querySelectorAll('button')).filter(
      b => b.getAttribute('aria-label') === 'whatsNew.dot',
    );

  it('shows for an unseen ADMIN and dismissing persists the per-user flag', () => {
    render();
    expect(dialog()).not.toBeNull();

    // Walk to the last card to prove the nav works, then finish.
    for (let i = 0; i < SLIDE_COUNT - 1; i++) {
      act(() => (btn('buttons.nextSimple') as HTMLButtonElement).click());
    }
    act(() => (btn('whatsNew.done') as HTMLButtonElement).click());

    expect(dialog()).toBeNull();
    expect(localStorage.getItem(SEEN_KEY('ana'))).toBe(WHATS_NEW_VERSION);
  });

  it('does not show again to the user who already dismissed this version', () => {
    localStorage.setItem(SEEN_KEY('ana'), WHATS_NEW_VERSION);
    render();
    expect(dialog()).toBeNull();
  });

  it('still shows to a second user on the same browser after the first dismissed', () => {
    // User A dismisses through the real production path…
    render();
    act(() => closeBtn()!.click());
    expect(dialog()).toBeNull();
    act(() => { root.unmount(); });

    // …then user B (another company, same machine) signs in: B has not seen it.
    auth.getUsername.mockReturnValue('bruno');
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    render();
    expect(dialog()).not.toBeNull();
  });

  it('shows again when the stored flag is an older version', () => {
    localStorage.setItem(SEEN_KEY('ana'), '2026-06');
    render();
    expect(dialog()).not.toBeNull();
  });

  it('does not interrupt roles the round does not touch (e.g. WORKER)', () => {
    auth.getRole.mockReturnValue('WORKER');
    render();
    expect(dialog()).toBeNull();
  });

  it('never shows to a logged-out visitor', () => {
    auth.isAuthenticated.mockReturnValue(false);
    render();
    expect(dialog()).toBeNull();
  });

  it('tolerates an inaccessible localStorage: still shows and dismisses without crashing', () => {
    // Private mode: mere access works but every call throws (the shape the
    // vitest.setup MemoryStorage lets us emulate by swapping the global).
    const original = globalThis.localStorage;
    const throwing = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
      clear() { throw new Error('denied'); },
      key() { throw new Error('denied'); },
      length: 0,
    } as unknown as Storage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: throwing, writable: true, configurable: true,
    });
    try {
      render();
      expect(dialog()).not.toBeNull(); // no flag readable → show once
      act(() => closeBtn()!.click());
      expect(dialog()).toBeNull(); // dismiss still closes, without crashing
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: original, writable: true, configurable: true,
      });
    }
  });

  it('renders one card and one dot per update', () => {
    render();
    expect(dots()).toHaveLength(SLIDE_COUNT);
    expect(container.querySelectorAll('section')).toHaveLength(SLIDE_COUNT);
  });

  it('closes with Escape and pages with the arrow keys', () => {
    render();
    expect(dialog()).not.toBeNull();

    // ArrowRight moves the current-dot marker to the second card.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(dots().map(d => d.getAttribute('aria-current'))).toEqual(
      ['false', 'true', 'false', 'false', 'false', 'false'],
    );

    // ArrowLeft comes back.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });
    expect(dots()[0].getAttribute('aria-current')).toBe('true');

    // Escape dismisses (and counts as seen — it was shown).
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(dialog()).toBeNull();
    expect(localStorage.getItem(SEEN_KEY('ana'))).toBe(WHATS_NEW_VERSION);
  });
});
