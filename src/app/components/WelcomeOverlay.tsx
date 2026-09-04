import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { cn } from './ui/utils';
import { inkGrid } from './onboarding/chrome';
import { useFirstRunTurn } from '../lib/firstRunQueue';
import { endWelcome, useWelcome } from '../lib/welcome';
import { isDashboardReady } from '../lib/dashboardReady';
import { PANEL_REV } from '../lib/panelRev';

/**
 * The welcome ceremony (Claude Design "Login BuildTrack" 02 / 02B) and its
 * quiet sibling, the splash (02C).
 *
 * What used to happen after "Iniciar sesión": the URL changed, the dashboard
 * route mounted, and two guards painted a white spinner with "Loading…" while
 * they verified the subscription and the password. Now the login page starts
 * the ceremony the instant the credentials are accepted and navigates in the
 * same breath; this overlay, mounted in App.tsx above the router, covers the
 * route change, the guards and the dashboard's first paint, and fades out
 * once the panel behind it says it is ready (`data-dashboard-ready`).
 *
 * Timing (the sheet's spec): background 300 ms, block 600 ms after 120 ms,
 * the square pulses every 1.1 s; the block reaches rest at ~720 ms and the
 * overlay stays at least 1.6 s past that, leaves as soon as the dashboard is
 * ready after that, and never later than 6 s; the exit is a 400 ms fade with
 * nothing moving. `prefers-reduced-motion`: no entrance, no blur, no pulse —
 * the screen appears and disappears at once; the hold is the same.
 *
 * In the first-run row it sits after the brand intro (which is opaque and
 * unskippable) and before the tour and what's new, so the greeting is what
 * the person sees first on every sign-in and the guidance waits its turn.
 */

const BG_IN_MS = 300;
const BLOCK_DELAY_MS = 120;
const BLOCK_IN_MS = 600;
/** The block is at rest. */
const SETTLED_MS = BLOCK_DELAY_MS + BLOCK_IN_MS;
/** Minimum time on screen after the block settles. */
const MIN_HOLD_MS = 1_600;
/** Longest the overlay may hold the screen, even if the dashboard never signals. */
const MAX_HOLD_MS = 6_000;
const FADE_OUT_MS = 400;
const READY_POLL_MS = 100;
export const WELCOME_MIN_MS = SETTLED_MS + MIN_HOLD_MS;
export const WELCOME_MAX_MS = MAX_HOLD_MS;
export const WELCOME_FADE_MS = FADE_OUT_MS;

const EASE = 'cubic-bezier(.2,.7,.2,1)';

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function WelcomeOverlay() {
  const welcome = useWelcome();
  const pending = welcome !== null;
  const myTurn = useFirstRunTurn('welcome', pending);
  const [fading, setFading] = useState(false);

  // The clock starts when the overlay actually gets the screen, not when the
  // login asked for it: behind the brand intro the ceremony waits, then plays
  // in full.
  useEffect(() => {
    if (!myTurn) return;
    setFading(false);
    const shownAt = performance.now();
    let poll: number | null = null;
    let fadeTimer: number | null = null;
    let endTimer: number | null = null;

    const leave = () => {
      if (poll != null) window.clearInterval(poll);
      setFading(true);
      endTimer = window.setTimeout(() => endWelcome(), reducedMotion() ? 0 : FADE_OUT_MS);
    };

    fadeTimer = window.setTimeout(() => {
      if (isDashboardReady()) { leave(); return; }
      const deadline = shownAt + MAX_HOLD_MS;
      poll = window.setInterval(() => {
        if (isDashboardReady() || performance.now() >= deadline) leave();
      }, READY_POLL_MS);
    }, WELCOME_MIN_MS);

    return () => {
      if (fadeTimer != null) window.clearTimeout(fadeTimer);
      if (poll != null) window.clearInterval(poll);
      if (endTimer != null) window.clearTimeout(endTimer);
    };
  }, [myTurn]);

  // Lock scroll while on screen (the overlay is opaque; nothing behind may move).
  useEffect(() => {
    if (!myTurn) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [myTurn]);

  if (!myTurn || !welcome) return null;

  return (
    <InkStage
      variant="welcome"
      fading={fading}
      name={welcome.name}
      company={welcome.company}
      data-first-run="welcome"
      testId="welcome-overlay"
    />
  );
}

/**
 * The splash — the same screen without the greeting. Replaces the white
 * "Loading…" of a reload with an open session (App.tsx) and the spinners of
 * BillingGuard / PasswordChangeGuard. No minimum hold: it goes as soon as the
 * caller stops rendering it.
 */
export function Splash({ className }: { className?: string }) {
  return <InkStage variant="splash" fading={false} name={null} company={null} className={className} testId="splash" />;
}

function InkStage({ variant, fading, name, company, className, testId, ...rest }: {
  variant: 'welcome' | 'splash';
  fading: boolean;
  name: string | null;
  company: string | null;
  className?: string;
  testId: string;
  'data-first-run'?: string;
}) {
  const { t, i18n } = useTranslation(['auth']);
  // Some suites mock react-i18next without an `i18n` object; the stamp is
  // decoration, so it must never be what breaks a guard.
  const lang = i18n?.language ?? 'es';
  const still = reducedMotion();
  const welcome = variant === 'welcome';
  const stamp = useMemo(() => {
    const locale = lang.startsWith('en') ? 'en-US' : 'es';
    const now = new Date();
    const date = now.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
    const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  }, [lang]);

  const bgStyle: CSSProperties = still
    ? {}
    : fading
      ? { opacity: 0, transition: `opacity ${FADE_OUT_MS}ms ${EASE}` }
      : { animation: `bt-welcome-bg ${BG_IN_MS}ms ${EASE} both` };
  const blockStyle: CSSProperties = still ? {} : { animation: `bt-welcome-block ${BLOCK_IN_MS}ms ${EASE} ${BLOCK_DELAY_MS}ms both` };

  return (
    <div
      role={welcome ? 'status' : undefined}
      aria-live={welcome ? 'polite' : undefined}
      data-testid={testId}
      data-fading={fading ? 'true' : 'false'}
      className={cn(
        'fixed inset-0 z-[120] bg-[#0A0A0A] text-[#F5F1E8] flex flex-col overflow-hidden',
        welcome ? 'min-h-screen' : 'min-h-screen',
        className,
      )}
      style={bgStyle}
      {...rest}
    >
      <style>{STAGE_CSS}</style>
      {/* Blueprint grid + the faint orange halo behind the centre */}
      <div className="absolute inset-0 pointer-events-none" style={inkGrid(26)} aria-hidden="true" />
      <div
        className="absolute pointer-events-none bt-welcome-halo"
        style={{
          left: '50%', top: '46%', width: 1180, height: 1180, transform: 'translate(-50%, -50%)',
          background: `radial-gradient(closest-side, rgba(249,115,22,${welcome ? 0.14 : 0.11}) 0%, rgba(249,115,22,0.05) 38%, rgba(249,115,22,0) 66%)`,
        }}
        aria-hidden="true"
      />

      {/* Centre block */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center" style={blockStyle}>
        {welcome && (
          <span className="font-bt-mono text-[9.5px] md:text-[11px] font-semibold uppercase tracking-[0.42em] text-[#EA580C]">
            {'  '}{t('auth:welcome.kicker')}{'  '}
          </span>
        )}
        <span
          className={cn('flex items-center justify-center bg-[#F97316] text-[#0A0A0A]', welcome ? 'w-[42px] h-[42px] md:w-14 md:h-14 mt-6' : 'w-[46px] h-[46px]')}
          aria-hidden="true"
        >
          <Building2 className={welcome ? 'w-5 h-5 md:w-7 md:h-7' : 'w-6 h-6'} strokeWidth={1.8} />
        </span>
        <h1
          className={cn(
            'font-bt-display font-extrabold uppercase leading-[0.86] tracking-[0.015em] text-[#F5F1E8] mt-[22px]',
            welcome ? 'text-[60px] md:text-[76px] lg:text-[96px] xl:text-[112px]' : 'text-[60px] md:text-[92px]',
          )}
        >
          BuildTrack
        </h1>
        {welcome ? (
          <>
            <span className="block w-[60px] md:w-[80px] h-[2px] mt-[30px]" style={{ background: 'rgba(249,115,22,0.55)' }} aria-hidden="true" />
            <p className="text-[18px] md:text-[20px] font-semibold text-[#F5F1E8] mt-[26px] max-w-[88%] [text-wrap:balance]">{name}</p>
            <Seal pulse={!still} className="mt-[34px]">
              {t('auth:welcome.entering')}{company ? ` · ${company}` : ''}
            </Seal>
          </>
        ) : (
          <Seal pulse={!still} className="mt-[34px]">{t('auth:welcome.loading')}</Seal>
        )}
      </div>

      {/* Foot — desktop welcome only */}
      {welcome && (
        <div className="relative hidden md:flex items-center justify-between px-8 pb-7 font-bt-mono text-[9.5px] uppercase tracking-[0.14em] text-[#8A8175]" style={blockStyle}>
          <span>{t('auth:welcome.rev', { rev: PANEL_REV })}</span>
          <span>{stamp}</span>
        </div>
      )}
    </div>
  );
}

function Seal({ pulse, className, children }: { pulse: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-[11px] max-w-[88%] [text-wrap:balance] font-bt-mono text-[9px] md:text-[10.5px] font-medium uppercase tracking-[0.18em] text-[#B4A992]', className)}>
      <span
        className="inline-block w-[7px] h-[7px] md:w-2 md:h-2 bg-[#F97316] flex-shrink-0"
        style={pulse ? { animation: 'bt-welcome-pulse 1.1s ease-in-out infinite' } : undefined}
        aria-hidden="true"
      />
      <span>{children}</span>
    </span>
  );
}

const STAGE_CSS = `
@keyframes bt-welcome-bg { from { opacity: 0; backdrop-filter: blur(0); } to { opacity: 1; backdrop-filter: blur(8px); } }
@keyframes bt-welcome-block { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes bt-welcome-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.82); } }
@media (max-width: 767px) { .bt-welcome-halo { width: 620px !important; height: 620px !important; } }
`;
