import { useEffect, useMemo, useState } from 'react';
import { IntroAnimation, INTRO_ANIMATION_DURATION_MS } from './IntroAnimation';
import { useFirstRunTurn } from '../lib/firstRunQueue';

/**
 * Full-screen intro animation shown ONCE on the first desktop visit.
 *
 * The animation itself lives in `IntroAnimation` (reused by the landing
 * carousel). This component only owns the lifecycle:
 *
 *   - Plays on the FIRST visit only — gated by localStorage.
 *   - DESKTOP only — phones, tablets, and any touch-only device skip it.
 *   - NOT skippable — no close button, no Esc key, no skip link.
 *   - Fades out automatically when the animation ends, then unmounts and
 *     marks the visit as "seen".
 *   - Locks body scroll while playing, releases as soon as the overlay
 *     finishes (the lock is wired to the turn, not to unmount, because the
 *     component stays mounted in App.tsx and just returns null when done).
 *
 * FIRST IN THE ROW (see lib/firstRunQueue): it is opaque, covers the whole
 * viewport and cannot be dismissed, so nothing else may open underneath it.
 * The tour and the what's-new carousel start only once it hands the row over.
 *
 * Hold the final composition for ~1.2s before fading the overlay (800ms),
 * then unmount.
 */

const STORAGE_KEY = 'buildtrack:intro-v2-seen';

const ANIMATION_DURATION_MS = INTRO_ANIMATION_DURATION_MS;
const HOLD_AFTER_ANIMATION_MS = 1_200;
const FADE_OUT_MS = 800;

function shouldShowIntro(): boolean {
  if (typeof window === 'undefined') return false; // SSR safety.
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return false;
  } catch {
    // Private mode or storage disabled — skip the intro rather than forcing
    // it on every page load.
    return false;
  }
  // Desktop only: real pointer (mouse / trackpad) AND wide viewport.
  // (`pointer: fine` excludes touch-primary phones and most tablets, even
  // when their viewport is wide.)
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches;
}

export function IntroOverlay() {
  const [played, setPlayed] = useState(false);
  const [fading, setFading] = useState(false);

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

  useEffect(() => {
    if (!myTurn) return;

    const fadeAt = ANIMATION_DURATION_MS + HOLD_AFTER_ANIMATION_MS;
    const fadeTimer = window.setTimeout(() => {
      setFading(true);
    }, fadeAt);
    const endTimer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // If storage is unavailable, the user will see the intro again next
        // visit. Not ideal but not blocking either.
      }
      // Hands the row to the next notice (the tour, then what's new).
      setPlayed(true);
    }, fadeAt + FADE_OUT_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(endTimer);
    };
  }, [myTurn]);

  if (!myTurn) return null;

  return (
    <div
      className="intro-overlay-root"
      data-first-run="brandIntro"
      data-fading={fading ? 'true' : 'false'}
      aria-hidden="true"
    >
      <style>{OVERLAY_CSS}</style>
      <IntroAnimation />
    </div>
  );
}

const OVERLAY_CSS = `
.intro-overlay-root {
  position: fixed;
  inset: 0;
  z-index: 2147483647; /* above absolutely everything */
  background: #ffffff;
  overflow: hidden;
  opacity: 1;
  transition: opacity ${FADE_OUT_MS}ms ease;
}
.intro-overlay-root[data-fading="true"] {
  opacity: 0;
  pointer-events: none;
}
`;
