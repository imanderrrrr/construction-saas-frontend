import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spotlight } from './Spotlight';
import { SectionIntro } from './SectionIntro';
import { SECTION_TOUR_STEPS } from './sectionTourSteps';
import { useFirstRunIdle } from '../../lib/firstRunQueue';

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
 * NOT IN THE FIRST-RUN ROW, BUT BEHIND IT: a section tour runs on every first
 * visit to a section (not once per user), so it has no place in
 * FIRST_RUN_ORDER. It still must not paint over a notice that does — the
 * welcome's quick steps jump straight into Proyectos / Usuarios, and the
 * what's-new carousel takes its turn right there. So the spotlight waits for
 * the row to be idle; the steps it already found are kept, not dropped.
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
  sectionLabel,
}: {
  section: string;
  username: string | null;
  /** Increment (with the section current) to replay on demand (topbar "?"). */
  replayNonce: number;
  /** The section's display title, for the banner's kicker. */
  sectionLabel?: string;
}) {
  const { t } = useTranslation(['admin']);
  const rowIdle = useFirstRunIdle();
  const [steps, setSteps] = useState<string[] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  /** True once we've decided this section can't be toured → show the banner. */
  const [fellBack, setFellBack] = useState(false);
  /** Replay signal forwarded to the banner fallback, scoped to the section on
      screen. The shared topbar nonce stays >0 for the rest of the session after
      the first "?", and the banner remounts on every fallback — forwarding the
      raw nonce resurrected banners the user had already dismissed on every
      section they visited (systematic on mobile, where every section falls
      back). This one only moves when a replay actually degrades to the banner,
      and resets when the section changes. */
  const [introNonce, setIntroNonce] = useState(0);

  const start = useCallback(
    (replay: boolean) => {
      // A replay that degrades to the banner must still open the banner.
      const fallBack = () => {
        setFellBack(true);
        if (replay) setIntroNonce(n => n + 1);
      };
      if (!canSpotlight()) {
        fallBack();
        return;
      }
      const found = visibleSteps(section);
      if (found.length === 0) {
        fallBack();
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
    setIntroNonce(0);
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
    if (replayNonce === 0) return;
    if (SECTION_TOUR_STEPS[section]) start(true);
    // A section with no authored steps only has the banner — replay re-shows it.
    else setIntroNonce(n => n + 1);
    // `start` is stable per section; replaying must key off the nonce only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayNonce]);

  const close = useCallback(() => {
    markSeen(username, section);
    setSteps(null);
  }, [username, section]);

  // Banner fallback (mobile / no visible anchors). The scoped nonce keeps the
  // "?" button working there without leaking replays across sections.
  if (fellBack || !SECTION_TOUR_STEPS[section]) {
    return <SectionIntro section={section} username={username} replayNonce={introNonce} sectionLabel={sectionLabel} />;
  }

  if (!steps || steps.length === 0) return null;
  // A first-run notice has the screen: hold the tour, keep the steps.
  if (!rowIdle) return null;

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
