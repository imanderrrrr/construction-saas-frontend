import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsRight, VolumeX } from 'lucide-react';
import { useFirstRunTurn } from '../lib/firstRunQueue';

/**
 * Full-screen brand intro — ArchLogic → BuildTrack — shown ONCE on the first
 * desktop visit.
 *
 * The piece is a rendered video (`public/intro/archlogic-buildtrack-intro.*`,
 * source and render recipe in `tools/intro-video/`). This component only owns
 * the lifecycle:
 *
 *   - Plays on the FIRST visit only — gated by localStorage. `?intro` on any
 *     URL plays it again on demand (demos, reviews) without touching storage.
 *   - DESKTOP only — phones, tablets, and any touch-only device skip it. So do
 *     visitors who ask for reduced motion or for less data.
 *   - SOUND: the film has a sound design (quiet: about -21 LUFS). Browsers
 *     refuse to autoplay with sound on a first visit, so it tries with sound
 *     and, when refused, plays muted and shows one small "turn sound on"
 *     button (a click is the gesture that unlocks it). Where the browser does
 *     allow it (a visitor who has used the site before, or `?intro` from a
 *     page they have clicked on) the sound just plays.
 *   - SKIPPABLE ON ASK — no skip control on screen at first, so nothing
 *     competes with the film. A click anywhere on it brings up a small
 *     "Saltar" button in the bottom-right corner, and that button ends the
 *     intro (it fades and counts as seen, like reaching the end). The sound
 *     button never ends it. And it never holds the site hostage: if the video
 *     cannot get going (autoplay
 *     refused, slow network, file missing) it steps aside within seconds
 *     WITHOUT marking the intro as seen, and the page opens as if it were not
 *     there. The visitor gets another go on their next visit.
 *   - Fades out when the video ends, then unmounts and marks the visit as
 *     "seen".
 *   - Locks body scroll while playing, releases as soon as the overlay
 *     finishes (the lock is wired to the turn, not to unmount, because the
 *     component stays mounted in App.tsx and just returns null when done).
 *
 * FIRST IN THE ROW (see lib/firstRunQueue): it is opaque and covers the whole
 * viewport, so nothing else may open underneath it.
 * The tour and the what's-new carousel start only once it hands the row over.
 *
 * The film is "Del plano a la obra": a drawing sheet on which the ArchLogic
 * mark is drafted, then a building site where BuildTrack goes up under a tower
 * crane. Its ground is the landing's own drawing paper (PAPER below), which
 * fades to flat paper at the top and bottom edges — the same paper as this
 * overlay, so a window taller than 21:9 shows no frame to match. It is 21:9 so
 * the camera pan leaves through the real edge of the window on any 16:9 /
 * 16:10 screen.
 */

/** Bumped from v2 when the CSS animation was replaced by the rendered video. */
export const INTRO_STORAGE_KEY = 'buildtrack:intro-v3-seen';
/** Length of the rendered video (ffprobe: 9.15 s). */
export const INTRO_VIDEO_DURATION_MS = 9_150;
/** No `playing` event by now → give up and let the page through. */
export const INTRO_START_TIMEOUT_MS = 4_000;
export const INTRO_FADE_OUT_MS = 700;
/** Slack over the video's length before the safety net fades it out. */
const END_GRACE_MS = 2_500;
const REPLAY_PARAM = 'intro';
/** The film's ground: the landing's drawing paper (`--color-bt-paper`). The overlay and the video must agree. */
const PAPER = '#f3eee6';

const VIDEO_MP4 = '/intro/archlogic-buildtrack-intro.mp4';
const VIDEO_WEBM = '/intro/archlogic-buildtrack-intro.webm';

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

function shouldShowIntro(): boolean {
  if (typeof window === 'undefined') return false; // SSR safety.
  if (typeof window.matchMedia !== 'function') return false;
  // Desktop only: real pointer (mouse / trackpad) AND wide viewport.
  // (`pointer: fine` excludes touch-primary phones and most tablets, even
  // when their viewport is wide.)
  if (!window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) return false;
  // An explicit ask for less motion or less data outranks a brand ceremony.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if ((navigator as NavigatorWithConnection).connection?.saveData) return false;
  if (new URLSearchParams(window.location.search).has(REPLAY_PARAM)) return true;
  try {
    return !window.localStorage.getItem(INTRO_STORAGE_KEY);
  } catch {
    // Private mode or storage disabled — skip the intro rather than forcing
    // it on every page load.
    return false;
  }
}

export function IntroOverlay() {
  const { t } = useTranslation('common');
  // `played`: this notice is over (finished, or gave up) and the row moves on.
  const [played, setPlayed] = useState(false);
  // `started`: the browser is really playing the video, not just loading it.
  const [started, setStarted] = useState(false);
  const [fading, setFading] = useState(false);
  // The browser refused sound: the film is playing muted and the button shows.
  const [soundBlocked, setSoundBlocked] = useState(false);
  // The visitor clicked the film: the skip button is on screen.
  const [skipShown, setSkipShown] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  // Our claim on the row: something to play, and not played yet.
  const pending = useMemo(() => !played && shouldShowIntro(), [played]);
  const myTurn = useFirstRunTurn('brandIntro', pending);

  // Lock body scroll while the overlay is on screen, and release it as soon
  // as the turn ends. This must depend on `myTurn` (not `[]`) because the
  // component doesn't unmount when it finishes — it just returns null — so a
  // cleanup tied to unmount alone would leave the lock pinned forever.
  useEffect(() => {
    if (!myTurn) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [myTurn]);

  // Autoplay is the browser's call, not ours. First with sound; a refusal (the
  // norm on a first visit) falls back to muted playback, which is always
  // allowed, plus the button. Only if even that is refused is there no intro,
  // and then it is the page that opens, not a white screen.
  useEffect(() => {
    if (!myTurn) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    const withSound = video.play?.();
    withSound?.catch(() => {
      video.muted = true;
      setSoundBlocked(true);
      video.play?.()?.catch(() => setPlayed(true));
    });
  }, [myTurn]);

  const turnSoundOn = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setSoundBlocked(false);
  };

  // A keyboard user who brought the button up can press it straight away.
  useEffect(() => {
    if (skipShown) skipRef.current?.focus();
  }, [skipShown]);

  const skip = (event: MouseEvent) => {
    event.stopPropagation();
    videoRef.current?.pause?.();
    setFading(true);
  };

  // Never played in time (slow network, blocked, hidden tab): let the page
  // through. Not marked as seen — they get the real thing next visit.
  useEffect(() => {
    if (!myTurn || started) return;
    const timer = window.setTimeout(() => setPlayed(true), INTRO_START_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [myTurn, started]);

  // `ended` is the normal exit. This is the net for a stream that stalls
  // halfway or never reports it.
  useEffect(() => {
    if (!myTurn || !started) return;
    const net = window.setTimeout(() => setFading(true), INTRO_VIDEO_DURATION_MS + END_GRACE_MS);
    return () => window.clearTimeout(net);
  }, [myTurn, started]);

  useEffect(() => {
    if (!fading) return;
    const done = window.setTimeout(() => {
      try {
        window.localStorage.setItem(INTRO_STORAGE_KEY, '1');
      } catch {
        // If storage is unavailable, the user will see the intro again next
        // visit. Not ideal but not blocking either.
      }
      // Hands the row to the next notice (the tour, then what's new).
      setPlayed(true);
    }, INTRO_FADE_OUT_MS);
    return () => window.clearTimeout(done);
  }, [fading]);

  if (!myTurn) return null;

  const giveUp = () => setPlayed(true);

  return (
    <div
      className="intro-overlay-root"
      data-first-run="brandIntro"
      data-fading={fading ? 'true' : 'false'}
      onClick={() => setSkipShown(true)}
    >
      <style>{OVERLAY_CSS}</style>
      <video
        ref={videoRef}
        className="intro-overlay-video"
        aria-hidden="true"
        playsInline
        autoPlay
        preload="auto"
        tabIndex={-1}
        disablePictureInPicture
        disableRemotePlayback
        onPlaying={() => setStarted(true)}
        onEnded={() => setFading(true)}
        onError={giveUp}
      >
        {/* MP4 first: smaller and universal. WebM for browsers without H.264.
            A failed <source> reports on the source, not on the <video>, so the
            last one carries the "nothing played" handler. */}
        <source src={VIDEO_MP4} type="video/mp4" />
        <source src={VIDEO_WEBM} type="video/webm" onError={giveUp} />
      </video>
      <div className="intro-overlay-controls">
        {soundBlocked && (
          <button
            type="button"
            className="intro-overlay-sound"
            onClick={turnSoundOn}
            aria-label={t('intro.soundOn')}
            title={t('intro.soundOn')}
          >
            <VolumeX size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
        {skipShown && (
          <button ref={skipRef} type="button" className="intro-overlay-skip" onClick={skip}>
            {t('intro.skip')}
            <ChevronsRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

const OVERLAY_CSS = `
.intro-overlay-root {
  position: fixed;
  inset: 0;
  z-index: 2147483647; /* above absolutely everything */
  background: ${PAPER};
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 1;
  transition: opacity ${INTRO_FADE_OUT_MS}ms ease;
}
.intro-overlay-root[data-fading="true"] {
  opacity: 0;
  pointer-events: none;
}
.intro-overlay-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: ${PAPER};
  pointer-events: none;
}
/* The controls sit together in the bottom-right corner: the sound button
   (only when the browser muted the film) and, once the visitor clicks, Saltar. */
.intro-overlay-controls {
  position: absolute;
  right: 28px;
  bottom: 28px;
  display: flex;
  align-items: center;
  gap: 10px;
}
/* Quiet, and it arrives after the first second so it never competes with the
   mark building. */
.intro-overlay-sound {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d9cfbc;
  border-radius: 999px;
  background: ${PAPER};
  color: #6c6152;
  cursor: pointer;
  opacity: 0;
  animation: intro-sound-in 400ms ease 900ms forwards;
}
.intro-overlay-sound:hover { color: #17130f; border-color: #a89a87; }
.intro-overlay-sound:focus-visible { outline: 2px solid #f97316; outline-offset: 2px; }
@keyframes intro-sound-in { to { opacity: 1; } }
.intro-overlay-skip {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px 0 18px;
  border: 1px solid #17130f;
  border-radius: 999px;
  background: #17130f;
  color: ${PAPER};
  font: 600 14px/1 system-ui, sans-serif;
  letter-spacing: 0.01em;
  cursor: pointer;
  animation: intro-sound-in 200ms ease forwards;
  opacity: 0;
}
.intro-overlay-skip:hover { background: #f97316; border-color: #f97316; color: #17130f; }
.intro-overlay-skip:focus-visible { outline: 2px solid #f97316; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .intro-overlay-sound, .intro-overlay-skip { animation: none; opacity: 1; }
}
`;
