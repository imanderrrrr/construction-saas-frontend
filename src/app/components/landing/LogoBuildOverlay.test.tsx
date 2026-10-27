// BuildTrack — «BuildTrack se construye», the landing's logo build.
//
// The video is a rendered file; what can go wrong is everything around it,
// and that is what these pin: who gets it (once, phones too, not with reduced
// motion or Save-Data, not right after the intro film), where its last frame
// lands (exactly on the real logo's box), and every way it gives the real
// logo back instead of leaving a hole in the corner.
//
// jsdom plays and lays out nothing, so media events are dispatched by hand
// and the two boxes the landing measures are stubbed.

import React, { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  LogoBuildOverlay,
  LOGO_BUILD_ARM_MS,
  LOGO_BUILD_DURATION_MS,
  LOGO_BUILD_HANDOFF_MS,
  LOGO_BUILD_LANDING_MS,
  LOGO_BUILD_START_TIMEOUT_MS,
  LOGO_BUILD_STORAGE_KEY,
} from './LogoBuildOverlay';
import { resetFirstRunQueue, useFirstRunTurn } from '../../lib/firstRunQueue';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOT_ALLOWED = () => Promise.reject(new DOMException('autoplay blocked', 'NotAllowedError'));

/** Which media queries answer "yes". Anything not listed answers "no". */
function stubMedia(yes: { phone?: boolean; reducedMotion?: boolean }) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion')
      ? yes.reducedMotion === true
      : query.includes('max-width')
        ? yes.phone === true
        : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left, top, width, height, x: left, y: top, right: left + width, bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Where the real logo's box is, as the landing would measure it. */
let markBox = rect(22, 20, 32, 32);
/** Every value the page was told: true = hide the real logo. */
let standIns: boolean[] = [];

/** The intro film as the row sees it: a claim on the first place while it plays. */
function IntroInTheRow({ playing }: { playing: boolean }) {
  useFirstRunTurn('brandIntro', playing);
  return null;
}

type PageProps = { withIntro?: boolean; introPlaying?: boolean };

/** The landing around the build: the real logo's box and who hides it. */
function Page({ withIntro = false, introPlaying = true }: PageProps) {
  const mark = useRef<HTMLSpanElement>(null);
  return (
    <>
      {withIntro && <IntroInTheRow playing={introPlaying} />}
      <span
        ref={node => {
          (mark as { current: HTMLSpanElement | null }).current = node;
          if (node) node.getBoundingClientRect = () => markBox;
        }}
      />
      <LogoBuildOverlay markRef={mark} onStandInChange={value => standIns.push(value)} />
    </>
  );
}

describe('LogoBuildOverlay', () => {
  let container: HTMLDivElement;
  let root: Root;
  let playSpy: MockInstance<() => Promise<void>>;

  const overlay = () => document.querySelector<HTMLElement>('.logo-build-root');
  const video = () => document.querySelector<HTMLVideoElement>('.logo-build-root video');
  const sources = () =>
    Array.from(document.querySelectorAll<HTMLSourceElement>('.logo-build-root source')).map(s => ({
      src: s.getAttribute('src'),
      type: s.getAttribute('type'),
    }));
  const fire = async (type: string, el: Element | null = video()) => {
    await act(async () => { el!.dispatchEvent(new Event(type)); });
  };
  const advance = async (ms: number) => {
    await act(async () => { vi.advanceTimersByTime(ms); await Promise.resolve(); });
  };
  const render = async (props: PageProps = {}) => {
    await act(async () => { root.render(<Page {...props} />); });
  };
  const seen = () => localStorage.getItem(LOGO_BUILD_STORAGE_KEY);
  /** Is the real logo hidden right now? */
  const hidden = () => standIns[standIns.length - 1] === true;
  /** Mounted, armed, and loading: the moment the video is in the page. */
  const renderAndLoad = async () => {
    await render();
    await advance(LOGO_BUILD_ARM_MS);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    resetFirstRunQueue();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    stubMedia({});
    markBox = rect(22, 20, 32, 32);
    standIns = [];
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

  describe('a first visit', () => {
    it('builds the logo over the dimmed hero, lands it on the real logo and hands it back', async () => {
      await render();
      expect(overlay()).toBeNull(); // the row gets a moment to fill first

      await advance(LOGO_BUILD_ARM_MS);
      expect(overlay()?.dataset.phase).toBe('loading');
      expect(overlay()?.getAttribute('aria-hidden')).toBe('true');
      expect(playSpy).toHaveBeenCalled();
      expect(video()?.muted).toBe(true);
      expect(hidden()).toBe(false); // nothing is playing yet: the real logo stays

      await fire('playing');
      expect(overlay()?.dataset.phase).toBe('building');
      expect(hidden()).toBe(true);
      expect(seen()).toBeNull();

      // The video lays out centred: 1000 px wide, its top-left at (195, 300).
      video()!.getBoundingClientRect = () => rect(195, 300, 1000, 1000 * 360 / 1400);
      await fire('ended');
      expect(overlay()?.dataset.phase).toBe('landing');
      expect(hidden()).toBe(true); // the flying frame IS the logo for now

      // After the transform, the orange box drawn in the video (300,196 · 128 px
      // in its own pixels) must sit exactly on the real one (22,20 · 32 px).
      const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(video()!.style.transform);
      expect(match).not.toBeNull();
      const [dx, dy, k] = match!.slice(1).map(Number);
      const perVideoPx = (1000 / 1400) * k;
      expect(195 + dx + 300 * perVideoPx).toBeCloseTo(22, 5);
      expect(300 + dy + 196 * perVideoPx).toBeCloseTo(20, 5);
      expect(128 * perVideoPx).toBeCloseTo(32, 5);

      await advance(LOGO_BUILD_LANDING_MS);
      expect(overlay()?.dataset.phase).toBe('handoff');
      expect(hidden()).toBe(false);
      expect(seen()).toBe('1');

      await advance(LOGO_BUILD_HANDOFF_MS);
      expect(overlay()).toBeNull();
    });

    it('plays it on phones too, from the 700 px render', async () => {
      stubMedia({ phone: true });
      await renderAndLoad();
      expect(sources().map(s => s.src)).toEqual([
        '/logo-build/logo-build-700.hevc.mov',
        '/logo-build/logo-build-700.webm',
      ]);
    });

    it('offers Safari its HEVC with alpha before the WebM everyone else plays', async () => {
      await renderAndLoad();
      expect(sources()).toEqual([
        { src: '/logo-build/logo-build-1400.hevc.mov', type: 'video/quicktime; codecs="hvc1"' },
        { src: '/logo-build/logo-build-1400.webm', type: 'video/webm' },
      ]);
    });
  });

  describe('picking a file', () => {
    // A browser skips a <source> it cannot play by firing `error` on it; React
    // hands that event to the <video>'s onError as well, although the native
    // one does not bubble. Chrome skipping Safari's file is not a failure.
    it('a browser that cannot play the HEVC skips to the WebM instead of giving up', async () => {
      await renderAndLoad();
      const [hevc] = document.querySelectorAll('.logo-build-root source');
      await fire('error', hevc);
      expect(overlay()?.dataset.phase).toBe('loading');

      await fire('playing');
      expect(overlay()?.dataset.phase).toBe('building');
    });

    it('when no file can be played, the build is dropped and kept for next visit', async () => {
      await renderAndLoad();
      const [hevc, webm] = document.querySelectorAll('.logo-build-root source');
      await fire('error', hevc);
      await fire('error', webm);
      expect(overlay()).toBeNull();
      expect(seen()).toBeNull();
    });
  });

  describe('who does not get it', () => {
    it('a browser that has seen it already', async () => {
      localStorage.setItem(LOGO_BUILD_STORAGE_KEY, '1');
      await renderAndLoad();
      expect(overlay()).toBeNull();
      expect(playSpy).not.toHaveBeenCalled();
    });

    it('a visitor who asked for reduced motion', async () => {
      stubMedia({ reducedMotion: true });
      await renderAndLoad();
      expect(overlay()).toBeNull();
    });

    it('a visitor who asked to save data', async () => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
      try {
        await renderAndLoad();
        expect(overlay()).toBeNull();
      } finally {
        Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true });
      }
    });

    it('`?logo` replays it for a browser that has seen it', async () => {
      localStorage.setItem(LOGO_BUILD_STORAGE_KEY, '1');
      window.history.replaceState(null, '', '/?logo');
      await renderAndLoad();
      expect(overlay()?.dataset.phase).toBe('loading');
    });

    it('a visit that opened with the intro film: it waits for a later one', async () => {
      await render({ withIntro: true });
      await advance(LOGO_BUILD_ARM_MS);
      expect(overlay()).toBeNull();

      // Not even once the film is over: a second brand moment would queue
      // behind the first.
      await render({ withIntro: true, introPlaying: false });
      await advance(LOGO_BUILD_ARM_MS + LOGO_BUILD_START_TIMEOUT_MS);
      expect(overlay()).toBeNull();
      expect(playSpy).not.toHaveBeenCalled();
      expect(seen()).toBeNull();
    });
  });

  describe('it never leaves a hole where the logo goes', () => {
    it('a video that does not start in time is dropped, and kept for next visit', async () => {
      await renderAndLoad();
      await advance(LOGO_BUILD_START_TIMEOUT_MS);
      expect(overlay()).toBeNull();
      expect(hidden()).toBe(false);
      expect(standIns).not.toContain(true);
      expect(seen()).toBeNull();
    });

    it('refused autoplay drops it, and keeps it for next visit', async () => {
      playSpy.mockImplementation(NOT_ALLOWED);
      await renderAndLoad();
      expect(overlay()).toBeNull();
      expect(seen()).toBeNull();
    });

    it('a stream that breaks halfway gives the logo back at once', async () => {
      await renderAndLoad();
      await fire('playing');
      expect(hidden()).toBe(true);

      await fire('error');
      expect(overlay()).toBeNull();
      expect(hidden()).toBe(false);
      expect(seen()).toBeNull();
    });

    it('a stream that stalls without ending: the safety net hands the logo back, no flight', async () => {
      await renderAndLoad();
      await fire('playing');

      await advance(LOGO_BUILD_DURATION_MS);
      expect(overlay()?.dataset.phase).toBe('building'); // still within the grace

      await advance(2_500);
      expect(overlay()?.dataset.phase).toBe('handoff');
      expect(video()?.style.transform).toBe('');
      expect(hidden()).toBe(false);
      expect(seen()).toBe('1');
    });

    it('with the logo scrolled out of view there is no flight: it fades and the logo is back', async () => {
      markBox = rect(22, -400, 32, 32);
      await renderAndLoad();
      await fire('playing');
      video()!.getBoundingClientRect = () => rect(195, 300, 1000, 257);
      await fire('ended');

      expect(overlay()?.dataset.phase).toBe('handoff');
      expect(video()?.style.transform).toBe('');
      expect(hidden()).toBe(false);
    });
  });
});
