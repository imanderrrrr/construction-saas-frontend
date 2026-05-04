import { useEffect, useRef, useState } from 'react';

/**
 * Full-screen intro animation shown ONCE on the first desktop visit.
 *
 * Source design: archlogic/project/ArchLogic Animation.html (Claude Design).
 * Faithfully recreated as a React component — same keyframes, same timings,
 * same easings.
 *
 * Behaviour (per product brief):
 *   - Plays on the FIRST visit only — gated by localStorage.
 *   - DESKTOP only — phones, tablets, and any touch-only device skip it.
 *   - NOT skippable — no close button, no Esc key, no skip link, no replay.
 *   - Fades out automatically when the animation ends, then unmounts and
 *     marks the visit as "seen" so subsequent visits go straight to content.
 *   - Locks body scroll while playing.
 *
 * The animation itself runs ~5.8s. We hold the final composition for ~1.2s
 * before fading the overlay (800ms), then unmount.
 */

const STORAGE_KEY = 'buildtrack:intro-v1-seen';

// Match the original chat brief: total ~5.8s. After that we hold the
// final composition for a beat, then fade.
const ANIMATION_DURATION_MS = 5_800;
const HOLD_AFTER_ANIMATION_MS = 1_200;
const FADE_OUT_MS = 800;

/**
 * Decide whether to show the intro on this visit. Centralised so the
 * decision is testable and the criteria are documented in one place.
 */
function shouldShowIntro(): boolean {
  if (typeof window === 'undefined') return false; // SSR safety.
  // Already seen on this device.
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return false;
  } catch {
    // Private mode or storage disabled — fall back to "don't show", so the
    // user isn't forced to sit through the intro on every page load.
    return false;
  }
  // Desktop only: real pointer (mouse / trackpad) AND wide viewport.
  // (`pointer: fine` excludes touch-primary phones and most tablets, even
  // when their viewport is wide.)
  const desktopQuery = window.matchMedia(
    '(min-width: 1024px) and (pointer: fine)',
  );
  return desktopQuery.matches;
}

export function IntroOverlay() {
  // Decide synchronously on mount so we never flash the rest of the app
  // for one frame before realising we should overlay it.
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>(() =>
    shouldShowIntro() ? 'playing' : 'done',
  );
  const fadeTimerRef = useRef<number | null>(null);
  const unmountTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase === 'done') return;

    // Lock body scroll while the intro covers the screen.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Schedule the fade-out and the final unmount.
    const fadeAt = ANIMATION_DURATION_MS + HOLD_AFTER_ANIMATION_MS;
    fadeTimerRef.current = window.setTimeout(() => {
      setPhase('fading');
    }, fadeAt);
    unmountTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // If storage is unavailable, the user will see the intro again on
        // their next visit. Not ideal, but not blocking either.
      }
      setPhase('done');
    }, fadeAt + FADE_OUT_MS);

    return () => {
      document.body.style.overflow = previousOverflow;
      if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
      if (unmountTimerRef.current !== null) window.clearTimeout(unmountTimerRef.current);
    };
    // We intentionally do not depend on `phase` — the timers are scheduled
    // exactly once when the overlay first mounts in `playing` state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;

  // The CSS below is a 1:1 port of `ArchLogic Animation.html` — same
  // keyframe names, same timings, same easings, scoped under `.intro-root`
  // so it cannot leak into the rest of the app.
  return (
    <div
      className="intro-root"
      data-fading={phase === 'fading' ? 'true' : 'false'}
      aria-hidden="true"
    >
      <style>{INTRO_CSS}</style>
      <div className="stage">
        <div className="scaler">
          <div className="composer">
            <div className="mark-wrap">
              <img src="/intro/logo-mark.png" alt="" />
            </div>
            <div className="text-wrap">
              <div className="text-stack">
                <img className="text-archlogic" src="/intro/logo-text.png" alt="" />
                <img className="text-buildtrack" src="/intro/buildtrack.png" alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Kept as a single string so it travels with the component. Scoped to
// `.intro-root` so nothing here can collide with the rest of the app.
const INTRO_CSS = `
.intro-root {
  position: fixed;
  inset: 0;
  z-index: 2147483647; /* above absolutely everything */
  background: #ffffff;
  color: #111111;
  font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
  overflow: hidden;
  opacity: 1;
  transition: opacity ${FADE_OUT_MS}ms ease;
}
.intro-root[data-fading="true"] {
  opacity: 0;
  pointer-events: none;
}
.intro-root .stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.intro-root .scaler { transform-origin: center center; }
@media (max-width: 1300px) { .intro-root .scaler { transform: scale(0.85); } }
@media (max-width: 1000px) { .intro-root .scaler { transform: scale(0.65); } }
@media (max-width: 720px)  { .intro-root .scaler { transform: scale(0.45); } }

.intro-root .composer {
  position: relative;
  display: flex;
  align-items: center;
  height: 360px;
  transform: translateX(0);
  will-change: transform;
}

.intro-root .mark-wrap {
  position: relative;
  height: 360px;
  width: 360px;
  flex: 0 0 360px;
  z-index: 3;
  will-change: transform, opacity;
  transform-origin: center center;
  opacity: 0;
  animation: introMarkEnter 1.0s cubic-bezier(0.22, 1, 0.36, 1) 0.15s forwards;
}
.intro-root .mark-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.intro-root .text-wrap {
  position: relative;
  height: 360px;
  display: flex;
  align-items: center;
  overflow: hidden;
  z-index: 2;
  will-change: width;
  width: 0;
  margin-left: 0;
  animation: introTextReveal 1.4s cubic-bezier(0.77, 0, 0.175, 1) 1.6s forwards;
}

.intro-root .text-stack {
  position: relative;
  height: 100%;
  width: 820px;
  flex: 0 0 820px;
}
.intro-root .text-stack img {
  position: absolute;
  left: 0;
  top: 50%;
  height: 78%;
  width: auto;
  display: block;
  will-change: transform, opacity;
}
.intro-root .text-stack img.text-archlogic {
  transform: translate(-40px, -50%);
  opacity: 0;
  animation:
    introTextImgIn 1.6s cubic-bezier(0.22, 1, 0.36, 1) 1.7s forwards,
    introArchDropOut 0.7s cubic-bezier(0.55, 0.085, 0.68, 0.53) 4.4s forwards;
}
.intro-root .text-stack img.text-buildtrack {
  /* Selector specificity matches the original — must beat the base
     .text-stack img { height: 78% } rule. */
  height: 110%;
  transform: translate(0, calc(-50% - 420px));
  opacity: 0;
  animation: introBuildDropIn 0.95s cubic-bezier(0.34, 1.2, 0.5, 1) 4.85s forwards;
}

@keyframes introMarkEnter {
  0%   { opacity: 0; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes introTextReveal {
  0%   { width: 0;     margin-left: 0; }
  100% { width: 820px; margin-left: 60px; }
}
@keyframes introTextImgIn {
  0%   { opacity: 0;   transform: translate(-60px, -50%); }
  30%  { opacity: 0.4; }
  100% { opacity: 1;   transform: translate(0, -50%); }
}
@keyframes introArchDropOut {
  0%   { opacity: 1; transform: translate(0, -50%); }
  100% { opacity: 1; transform: translate(0, calc(-50% + 420px)); }
}
@keyframes introBuildDropIn {
  0%   { opacity: 0; transform: translate(0, calc(-50% - 420px)); }
  8%   { opacity: 1; }
  70%  {              transform: translate(0, calc(-50% + 14px)); }
  85%  {              transform: translate(0, calc(-50% - 5px));  }
  100% { opacity: 1; transform: translate(0, -50%); }
}

/* Reduced motion: jump straight to the final composition with BuildTrack
   already settled, then the regular fade-out timer takes care of dismissal. */
@media (prefers-reduced-motion: reduce) {
  .intro-root .mark-wrap,
  .intro-root .text-wrap,
  .intro-root .text-archlogic,
  .intro-root .text-buildtrack {
    animation: none !important;
  }
  .intro-root .mark-wrap { opacity: 1; }
  .intro-root .text-wrap { width: 820px; margin-left: 60px; }
  .intro-root .text-archlogic { opacity: 0 !important; }
  .intro-root .text-buildtrack { opacity: 1; transform: translate(0, -50%); }
}
`;
