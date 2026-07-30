import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spotlight } from './Spotlight';
import { SectionIntro } from './SectionIntro';
import { SECTION_TOUR_STEPS } from './sectionTourSteps';

/**
 * Per-section guided tour — the same spotlight the dashboard uses, for every
 * other section.
 *
 * Before this, sections got a slim non-blocking banner that described the
 * section in the abstract ("Proyectos — cada obra vive aquí"). Users asked for
 * what the dashboard does instead: point AT the thing on screen and say what
 * that specific number is and where it came from, one step at a time, with the
 * rest of the page blocked so there is one obvious thing to read.
 *
 * Anchors are `data-tour="sec.<section>.<key>"`. The namespace matters: the
 * sidebar nav items already own the bare section keys (`data-tour="users"`),
 * so an un-namespaced section anchor would make the dashboard tour highlight
 * the wrong element.
 *
 * Copy: `admin:sec.<section>.step.<key>.title|body`.
 *
 * FALLBACK: the banner survives for the cases a spotlight cannot serve —
 * mobile (where the dashboard tour is already suppressed: a dimmed hole on a
 * 375px screen hides the very thing it points at) and sections whose anchors
 * are all off-screen. Better a banner than nothing.
 */

// v1 — first release of per-section tours. Bump to re-show after a redesign.
const SEEN_VERSION = 'v1';

/** Anchor polling: ~4s total, enough for a lazy chunk plus a slow first fetch. */
const ANCHOR_POLL_MS = 250;
const MAX_ANCHOR_POLLS = 16;
const seenKey = (username: string | null, section: string) =>
  `bt.sectiontour.${SEEN_VERSION}.${username ?? 'anon'}.${section}`;

function markSeen(username: string | null, section: string) {
  try {
    localStorage.setItem(seenKey(username, section), new Date().toISOString());
  } catch {
    /* private mode — the tour just re-offers next visit */
  }
}

function hasSeen(username: string | null, section: string): boolean {
  try {
    return localStorage.getItem(seenKey(username, section)) !== null;
  } catch {
    return true; // can't persist "seen" → don't nag on every load
  }
}

/** Steps whose anchor exists AND is visible (display:none → offsetParent null). */
function visibleSteps(section: string): string[] {
  const keys = SECTION_TOUR_STEPS[section] ?? [];
  return keys.filter(key => {
    const el = document.querySelector<HTMLElement>(`[data-tour="sec.${section}.${key}"]`);
    return !!el && el.offsetParent !== null;
  });
}

/** Desktop-only, same breakpoint the dashboard tour uses. */
function canSpotlight(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(min-width: 768px)').matches;
}

export function SectionTour({
  section,
  username,
  replayNonce,
}: {
  section: string;
  username: string | null;
  /** Increment (with the section current) to replay on demand (topbar "?"). */
  replayNonce: number;
}) {
  const { t } = useTranslation(['admin']);
  const [steps, setSteps] = useState<string[] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  /** True once we've decided this section can't be toured → show the banner. */
  const [fellBack, setFellBack] = useState(false);

  const start = useCallback(
    (replay: boolean) => {
      if (!canSpotlight()) {
        setFellBack(true);
        return;
      }
      const found = visibleSteps(section);
      if (found.length === 0) {
        setFellBack(true);
        return;
      }
      if (!replay) markSeen(username, section);
      setSteps(found);
      setStepIdx(0);
      setFellBack(false);
    },
    [section, username],
  );

  // First visit to this section. Anchors do not exist on the first tick: most
  // sections are lazy-loaded behind Suspense AND several render their body only
  // after their first fetch resolves (the reports return null while loading).
  // So poll for anchors instead of betting on one fixed delay — a slow API
  // would otherwise silently downgrade the tour to the banner.
  useEffect(() => {
    setSteps(null);
    setFellBack(false);
    if (!SECTION_TOUR_STEPS[section]) return;
    if (hasSeen(username, section)) return;

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (visibleSteps(section).length > 0 || tries >= MAX_ANCHOR_POLLS) {
        clearInterval(timer);
        start(false);
      }
    }, ANCHOR_POLL_MS);
    return () => clearInterval(timer);
  }, [section, username, start]);

  // Topbar "?" replay for the section on screen.
  useEffect(() => {
    if (replayNonce > 0 && SECTION_TOUR_STEPS[section]) start(true);
    // `start` is stable per section; replaying must key off the nonce only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayNonce]);

  const close = useCallback(() => {
    markSeen(username, section);
    setSteps(null);
  }, [username, section]);

  // Banner fallback (mobile / no visible anchors). Passing the same nonce keeps
  // the "?" button working there too.
  if (fellBack || !SECTION_TOUR_STEPS[section]) {
    return <SectionIntro section={section} username={username} replayNonce={replayNonce} />;
  }

  if (!steps || steps.length === 0) return null;

  const key = steps[stepIdx];
  return (
    <Spotlight
      anchor={`sec.${section}.${key}`}
      title={t(`admin:sec.${section}.step.${key}.title`)}
      body={t(`admin:sec.${section}.step.${key}.body`)}
      index={stepIdx}
      total={steps.length}
      onBack={() => setStepIdx(i => Math.max(0, i - 1))}
      onNext={() => (stepIdx >= steps.length - 1 ? close() : setStepIdx(i => i + 1))}
      onSkip={close}
    />
  );
}
