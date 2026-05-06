import { useEffect, useRef } from 'react';

/**
 * Pure-visual ArchLogic → BuildTrack intro animation.
 *
 * No localStorage, no body-scroll lock, no lifecycle — just the markup +
 * keyframes. The composition is authored at 1240px wide and ResizeObserver
 * scales it down to fit whatever box you drop it into (full-screen overlay,
 * carousel slide, marketing card, etc.), capped at 1.0.
 *
 * Source design: archlogic/project/ArchLogic Animation.html (Claude Design,
 * 2026-05). Same keyframes / timings / easings.
 *
 * Used by:
 *   - IntroOverlay (one-time first-visit overlay)
 *   - LandingVideoCarousel (looping demo on the public landing)
 */

// Native composition width — the design is authored at this size and we
// scale down (never up) to fit the host container.
const NATIVE_WIDTH_PX = 1240;
// Slack for the wordmark reveal: the composer grows from 360px (mark only)
// to ~1240px (mark + 60 gap + 820 text). We want the FINAL composition to
// fit, so we scale relative to NATIVE_WIDTH_PX, plus a small breathing
// margin so the box doesn't kiss the edges.
const FIT_TARGET_PX = 1300;

export function IntroAnimation() {
  const stageRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const scaler = scalerRef.current;
    if (!stage || !scaler) return;

    const apply = () => {
      const width = stage.clientWidth;
      // Cap at 1 so we never blow the design up past its native size.
      const scale = Math.min(1, width / FIT_TARGET_PX);
      scaler.style.transform = `scale(${scale})`;
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={stageRef} className="intro-stage">
      <style>{INTRO_ANIMATION_CSS}</style>
      <div ref={scalerRef} className="scaler">
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
  );
}

// Re-exported for callers that still want the constants for sanity checks.
export { NATIVE_WIDTH_PX, FIT_TARGET_PX };

// Total runtime end-to-end: BuildTrack settles at 5.75s + 0.95s = ~6.7s.
// Exported so consumers (overlay, carousel) can sync their own timers.
export const INTRO_ANIMATION_DURATION_MS = 6_700;

// Scoped to `.intro-stage` so it can't leak out. The actual scale value is
// applied inline by the React component via ResizeObserver (CSS container
// queries with calc() can't express "scale to fit, capped at 1" cleanly
// because length / number resolves to length, not number, and breaks the
// scale() argument).
const INTRO_ANIMATION_CSS = `
.intro-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #111111;
  overflow: hidden;
}

.intro-stage .scaler {
  transform-origin: center center;
}

.intro-stage .composer {
  position: relative;
  display: flex;
  align-items: center;
  height: 360px;
}

.intro-stage .mark-wrap {
  position: relative;
  height: 360px;
  width: 360px;
  flex: 0 0 360px;
  z-index: 3;
  will-change: transform, opacity;
  transform-origin: center center;
  opacity: 0;
  /* Phase 1: expressive arrival (rises from below, scales up, rotates into place).
     Phase 2: subtle breathe right after, so the mark feels "alive" while it
     holds alone in centre before the wordmark reveal begins at 2.5s. */
  animation:
    introMarkEnter 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards,
    introMarkBreathe 1.6s ease-in-out 1.6s 1;
}
.intro-stage .mark-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.intro-stage .text-wrap {
  position: relative;
  height: 360px;
  display: flex;
  align-items: center;
  overflow: hidden;
  z-index: 2;
  will-change: width;
  width: 0;
  margin-left: 0;
  animation: introTextReveal 1.4s cubic-bezier(0.77, 0, 0.175, 1) 2.5s forwards;
}

.intro-stage .text-stack {
  position: relative;
  height: 100%;
  width: 820px;
  flex: 0 0 820px;
}
.intro-stage .text-stack img {
  position: absolute;
  left: 0;
  top: 50%;
  height: 78%;
  width: auto;
  display: block;
  will-change: transform, opacity;
}
.intro-stage .text-stack img.text-archlogic {
  transform: translate(-40px, -50%);
  opacity: 0;
  animation:
    introTextImgIn 1.6s cubic-bezier(0.22, 1, 0.36, 1) 2.6s forwards,
    introArchDropOut 0.7s cubic-bezier(0.55, 0.085, 0.68, 0.53) 5.3s forwards;
}
.intro-stage .text-stack img.text-buildtrack {
  /* Selector specificity must beat the base .text-stack img rule above. */
  height: 110%;
  transform: translate(0, calc(-50% - 420px));
  opacity: 0;
  animation: introBuildDropIn 0.95s cubic-bezier(0.34, 1.2, 0.5, 1) 5.75s forwards;
}

@keyframes introMarkEnter {
  0%   { opacity: 0; transform: translateY(180px) scale(0.55) rotate(-12deg); }
  25%  { opacity: 1; }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
}
@keyframes introMarkBreathe {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.015); }
  100% { transform: scale(1); }
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
   already settled. */
@media (prefers-reduced-motion: reduce) {
  .intro-stage .mark-wrap,
  .intro-stage .text-wrap,
  .intro-stage .text-archlogic,
  .intro-stage .text-buildtrack {
    animation: none !important;
  }
  .intro-stage .mark-wrap { opacity: 1; }
  .intro-stage .text-wrap { width: 820px; margin-left: 60px; }
  .intro-stage .text-archlogic { opacity: 0 !important; }
  .intro-stage .text-buildtrack { opacity: 1; transform: translate(0, -50%); }
}
`;
