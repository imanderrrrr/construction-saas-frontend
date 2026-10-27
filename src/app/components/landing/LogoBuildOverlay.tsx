import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useFirstRunIdle } from '../../lib/firstRunQueue';

/**
 * «BuildTrack se construye» — the landing's logo, built where it stands: in
 * the top-left corner of the hero a small building site (an excavator, a
 * tower crane and a dump truck) sets the ten letters on a slab, the machines
 * leave, and what is left is the logo, which grows into the real one.
 *
 * The piece is a rendered video with a transparent background
 * (`public/logo-build/`; source and render recipe in `tools/logo-animation/`).
 * Its crane reaches the very top of the frame, so at the logo's own size (a
 * 32 px box) the top of the page would cut it off. The build therefore plays
 * as large as fits between the top of the page and the logo — its orange box
 * level with the real one, ~18–22 px on most screens — and the last frame then
 * grows onto the real logo, which takes over. Nothing else on the page is
 * covered or dimmed.
 *
 *   - Once per browser (localStorage). `?logo` on the landing replays it on
 *     demand (demos, reviews) without touching storage.
 *   - Phones too, unlike the desktop-only intro film.
 *   - Never in the way: it takes no clicks, and if the video has not started
 *     within seconds it is dropped WITHOUT marking it seen. Reduced motion or
 *     Save-Data: no build, just the logo.
 *   - Never right after another ceremony: if the first-run row is busy when
 *     the page opens (the intro film on a first desktop visit), the build
 *     waits for a later visit instead of queueing a second brand moment
 *     behind the first. It is not in FIRST_RUN_ORDER on purpose: it covers
 *     nothing that has to wait for it.
 *   - The real logo stays in the DOM the whole time (link, aria-label, crisp
 *     text); the page only makes it transparent while the video stands in.
 *
 * Placed in page coordinates (not fixed to the window), so it scrolls with
 * the logo it stands in for.
 */

/** Bump to show the build again to everyone who has already seen it.
 *  v2: the build moved from the middle of the screen into the logo's corner. */
export const LOGO_BUILD_STORAGE_KEY = 'buildtrack:logo-build-v2-seen';
/** Length of the rendered video (ffprobe: 5.6 s). */
export const LOGO_BUILD_DURATION_MS = 5_600;
/** Time the first-run row gets to fill before the build commits to loading. */
export const LOGO_BUILD_ARM_MS = 300;
/** No `playing` event by now → no build this visit. */
export const LOGO_BUILD_START_TIMEOUT_MS = 3_000;
/** The last frame growing onto the real logo. */
export const LOGO_BUILD_LANDING_MS = 700;
/** Fade from the video's last frame to the real logo underneath it. */
export const LOGO_BUILD_HANDOFF_MS = 250;
/** Slack over the video's length before the safety net hands the logo back. */
const END_GRACE_MS = 2_500;
const REPLAY_PARAM = 'logo';
/** Air between the top of the page and the top of the crane, in page px. */
const TOP_MARGIN = 2;

/** The video's width and where the logo's orange box sits in it, in its own
 *  pixels (tools/logo-animation/stage.json). The 700 px render is the same
 *  frame at half size, so the ratios hold. */
const CANVAS_WIDTH = 1400;
const TILE = { x: 300, y: 196, size: 128 };
const TILE_CENTER = { x: TILE.x + TILE.size / 2, y: TILE.y + TILE.size / 2 };

/** Played at ~200–300 css px, the 700 px render is sharp even at 2–3× density. */
const SOURCE = { hevc: '/logo-build/logo-build-700.hevc.mov', webm: '/logo-build/logo-build-700.webm' };

/**
 * armed    → waiting for the first-run row to settle (nothing rendered yet)
 * loading  → the video is in place but has not started
 * building → the video plays in the corner; the real logo is hidden
 * landing  → the last frame grows onto the real logo
 * handoff  → the real logo is back; the video fades off it
 * off      → nothing to show (never wanted, done, or gave up)
 */
type Phase = 'off' | 'armed' | 'loading' | 'building' | 'landing' | 'handoff';

/** Where the video sits on the page, in page px. */
type Placement = { left: number; top: number; width: number };

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

function shouldBuildLogo(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  // An explicit ask for less motion or less data outranks a brand flourish.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if ((navigator as NavigatorWithConnection).connection?.saveData) return false;
  if (new URLSearchParams(window.location.search).has(REPLAY_PARAM)) return true;
  try {
    return !window.localStorage.getItem(LOGO_BUILD_STORAGE_KEY);
  } catch {
    // Storage disabled: skip it rather than play it on every page load.
    return false;
  }
}

function isOnScreen(rect: DOMRect): boolean {
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

/**
 * The whole frame between the top of the page and the real logo, its orange
 * box level with the logo's — as large as that fits, never larger than the
 * logo itself. Pushed right if the left edge of the page would cut the
 * excavator (narrow phones); the last frame makes up the difference.
 * Null when the logo is not there to stand in for.
 */
function placeOverLogo(mark: DOMRect): Placement | null {
  if (mark.width === 0 || !isOnScreen(mark)) return null;
  const centerX = mark.left + mark.width / 2 + window.scrollX;
  const centerY = mark.top + mark.height / 2 + window.scrollY;
  const scale = Math.min(mark.width / TILE.size, (centerY - TOP_MARGIN) / TILE_CENTER.y);
  if (scale <= 0) return null;
  return {
    left: Math.max(0, centerX - TILE_CENTER.x * scale),
    top: centerY - TILE_CENTER.y * scale,
    width: CANVAS_WIDTH * scale,
  };
}

type Props = {
  /** The real logo's orange box: where the build stands and lands. */
  markRef: RefObject<HTMLElement>;
  /** True while the video stands in for the real logo (hide it), false once it is back. */
  onStandInChange: (standingIn: boolean) => void;
};

export function LogoBuildOverlay({ markRef, onStandInChange }: Props) {
  const [phase, setPhase] = useState<Phase>(() => (shouldBuildLogo() ? 'armed' : 'off'));
  const [placement, setPlacement] = useState<Placement>();
  const [flight, setFlight] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idle = useFirstRunIdle();

  // Another ceremony holds the screen: not this visit. Once the build is on
  // screen it finishes — it covers nothing that waits for it.
  useEffect(() => {
    if (!idle) setPhase(p => (p === 'armed' || p === 'loading' ? 'off' : p));
  }, [idle]);

  // The intro film claims the row from its own effect; give it a moment
  // before loading anything. Then stand over the logo — if it is in view.
  useEffect(() => {
    if (phase !== 'armed') return;
    const timer = window.setTimeout(() => {
      const mark = markRef.current?.getBoundingClientRect();
      const place = mark ? placeOverLogo(mark) : null;
      if (place) setPlacement(place);
      setPhase(p => (p !== 'armed' ? p : place ? 'loading' : 'off'));
    }, LOGO_BUILD_ARM_MS);
    return () => window.clearTimeout(timer);
  }, [phase, markRef]);

  // Muted autoplay is allowed almost everywhere. Where it is refused (iOS Low
  // Power Mode, some data savers) there is simply no build.
  useEffect(() => {
    if (phase !== 'loading') return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play?.()?.catch(() => setPhase(p => (p === 'loading' ? 'off' : p)));
    const timer = window.setTimeout(
      () => setPhase(p => (p === 'loading' ? 'off' : p)),
      LOGO_BUILD_START_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  // `ended` is the normal exit. This is the net for a stream that stalls
  // halfway or never reports it: no growing a half-built frame, the real logo
  // just comes back.
  useEffect(() => {
    if (phase !== 'building') return;
    const net = window.setTimeout(() => setPhase('handoff'), LOGO_BUILD_DURATION_MS + END_GRACE_MS);
    return () => window.clearTimeout(net);
  }, [phase]);

  // Grow the last frame so that its orange box lands exactly on the real one.
  // Measured now, not at mount: the layout may have moved since (a resize, a
  // late font). With the logo scrolled out of view there is nothing to show.
  useEffect(() => {
    if (phase !== 'landing') return;
    const frame = rootRef.current?.getBoundingClientRect();
    const mark = markRef.current?.getBoundingClientRect();
    if (!frame || !mark || frame.width === 0 || mark.width === 0 || !isOnScreen(mark)) {
      setPhase('handoff');
      return;
    }
    const scale = mark.width / TILE.size; // page px per video px, once landed
    const current = frame.width / CANVAS_WIDTH; // ... and right now
    const dx = mark.left - TILE.x * scale - frame.left;
    const dy = mark.top - TILE.y * scale - frame.top;
    setFlight({ transform: `translate(${dx}px, ${dy}px) scale(${scale / current})` });
    const timer = window.setTimeout(() => setPhase('handoff'), LOGO_BUILD_LANDING_MS);
    return () => window.clearTimeout(timer);
  }, [phase, markRef]);

  useEffect(() => {
    if (phase !== 'handoff') return;
    try {
      window.localStorage.setItem(LOGO_BUILD_STORAGE_KEY, '1');
    } catch {
      // Storage unavailable: shouldBuildLogo() already skips it next time.
    }
    const timer = window.setTimeout(() => setPhase('off'), LOGO_BUILD_HANDOFF_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const standingIn = phase === 'building' || phase === 'landing';
  useEffect(() => {
    onStandInChange(standingIn);
  }, [standingIn, onStandInChange]);

  if (phase === 'off' || phase === 'armed' || !placement) return null;

  // A broken file or stream at any point: the real logo, not a gap.
  const giveUp = () => setPhase('off');

  return (
    <div
      ref={rootRef}
      className="logo-build-root"
      data-phase={phase}
      aria-hidden="true"
      style={{ left: placement.left, top: placement.top, width: placement.width, ...flight }}
    >
      <style>{OVERLAY_CSS}</style>
      <video
        ref={videoRef}
        className="logo-build-video"
        muted
        playsInline
        autoPlay
        preload="auto"
        tabIndex={-1}
        disablePictureInPicture
        disableRemotePlayback
        onPlaying={() => setPhase(p => (p === 'loading' ? 'building' : p))}
        onEnded={() => setPhase(p => (p === 'building' ? 'landing' : p))}
        // Only the video's own errors (a broken stream). React also hands this
        // handler the `error` of every <source> the browser skips, and Chrome
        // skipping Safari's file is not a failure.
        onError={event => {
          if (event.target === event.currentTarget) giveUp();
        }}
      >
        {/* HEVC with alpha first: only Safari plays it, and Safari would draw
            the VP9 WebM's transparent ground as a black box. Every other
            browser skips it for the WebM. When the last <source> fails too,
            there is nothing left to try. */}
        <source src={SOURCE.hevc} type='video/quicktime; codecs="hvc1"' />
        <source src={SOURCE.webm} type="video/webm" onError={giveUp} />
      </video>
    </div>
  );
}

const OVERLAY_CSS = `
.logo-build-root {
  position: absolute;
  z-index: 30; /* over the hero and its nav, under the assistant (z-40 / z-50) */
  pointer-events: none;
  transform-origin: 0 0;
  opacity: 1;
  transition: transform ${LOGO_BUILD_LANDING_MS}ms cubic-bezier(0.65, 0, 0.35, 1), opacity ${LOGO_BUILD_HANDOFF_MS}ms ease;
}
.logo-build-root[data-phase="handoff"] { opacity: 0; }
.logo-build-video {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1400 / 360;
}
`;
