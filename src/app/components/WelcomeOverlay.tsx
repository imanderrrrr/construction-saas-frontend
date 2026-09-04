import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { cn } from './ui/utils';
import { inkGrid } from './onboarding/chrome';
import { useFirstRunTurn } from '../lib/firstRunQueue';
import { endWelcome, useWelcome } from '../lib/welcome';
import { isDashboardReady, isSplashActive, useMarkSplashActive } from '../lib/dashboardReady';
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
 * ONE screen, two states. The splash and the welcome are the same stage with
 * the same geometry — icon, wordmark, seal and foot at the same pixels — and
 * the welcome only adds the greeting (kicker, rule, name) around them. That
 * is what keeps the hand-over invisible in both directions: a welcome that
 * opens over a splash does not replay the entrance, the greeting just
 * arrives; a welcome that fades reveals the same wordmark underneath. The
 * first release had two layouts (a smaller splash without the kicker) and a
 * 6 s cap, so a slow backend produced a visible jump between them.
 *
 * Timing (the sheet's spec): background 300 ms, block 600 ms after 120 ms,
 * the square pulses every 1.1 s; the block reaches rest at ~720 ms and the
 * overlay stays at least 1.6 s past that. After that it leaves as soon as the
 * route behind it has settled — the panel painted, or nothing is loading any
 * more — and while a splash is still loading behind it, it holds (up to a
 * generous cap, so a backend that never answers cannot pin the screen). The
 * exit is a 400 ms fade with nothing moving. `prefers-reduced-motion`: no
 * entrance, no blur, no pulse — the screen appears and disappears at once;
 * the hold is the same.
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
/** Longest the overlay may hold the screen while something behind it still loads. */
const MAX_HOLD_MS = 20_000;
const FADE_OUT_MS = 400;
const READY_POLL_MS = 100;
const GREET_IN_MS = 500;
export const WELCOME_MIN_MS = SETTLED_MS + MIN_HOLD_MS;
export const WELCOME_MAX_MS = MAX_HOLD_MS;
export const WELCOME_FADE_MS = FADE_OUT_MS;

const EASE = 'cubic-bezier(.2,.7,.2,1)';

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The route behind the welcome is done moving: the panel painted, or nothing is loading. */
function routeSettled(): boolean {
  return isDashboardReady() || !isSplashActive();
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
      if (routeSettled()) { leave(); return; }
      const deadline = shownAt + MAX_HOLD_MS;
      poll = window.setInterval(() => {
        if (routeSettled() || performance.now() >= deadline) leave();
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
 * The splash — the same stage without the greeting. Replaces the white
 * "Loading…" of a reload with an open session (App.tsx) and the spinners of
 * BillingGuard / PasswordChangeGuard. No minimum hold: it goes as soon as the
 * caller stops rendering it. While mounted it tells the welcome that
 * something behind is still loading (`data-splash-active`).
 */
export function Splash({ className }: { className?: string }) {
  useMarkSplashActive();
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
  // A welcome opening over a splash already on screen: same wordmark at the
  // same place, so the block must not replay its entrance — only the greeting
  // arrives. Decided once, at mount.
  const [overSplash] = useState(() => welcome && isSplashActive());
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
  const blockStyle: CSSProperties = still || overSplash ? {} : { animation: `bt-welcome-block ${BLOCK_IN_MS}ms ${EASE} ${BLOCK_DELAY_MS}ms both` };
  // The greeting's own arrival, staggered. Over a splash it is the whole
  // transition; otherwise it rides on top of the block's entrance.
  const greet = (delay: number): CSSProperties | undefined =>
    welcome && !still ? { animation: `bt-welcome-greet ${GREET_IN_MS}ms ${EASE} ${(overSplash ? 0 : BLOCK_DELAY_MS) + delay}ms both` } : undefined;
  // The splash keeps the greeting's slots so the wordmark and the seal sit at
  // the same pixels in both states.
  const slot = (cls: string) => cn(cls, !welcome && 'invisible');

  return (
    <div
      role={welcome ? 'status' : undefined}
      aria-live={welcome ? 'polite' : undefined}
      data-testid={testId}
      data-fading={fading ? 'true' : 'false'}
      data-over-splash={overSplash ? 'true' : undefined}
      className={cn(
        'fixed inset-0 min-h-screen bg-[#0A0A0A] text-[#F5F1E8] flex flex-col overflow-hidden',
        // The welcome sits ABOVE the splash: both are fixed and opaque, and the
        // guards' splash mounts later in the DOM (inside the router), so with
        // one z-index it would paint over the greeting until the guard answers.
        welcome ? 'z-[130]' : 'z-[120]',
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
          background: 'radial-gradient(closest-side, rgba(249,115,22,0.13) 0%, rgba(249,115,22,0.05) 38%, rgba(249,115,22,0) 66%)',
        }}
        aria-hidden="true"
      />

      {/* Centre block — identical geometry in both states */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center" style={blockStyle}>
        <span
          className={slot('font-bt-mono text-[9.5px] md:text-[11px] font-semibold uppercase tracking-[0.42em] text-[#EA580C]')}
          style={greet(0)}
          aria-hidden={welcome ? undefined : 'true'}
        >
          {'  '}{t('auth:welcome.kicker')}{'  '}
        </span>
        <span
          className="flex items-center justify-center bg-[#F97316] text-[#0A0A0A] w-[42px] h-[42px] md:w-14 md:h-14 mt-6"
          aria-hidden="true"
        >
          <Building2 className="w-5 h-5 md:w-7 md:h-7" strokeWidth={1.8} />
        </span>
        <h1 className="font-bt-display font-extrabold uppercase leading-[0.86] tracking-[0.015em] text-[#F5F1E8] mt-[22px] text-[60px] md:text-[76px] lg:text-[96px] xl:text-[112px]">
          BuildTrack
        </h1>
        <span
          className={slot('block w-[60px] md:w-[80px] h-[2px] mt-[30px]')}
          style={{ background: 'rgba(249,115,22,0.55)', ...greet(120) }}
          aria-hidden="true"
        />
        <p
          className={slot('text-[18px] md:text-[20px] font-semibold text-[#F5F1E8] mt-[26px] max-w-[88%] [text-wrap:balance]')}
          style={greet(200)}
          aria-hidden={welcome ? undefined : 'true'}
        >
          {welcome ? name : ' '}
        </p>
        <Seal pulse={!still} className="mt-[34px]" style={greet(300)}>
          {welcome ? `${t('auth:welcome.entering')}${company ? ` · ${company}` : ''}` : t('auth:welcome.loading')}
        </Seal>
      </div>

      {/* Foot — desktop only, both states */}
      <div className="relative hidden md:flex items-center justify-between px-8 pb-7 font-bt-mono text-[9.5px] uppercase tracking-[0.14em] text-[#8A8175]" style={blockStyle}>
        <span>{t('auth:welcome.rev', { rev: PANEL_REV })}</span>
        <span>{stamp}</span>
      </div>
    </div>
  );
}

function Seal({ pulse, className, style, children }: { pulse: boolean; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <span
      className={cn('inline-flex items-center gap-[11px] max-w-[88%] [text-wrap:balance] font-bt-mono text-[9px] md:text-[10.5px] font-medium uppercase tracking-[0.18em] text-[#B4A992]', className)}
      style={style}
    >
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
@keyframes bt-welcome-greet { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes bt-welcome-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.82); } }
@media (max-width: 767px) { .bt-welcome-halo { width: 620px !important; height: 620px !important; } }
`;
