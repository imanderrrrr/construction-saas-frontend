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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowRight, FileSpreadsheet, HardHat, LayoutDashboard,
  PenLine, Sparkles, TrendingUp, X, type LucideIcon,
} from 'lucide-react';

import { AuthService } from '../services/auth';
import { useFirstRunTurn } from '../lib/firstRunQueue';

export const WHATS_NEW_VERSION = '2026-08';

// Per-user, same shape as the onboarding tour's key (bt.onboarding.v2.<user>).
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

export function WhatsNewModal() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

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
    // Set scrollLeft directly. `scrollTo({behavior:'smooth'})` is silently
    // reverted to 0 by `scroll-snap-type: mandatory` in some engines, so the
    // arrows jump crisply while native swipe stays smooth (snap handles it).
    if (track) track.scrollLeft = clamped * track.clientWidth;
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

  // Keep the dot indicator in sync when the user swipes/scrolls the track.
  const onScroll = () => {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#F4F4F5] px-6 py-3.5">
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#F97316]">
            <Sparkles size={15} strokeWidth={2} />
            {t('whatsNew.badge')}
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('buttons.close')}
            className="rounded-md p-1 text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#0A0A0A]"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

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
                className="flex min-w-full shrink-0 snap-start flex-col items-center px-8 py-9 text-center"
              >
                <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-[#F97316]/10 text-[#F97316]">
                  <Icon size={30} strokeWidth={1.8} />
                </span>
                <h2 className="text-[19px] font-bold leading-snug text-[#0A0A0A]">
                  {t(`whatsNew.${s.key}.title`)}
                </h2>
                <p className="mt-2.5 max-w-[36ch] text-[14px] leading-relaxed text-[#71717A]">
                  {t(`whatsNew.${s.key}.body`)}
                </p>
              </section>
            );
          })}
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 pb-1 pt-1">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={t('whatsNew.dot', { num: i + 1 })}
              aria-current={i === index}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-5 bg-[#F97316]' : 'w-1.5 bg-[#E4E4E7] hover:bg-[#D4D4D8]'
              }`}
            />
          ))}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-3 border-t border-[#F4F4F5] px-5 py-3.5">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-[#71717A] transition-colors hover:bg-[#F4F4F5] disabled:pointer-events-none disabled:opacity-0"
          >
            <ArrowLeft size={15} strokeWidth={2.2} />
            {t('buttons.previous')}
          </button>

          <span className="font-mono text-[12px] text-[#A1A1AA]">{index + 1} / {SLIDES.length}</span>

          {isLast ? (
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#F97316] px-4 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-[#EA580C]"
            >
              {t('whatsNew.done')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#F97316] px-4 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-[#EA580C]"
            >
              {t('buttons.nextSimple')}
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
