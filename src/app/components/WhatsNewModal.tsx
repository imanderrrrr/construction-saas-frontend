// BuildTrack — "Novedades" (what's new) modal: shown once, the first time a
// user in the audience opens the app after this release. Content is a
// horizontal, swipeable carousel: one card per capability shipped in the
// round, written in client language (copy lives in common.json, whatsNew.*).
//
// Shown once per version PER USER: BuildTrack is multi-tenant and several
// users from different companies can share one browser, so the seen-flag key
// carries the username — user A dismissing must not hide the news from user B.
// Bump WHATS_NEW_VERSION on a future release to show a fresh set of cards to
// everyone again; the flag's value is the version it was dismissed at.
//
// Mounted in routes.tsx INSIDE BillingGuard (which itself renders inside
// ProtectedRoute → PasswordChangeGuard), as a sibling of the page. Both
// guards render their children only once they are satisfied, so this modal
// can never paint over the forced-password-change screen or the billing wall.
// Keep it there — never mount it as a sibling of a guard.
//
// LAST IN THE FIRST-RUN ROW (see lib/firstRunQueue): a user meeting BuildTrack
// for the first time needs the guided tour before being told what changed, so
// this waits for the intro and the tour to hand the row over. Waiting is not
// losing it — the turn arrives in the same session, no reload.
//
// Look (Claude Design "Onboarding BuildTrack", 2026-09): ink header with the
// release stamp, orange icon square, display title, paper footer with the
// segment strip and a "01 / 06" counter. Chrome shared in onboarding/chrome.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowRight, FileSpreadsheet, HardHat, LayoutDashboard,
  PenLine, Sparkles, TrendingUp, type LucideIcon,
} from 'lucide-react';

import { AuthService } from '../services/auth';
import { useFirstRunTurn } from '../lib/firstRunQueue';
import {
  CloseButton, InkBar, PrimaryButton, SecondaryButton, Segments, WINDOW_SHADOW,
} from './onboarding/chrome';
import { cn } from './ui/utils';

export const WHATS_NEW_VERSION = '2026-08';

// Per-user, same shape as the onboarding tour's key (bt.onboarding.v3.<user>).
// Also seeded by the e2e harness (e2e/support/mock-api.ts) — keep in sync.
const seenKey = (username: string) => `bt.whatsnew.${username}`;

// Roles this round actually touches: T&M capture happens on site (SUPERVISOR)
// and converts in the office (ADMIN/FINANCE); signatures, payroll export and
// the budget changes are office/money features (ADMIN/FINANCE). Nothing in
// the round changes what WORKER or WAREHOUSE do, and SUBCONTRACTOR has no web
// workspace — no point interrupting them.
const AUDIENCE = new Set(['ADMIN', 'SUPERVISOR', 'FINANCE']);

interface Slide {
  icon: LucideIcon;
  /** i18n prefix: whatsNew.<key>.title / whatsNew.<key>.body in common.json */
  key: string;
}

const SLIDES: Slide[] = [
  { icon: Sparkles,        key: 'intro' },
  { icon: HardHat,         key: 'tm' },
  { icon: PenLine,         key: 'sign' },
  { icon: FileSpreadsheet, key: 'payroll' },
  { icon: TrendingUp,      key: 'budget' },
  { icon: LayoutDashboard, key: 'look' },
];

/** Slide motion: the rail glides 300 ms between cards (instant under reduced motion). */
const SLIDE_MS = 300;

// Authenticated, in-audience, and unseen BY THIS USER. A missing username
// means we cannot remember the dismissal per user, so we stay quiet rather
// than nag on every load.
function hasNewsForThisUser(): boolean {
  if (!AuthService.isAuthenticated()) return false;
  const role = AuthService.getRole();
  if (!role || !AUDIENCE.has(role)) return false;
  const username = AuthService.getUsername();
  if (!username) return false;
  let seen: boolean;
  try {
    seen = localStorage.getItem(seenKey(username)) === WHATS_NEW_VERSION;
  } catch {
    seen = false; // private mode / no storage → show once, don't crash
  }
  return !seen;
}

/** "2026-08" → "08.2026", the stamp style the dashboard uses ("Rev 07.2026"). */
function revStamp(version: string): string {
  const [year, month] = version.split('-');
  return month && year ? `${month}.${year}` : version;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function WhatsNewModal() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const tweenRef = useRef<number | null>(null);

  // Decided once, at mount, and re-read only when the user dismisses. The
  // queue — not this component — decides WHEN that pending news is shown.
  const pending = useMemo(() => !dismissed && hasNewsForThisUser(), [dismissed]);
  const open = useFirstRunTurn('whatsNew', pending);

  const dismiss = useCallback(() => {
    const username = AuthService.getUsername();
    try {
      if (username) localStorage.setItem(seenKey(username), WHATS_NEW_VERSION);
    } catch {
      /* storage unavailable — the modal simply may show again next load */
    }
    setDismissed(true);
  }, []);

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
    setIndex(clamped);
    const track = trackRef.current;
    if (!track) return;
    // Drive scrollLeft ourselves, frame by frame. `scrollTo({behavior:
    // 'smooth'})` is silently reverted to 0 by `scroll-snap-type: mandatory`
    // in some engines; a tween that lands exactly on the snap point never
    // fights it, and native swipe still snaps on its own.
    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current);
    tweenRef.current = null;
    const to = clamped * track.clientWidth;
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function' || !track.clientWidth) {
      track.scrollLeft = to;
      return;
    }
    const from = track.scrollLeft;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / SLIDE_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      track.scrollLeft = from + (to - from) * eased;
      tweenRef.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    tweenRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => {
    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current);
  }, []);

  // Escape closes; arrow keys page through while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, dismiss, go]);

  // Keep the counter in sync when the user swipes/scrolls the track. Ignored
  // while a tween is driving the rail, or the counter would tick through
  // every card in between.
  const onScroll = () => {
    if (tweenRef.current !== null) return;
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index) setIndex(Math.max(0, Math.min(SLIDES.length - 1, i)));
  };

  if (!open) return null;

  const isLast = index === SLIDES.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('whatsNew.dialogLabel')}
      data-first-run="whatsNew"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,10,9,0.40)] p-4"
      onClick={dismiss}
    >
      <div
        className={cn('bt-modal-in w-full max-w-[448px] bg-white overflow-hidden', WINDOW_SHADOW)}
        onClick={e => e.stopPropagation()}
      >
        {/* Ink header: stamp + close */}
        <InkBar className="pl-4 pr-3 py-[11px] sm:pl-[18px] sm:pr-3.5 sm:py-3">
          <header className="relative flex items-center justify-between gap-2.5 sm:gap-3">
            <span className="flex items-center gap-2 sm:gap-[9px] font-bt-mono text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(245,241,232,0.82)]">
              <span className="w-2 h-2 bg-[#F97316] flex-shrink-0" aria-hidden="true" />
              <span>
                {t('whatsNew.badge')}
                <span className="hidden sm:inline"> · {t('whatsNew.revStamp', { rev: revStamp(WHATS_NEW_VERSION) })}</span>
              </span>
            </span>
            <CloseButton onDark onClick={dismiss} aria-label={t('buttons.close')} className="w-8 h-8 sm:w-7 sm:h-7" />
          </header>
        </InkBar>

        {/* Carousel track — horizontal scroll + native snap */}
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SLIDES.map((s, i) => {
            const Icon = s.icon;
            return (
              <section
                key={s.key}
                aria-hidden={i !== index}
                // `w-full` is load-bearing: a shrink-0 flex item with no width takes its
                // max-content width, and a long body would stretch the card sideways.
                className="flex w-full min-w-full shrink-0 snap-start flex-col px-4 pt-5 pb-[18px] min-h-[210px] sm:px-[22px] sm:pt-6 sm:pb-[22px] sm:min-h-[238px]"
              >
                <span className="flex w-10 h-10 sm:w-11 sm:h-11 items-center justify-center bg-[#F97316] text-[#0A0A0A]" aria-hidden="true">
                  <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px]" strokeWidth={1.9} />
                </span>
                <h2 className="font-bt-display font-extrabold uppercase text-[28px] sm:text-[32px] leading-none tracking-[0.01em] text-[#0A0A0A] mt-4 sm:mt-[18px]">
                  {t(`whatsNew.${s.key}.title`)}
                </h2>
                <p className="text-sm leading-[1.6] text-[#5A5346] mt-2.5">
                  {t(`whatsNew.${s.key}.body`)}
                </p>
              </section>
            );
          })}
        </div>

        {/* Paper footer: previous · segments + counter · next */}
        <div className="bg-[#FAF7F0] border-t border-[#EDE7DB] px-3.5 py-3 sm:px-4 flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5">
            {/* Kept in the layout (invisible) on the first card so the
                counter and the next button never shift. */}
            <SecondaryButton
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className={cn('text-[10px] px-3 py-[13px] sm:py-[9px] gap-1.5', index === 0 && 'invisible')}
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">{t('buttons.previous')}</span>
            </SecondaryButton>
            <span className="sm:hidden font-bt-mono text-[10px] font-medium tracking-[0.12em] text-[#8A8175]">
              {pad2(index + 1)} / {pad2(SLIDES.length)}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-[11px]">
            <Segments
              total={SLIDES.length}
              index={index}
              width={12}
              onPick={go}
              labelFor={i => t('whatsNew.dot', { num: i + 1 })}
            />
            <span className="font-bt-mono text-[10px] font-medium tracking-[0.12em] text-[#8A8175]">
              {pad2(index + 1)} / {pad2(SLIDES.length)}
            </span>
          </div>

          {isLast ? (
            <PrimaryButton onClick={dismiss} className="text-[10px] sm:text-[10px] px-4 py-[13px] sm:px-[13px] sm:py-[9px]">
              {t('whatsNew.done')}
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => go(index + 1)} className="text-[10px] px-4 py-[13px] sm:px-[13px] sm:py-[9px] gap-[7px]">
              {t('buttons.nextSimple')}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
