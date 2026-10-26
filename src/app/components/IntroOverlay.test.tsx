// BuildTrack — the brand intro (ArchLogic → BuildTrack video).
//
// The video itself is a rendered file; what can go wrong is the LIFECYCLE
// around it, and that is what these pin: who gets it (first visit, desktop,
// no reduced motion), how it ends (fade, "seen", the row moves on), and — the
// part that matters most for a cover that cannot be dismissed — every way it
// steps aside instead of holding the site hostage.
//
// jsdom plays nothing, so the browser's media events are dispatched by hand,
// exactly the ones a real <video> fires.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  IntroOverlay,
  INTRO_FADE_OUT_MS,
  INTRO_START_TIMEOUT_MS,
  INTRO_STORAGE_KEY,
  INTRO_VIDEO_DURATION_MS,
} from './IntroOverlay';
import { firstRunHolder, resetFirstRunQueue } from '../lib/firstRunQueue';

// t() returns the key, so the button is found by its i18n key.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOT_ALLOWED = () => Promise.reject(new DOMException('autoplay blocked', 'NotAllowedError'));

/** Which media queries answer "yes". Anything not listed answers "no". */
function stubMedia(yes: { desktop?: boolean; reducedMotion?: boolean }) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion')
      ? yes.reducedMotion === true
      : yes.desktop === true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('IntroOverlay', () => {
  let container: HTMLDivElement;
  let root: Root;
  let playSpy: MockInstance<() => Promise<void>>;

  const overlay = () => document.querySelector<HTMLElement>('.intro-overlay-root');
  const video = () => document.querySelector<HTMLVideoElement>('.intro-overlay-root video');
  const fire = async (type: string, el: Element | null = video()) => {
    await act(async () => { el!.dispatchEvent(new Event(type)); });
  };
  const advance = async (ms: number) => {
    await act(async () => { vi.advanceTimersByTime(ms); await Promise.resolve(); });
  };
  const render = async () => {
    await act(async () => { root.render(<IntroOverlay />); });
  };
  const seen = () => localStorage.getItem(INTRO_STORAGE_KEY);
  const soundButton = () => document.querySelector<HTMLButtonElement>('.intro-overlay-sound');

  beforeEach(() => {
    vi.useFakeTimers();
    resetFirstRunQueue();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    document.body.style.overflow = '';
    stubMedia({ desktop: true });
    playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    playSpy.mockRestore();
    resetFirstRunQueue();
    window.history.replaceState(null, '', '/');
    vi.useRealTimers();
  });

  describe('a first desktop visit', () => {
    it('plays an inline video over the whole screen, with sound, and holds the row', async () => {
      await render();

      expect(overlay()).not.toBeNull();
      expect(firstRunHolder()).toBe('brandIntro');
      const el = video()!;
      // Sound is tried first: the film has a sound design.
      expect(el.muted).toBe(false);
      expect(soundButton()).toBeNull(); // nothing to ask for when the browser allowed it
      expect(el.hasAttribute('playsinline')).toBe(true);
      expect(el.hasAttribute('autoplay')).toBe(true);
      // MP4 first (smaller, universal), WebM for browsers without H.264.
      const sources = Array.from(el.querySelectorAll('source')).map(s => s.getAttribute('type'));
      expect(sources).toEqual(['video/mp4', 'video/webm']);
      // The picture is decorative for assistive tech; the page behind stays reachable.
      expect(el.getAttribute('aria-hidden')).toBe('true');
      expect(overlay()!.getAttribute('aria-hidden')).toBeNull();
    });

    it('locks the page scroll while it plays and gives it back afterwards', async () => {
      await render();
      expect(document.body.style.overflow).toBe('hidden');

      await fire('playing');
      await fire('ended');
      await advance(INTRO_FADE_OUT_MS);

      expect(document.body.style.overflow).toBe('');
    });

    it('fades when the video ends, then marks the visit as seen and lets the row go', async () => {
      await render();
      await fire('playing');
      expect(overlay()!.getAttribute('data-fading')).toBe('false');
      expect(seen()).toBeNull();

      await fire('ended');
      expect(overlay()!.getAttribute('data-fading')).toBe('true');
      expect(seen()).toBeNull(); // still fading: not seen until it is gone

      await advance(INTRO_FADE_OUT_MS);
      expect(overlay()).toBeNull();
      expect(seen()).toBe('1');
      expect(firstRunHolder()).toBeNull();
    });

    it('is not shown again on the next visit', async () => {
      await render();
      await fire('playing');
      await fire('ended');
      await advance(INTRO_FADE_OUT_MS);

      await act(async () => { root.unmount(); });
      root = createRoot(container);
      resetFirstRunQueue();
      await render();

      expect(overlay()).toBeNull();
    });

    it('still ends if the browser never reports `ended` (a stream that stalls halfway)', async () => {
      await render();
      await fire('playing');

      // Two steps: the fade's own timer only exists after the net has fired.
      await advance(INTRO_VIDEO_DURATION_MS + 2_500);
      expect(overlay()!.getAttribute('data-fading')).toBe('true');
      await advance(INTRO_FADE_OUT_MS);

      expect(overlay()).toBeNull();
      expect(seen()).toBe('1');
    });

    it('cannot be dismissed by the visitor: no button, no Esc, no click', async () => {
      await render();
      await fire('playing');

      expect(overlay()!.querySelector('button, a, [role="button"]')).toBeNull();
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        overlay()!.click();
      });
      expect(overlay()).not.toBeNull();
      expect(overlay()!.getAttribute('data-fading')).toBe('false');
    });
  });

  describe('sound — browsers refuse it on a first visit', () => {
    /** The norm: autoplay WITH sound is rejected, muted autoplay is allowed. */
    const refuseSoundOnly = () => {
      playSpy.mockImplementation(function (this: HTMLMediaElement) {
        return this.muted ? Promise.resolve() : NOT_ALLOWED();
      });
    };
    const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

    it('falls back to muted playback, keeps the intro, and offers one button to turn sound on', async () => {
      refuseSoundOnly();
      await render();
      await settle();

      expect(overlay()).not.toBeNull(); // the intro was NOT dropped
      expect(video()!.muted).toBe(true);
      const button = soundButton();
      expect(button).not.toBeNull();
      expect(button!.getAttribute('aria-label')).toBe('intro.soundOn');

      await fire('playing');
      await fire('ended');
      await advance(INTRO_FADE_OUT_MS);
      expect(overlay()).toBeNull();
      expect(seen()).toBe('1');
    });

    it('turns the sound on with a click — and that click never ends or skips the intro', async () => {
      refuseSoundOnly();
      await render();
      await settle();
      await fire('playing');

      await act(async () => { soundButton()!.click(); });

      expect(video()!.muted).toBe(false);
      expect(soundButton()).toBeNull();
      expect(overlay()).not.toBeNull();
      expect(overlay()!.getAttribute('data-fading')).toBe('false');
      expect(seen()).toBeNull();
    });

    it('is the only control on the intro, and only while the sound is blocked', async () => {
      refuseSoundOnly();
      await render();
      await settle();

      const controls = overlay()!.querySelectorAll('button, a, [role="button"]');
      expect(controls).toHaveLength(1);
      expect(controls[0]).toBe(soundButton());
    });

    it('does not mark the visit as seen because the sound was blocked', async () => {
      refuseSoundOnly();
      await render();
      await settle();
      await fire('playing');

      expect(seen()).toBeNull();
      expect(firstRunHolder()).toBe('brandIntro');
    });
  });

  describe('who does not get it', () => {
    it('skips phones, tablets and touch-only screens', async () => {
      stubMedia({ desktop: false });
      await render();
      expect(overlay()).toBeNull();
      expect(firstRunHolder()).toBeNull();
    });

    it('skips visitors who asked for reduced motion', async () => {
      stubMedia({ desktop: true, reducedMotion: true });
      await render();
      expect(overlay()).toBeNull();
      expect(firstRunHolder()).toBeNull();
    });

    it('skips visitors who asked for less data (Save-Data)', async () => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
      try {
        await render();
        expect(overlay()).toBeNull();
      } finally {
        Reflect.deleteProperty(navigator, 'connection');
      }
    });

    it('skips visitors whose storage is blocked, rather than replaying on every load', async () => {
      // What a browser with blocked site data does: touching it throws.
      const own = Object.getOwnPropertyDescriptor(window, 'localStorage');
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('blocked', 'SecurityError'); },
      });
      try {
        await render();
        expect(overlay()).toBeNull();
      } finally {
        if (own) Object.defineProperty(window, 'localStorage', own);
        else Reflect.deleteProperty(window, 'localStorage');
      }
    });
  });

  describe('?intro — on demand', () => {
    it('plays again even if it was already seen, and leaves the stored flag alone', async () => {
      localStorage.setItem(INTRO_STORAGE_KEY, '1');
      window.history.replaceState(null, '', '/?intro');
      await render();
      expect(overlay()).not.toBeNull();

      await fire('playing');
      await fire('ended');
      await advance(INTRO_FADE_OUT_MS);

      expect(overlay()).toBeNull();
      expect(seen()).toBe('1');
    });

    it('does not override the guards: a phone with ?intro still gets nothing', async () => {
      window.history.replaceState(null, '', '/?intro');
      stubMedia({ desktop: false });
      await render();
      expect(overlay()).toBeNull();
    });
  });

  describe('when the video cannot play, the site opens anyway', () => {
    it('gives up if it has not started within a few seconds, and is NOT marked as seen', async () => {
      await render();
      expect(overlay()).not.toBeNull();

      await advance(INTRO_START_TIMEOUT_MS - 50);
      expect(overlay()).not.toBeNull();
      await advance(100);

      expect(overlay()).toBeNull();
      expect(seen()).toBeNull(); // they get the real thing next visit
      expect(firstRunHolder()).toBeNull();
      expect(document.body.style.overflow).toBe('');
    });

    it('does not give up once it IS playing, however long the start took', async () => {
      await render();
      await advance(INTRO_START_TIMEOUT_MS - 100);
      await fire('playing');

      await advance(INTRO_START_TIMEOUT_MS * 2);
      expect(overlay()).not.toBeNull();
    });

    it('steps aside at once when the browser refuses autoplay even muted', async () => {
      playSpy.mockImplementation(NOT_ALLOWED);
      await render();
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });

      expect(overlay()).toBeNull();
      expect(seen()).toBeNull();
      expect(firstRunHolder()).toBeNull();
    });

    it('steps aside at once on a decode error', async () => {
      await render();
      await fire('error');

      expect(overlay()).toBeNull();
      expect(seen()).toBeNull();
    });

    it('steps aside at once when no source could be loaded (the last <source> reports it)', async () => {
      await render();
      const lastSource = video()!.querySelector('source:last-of-type');
      await fire('error', lastSource);

      expect(overlay()).toBeNull();
      expect(seen()).toBeNull();
      expect(document.body.style.overflow).toBe('');
    });
  });
});
