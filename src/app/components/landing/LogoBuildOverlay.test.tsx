// BuildTrack — «BuildTrack se construye», the landing's logo build.
//
// The video is a rendered file; what can go wrong is everything around it,
// and that is what these pin: who gets it (every page load, phones too, not
// with reduced motion or Save-Data, after the intro film), where it stands (in
// the logo's corner, the whole frame between the top of the page and the
// logo), where its last frame lands (exactly on the real logo's box), and
// every way it gives the real logo back instead of leaving a hole there.
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
  resetLogoBuildForTests,
} from './LogoBuildOverlay';
import { resetFirstRunQueue, useFirstRunTurn } from '../../lib/firstRunQueue';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOT_ALLOWED = () => Promise.reject(new DOMException('autoplay blocked', 'NotAllowedError'));

/** Whether the visitor asked for reduced motion; no other query matters here. */
function stubMedia({ reducedMotion = false }: { reducedMotion?: boolean }) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') && reducedMotion,
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

/** Where the real logo's box is, as the landing would measure it: here as
 *  on a 1440 px desktop (64 px gutter, ~24 px above it). */
const DESKTOP_MARK = rect(84, 24, 32, 32);
let markBox = DESKTOP_MARK;
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
  /** Where the frame stands, from its inline style, in page px; `scale` = page px per video px. */
  const frame = () => {
    const style = overlay()!.style;
    const [left, top, width] = [style.left, style.top, style.width].map(v => parseFloat(v));
    return { left, top, width, scale: width / 1400 };
  };
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
    resetLogoBuildForTests(); // every test is a fresh page load
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    stubMedia({});
    markBox = DESKTOP_MARK;
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
    it('builds the logo in its corner, grows it onto the real logo and hands it back', async () => {
      await render();
      expect(overlay()).toBeNull(); // the row gets a moment to fill first

      await advance(LOGO_BUILD_ARM_MS);
      expect(overlay()?.dataset.phase).toBe('loading');
      expect(overlay()?.getAttribute('aria-hidden')).toBe('true');
      expect(playSpy).toHaveBeenCalled();
      expect(video()?.muted).toBe(true);
      expect(hidden()).toBe(false); // nothing is playing yet: the real logo stays

      // The whole frame fits between the top of the page and the logo (the
      // crane reaches the frame's top edge), its orange box (centre 364,260 in
      // video px) level with the real one (centre 100,40).
      const { left, top, scale } = frame();
      expect(top).toBeCloseTo(2, 5);
      expect(left + 364 * scale).toBeCloseTo(100, 5);
      expect(top + 260 * scale).toBeCloseTo(40, 5);
      expect(128 * scale).toBeLessThan(32); // smaller than the logo: as large as fits

      await fire('playing');
      expect(overlay()?.dataset.phase).toBe('building');
      expect(hidden()).toBe(true);

      overlay()!.getBoundingClientRect = () => rect(left, top, 1400 * scale, 360 * scale);
      await fire('ended');
      expect(overlay()?.dataset.phase).toBe('landing');
      expect(hidden()).toBe(true); // the growing frame IS the logo for now

      // After the transform, the orange box drawn in the video (300,196 · 128 px
      // in its own pixels) must sit exactly on the real one (84,24 · 32 px).
      const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(overlay()!.style.transform);
      expect(match).not.toBeNull();
      const [dx, dy, k] = match!.slice(1).map(Number);
      expect(left + dx + 300 * scale * k).toBeCloseTo(84, 5);
      expect(top + dy + 196 * scale * k).toBeCloseTo(24, 5);
      expect(128 * scale * k).toBeCloseTo(32, 5);

      await advance(LOGO_BUILD_LANDING_MS);
      expect(overlay()?.dataset.phase).toBe('handoff');
      expect(hidden()).toBe(false);

      await advance(LOGO_BUILD_HANDOFF_MS);
      expect(overlay()).toBeNull();
    });

    it('never builds it larger than the logo itself, however much room there is', async () => {
      markBox = rect(84, 200, 32, 32);
      await renderAndLoad();
      const { left, top, scale } = frame();
      expect(128 * scale).toBeCloseTo(32, 5);
      expect(left + 364 * scale).toBeCloseTo(100, 5);
      expect(top + 260 * scale).toBeCloseTo(216, 5);
    });

    it('on a narrow phone it moves right rather than let the edge of the page cut the excavator', async () => {
      markBox = rect(16, 20, 32, 32);
      await renderAndLoad();
      const { left, top, scale } = frame();
      expect(left).toBe(0);
      expect(top).toBeCloseTo(2, 5);
      expect(top + 260 * scale).toBeCloseTo(36, 5);
    });

    it('plays the 700 px render everywhere, Safari\'s HEVC with alpha before the WebM', async () => {
      await renderAndLoad();
      expect(sources()).toEqual([
        { src: '/logo-build/logo-build-700.hevc.mov', type: 'video/quicktime; codecs="hvc1"' },
        { src: '/logo-build/logo-build-700.webm', type: 'video/webm' },
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

    it('when no file can be played, the build is dropped', async () => {
      await renderAndLoad();
      const [hevc, webm] = document.querySelectorAll('.logo-build-root source');
      await fire('error', hevc);
      await fire('error', webm);
      expect(overlay()).toBeNull();
    });
  });

  describe('every time someone enters the site', () => {
    /** Runs a whole build, from the first frame to the real logo being back. */
    const buildToTheEnd = async () => {
      await renderAndLoad();
      await fire('playing');
      await fire('ended');
      await advance(LOGO_BUILD_LANDING_MS + LOGO_BUILD_HANDOFF_MS);
      expect(overlay()).toBeNull();
    };

    it('the next page load builds it again: nothing is remembered in storage', async () => {
      await buildToTheEnd();
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);

      await act(async () => { root.unmount(); });
      resetLogoBuildForTests(); // a reload, or a new visit
      root = createRoot(container);
      await renderAndLoad();
      expect(overlay()?.dataset.phase).toBe('loading');
    });

    it('coming back to the landing within the same page load does not replay it', async () => {
      await buildToTheEnd();
      const plays = playSpy.mock.calls.length;
      await act(async () => { root.unmount(); }); // off to another page of the site…
      root = createRoot(container);
      await renderAndLoad(); // …and back to the landing
      expect(overlay()).toBeNull(); // not even loading the video
      expect(playSpy.mock.calls.length).toBe(plays);
      expect(standIns.slice(-1)).toEqual([false]);
    });

    it('a build that never got going is tried again when the landing opens again', async () => {
      await renderAndLoad();
      await advance(LOGO_BUILD_START_TIMEOUT_MS); // the video never started
      expect(overlay()).toBeNull();

      await act(async () => { root.unmount(); });
      root = createRoot(container);
      await renderAndLoad();
      expect(overlay()?.dataset.phase).toBe('loading');
    });
  });

  describe('after the intro film', () => {
    it('waits while the film plays, and builds as soon as it is gone', async () => {
      await render({ withIntro: true, introPlaying: true });
      await advance(LOGO_BUILD_ARM_MS + LOGO_BUILD_START_TIMEOUT_MS);
      expect(overlay()).toBeNull();
      expect(playSpy).not.toHaveBeenCalled();
      expect(standIns).not.toContain(true); // the real logo stays meanwhile

      await render({ withIntro: true, introPlaying: false });
      expect(overlay()).toBeNull(); // a moment for the film's fade to clear
      await advance(LOGO_BUILD_ARM_MS);
      expect(overlay()?.dataset.phase).toBe('loading');
      expect(playSpy).toHaveBeenCalled();

      await fire('playing');
      expect(overlay()?.dataset.phase).toBe('building');
      expect(hidden()).toBe(true);
    });

    it('a film that takes the screen before the build has started: the build steps back and waits again', async () => {
      await renderAndLoad();
      expect(overlay()?.dataset.phase).toBe('loading');

      await render({ withIntro: true, introPlaying: true });
      expect(overlay()).toBeNull();
      await advance(LOGO_BUILD_START_TIMEOUT_MS * 2);
      expect(overlay()).toBeNull();

      await render({ withIntro: true, introPlaying: false });
      await advance(LOGO_BUILD_ARM_MS);
      expect(overlay()?.dataset.phase).toBe('loading');
    });
  });

  describe('who does not get it', () => {
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

    it('a page that opens scrolled past the logo: nothing to stand in for', async () => {
      // A reload that restores the scroll: the logo is still at the top of the
      // page, 1000 px above the window.
      Object.defineProperty(window, 'scrollY', { value: 1000, configurable: true });
      markBox = rect(84, 24 - 1000, 32, 32);
      try {
        await renderAndLoad();
        expect(overlay()).toBeNull();
        expect(playSpy).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      }
    });
  });

  describe('it never leaves a hole where the logo goes', () => {
    it('a video that does not start in time is dropped', async () => {
      await renderAndLoad();
      await advance(LOGO_BUILD_START_TIMEOUT_MS);
      expect(overlay()).toBeNull();
      expect(hidden()).toBe(false);
      expect(standIns).not.toContain(true);
    });

    it('refused autoplay drops it', async () => {
      playSpy.mockImplementation(NOT_ALLOWED);
      await renderAndLoad();
      expect(overlay()).toBeNull();
    });

    it('a stream that breaks halfway gives the logo back at once', async () => {
      await renderAndLoad();
      await fire('playing');
      expect(hidden()).toBe(true);

      await fire('error');
      expect(overlay()).toBeNull();
      expect(hidden()).toBe(false);
    });

    it('a stream that stalls without ending: the safety net hands the logo back, no growing', async () => {
      await renderAndLoad();
      await fire('playing');

      await advance(LOGO_BUILD_DURATION_MS);
      expect(overlay()?.dataset.phase).toBe('building'); // still within the grace

      await advance(2_500);
      expect(overlay()?.dataset.phase).toBe('handoff');
      expect(overlay()?.style.transform).toBe('');
      expect(hidden()).toBe(false);
    });

    it('with the logo scrolled out of view by the end, it just fades and the logo is back', async () => {
      await renderAndLoad();
      await fire('playing');
      const { left, top, scale } = frame();
      markBox = rect(84, -400, 32, 32);
      overlay()!.getBoundingClientRect = () => rect(left, top - 424, 1400 * scale, 360 * scale);
      await fire('ended');

      expect(overlay()?.dataset.phase).toBe('handoff');
      expect(overlay()?.style.transform).toBe('');
      expect(hidden()).toBe(false);
    });
  });
});
