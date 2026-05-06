import { useEffect, useRef, useState } from 'react';
import { IntroAnimation, INTRO_ANIMATION_DURATION_MS } from './IntroAnimation';

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
 *     finishes (the lock is wired to `phase`, not to unmount, because the
 *     component stays mounted in App.tsx and just returns null when done).
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
  return window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches;
}

export function IntroOverlay() {
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>(() =>
    shouldShowIntro() ? 'playing' : 'done',
  );
  const fadeTimerRef = useRef<number | null>(null);
  const unmountTimerRef = useRef<number | null>(null);

  // Lock body scroll while the overlay is on screen, and release it as soon
  // as `phase` becomes 'done'. This must depend on `phase` (not `[]`)
  // because the component doesn't unmount when it finishes — it just
  // returns null — so a cleanup tied to unmount alone would leave the lock
  // pinned forever.
  useEffect(() => {
    if (phase === 'done') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'done') return;

    const fadeAt = ANIMATION_DURATION_MS + HOLD_AFTER_ANIMATION_MS;
    fadeTimerRef.current = window.setTimeout(() => {
      setPhase('fading');
    }, fadeAt);
    unmountTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // If storage is unavailable, the user will see the intro again next
        // visit. Not ideal but not blocking either.
      }
      setPhase('done');
    }, fadeAt + FADE_OUT_MS);

    return () => {
      if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
      if (unmountTimerRef.current !== null) window.clearTimeout(unmountTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      className="intro-overlay-root"
      data-fading={phase === 'fading' ? 'true' : 'false'}
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
