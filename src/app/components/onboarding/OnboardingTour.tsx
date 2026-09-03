import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight } from 'lucide-react';
import { Spotlight } from './Spotlight';
import {
  CloseButton, FOCUS_RING, InkBar, PrimaryButton, SecondaryButton, WINDOW_SHADOW,
} from './chrome';
import { useFirstRunTurn } from '../../lib/firstRunQueue';
import { getBranding } from '../../services/branding';
import { cn } from '../ui/utils';

/**
 * First-login onboarding for the paying admin: a welcome dialog with the three
 * first steps, plus an optional spotlight tour over the sidebar sections.
 *
 * Shown once per user per browser (versioned localStorage key — bump the
 * version to re-show after a redesign). The topbar help button replays it via
 * `replayNonce`. Desktop-first: on mobile the sidebar is a closed drawer, so
 * the welcome shows without the tour option.
 *
 * SECOND IN THE FIRST-RUN ROW (see lib/firstRunQueue), after the brand intro
 * and before the what's-new carousel: someone arriving for the first time has
 * to understand the system before being told what changed in it. The row is
 * handed on by `finish()` — which is why FINISHING and SKIPPING both go
 * through it, and why a mobile viewport never claims a turn at all (the tour
 * is suppressed below 768px and must not hold up the notices behind it).
 *
 * Look: the Claude Design sheet "Onboarding BuildTrack" (2026-09-03) — ink
 * header with the blueprint grid, display title, mono kicker, square controls.
 * The chrome is shared with the other guide windows in ./chrome.tsx.
 */

// v2 — re-anchored to the redesigned dashboard (money-first blocks + pulse +
// sidebar favorites). Bumping the version re-shows the tour once to users who
// saw v1: the screen they learned no longer exists.
// v3 — the 2026-09 restyle of the guide windows. Anderson wanted everyone to
// meet the new welcome once, so the key moved on although the screen being
// taught did not change. Keep e2e/support/mock-api.ts and firstRunOrder.test
// in step with this value.
const SEEN_VERSION = 'v3';
const seenKey = (username: string | null) =>
  `bt.onboarding.${SEEN_VERSION}.${username ?? 'anon'}`;

/**
 * Tour stops, in visit order. Each targets `[data-tour="<key>"]` and reads
 * `admin:tour.step.<key>.title|body`. A handful of representative stops beats
 * walking every block — the goal is orientation, not exhaustion.
 */
const STEP_KEYS = [
  'money',
  'today',
  'budget',
  'pulse',
  'favorites',
  'help',
] as const;

/**
 * The three quick steps of the welcome and the section each one opens. Copy
 * lives at `admin:tour.welcome.quickN`. The third step (hand over the QR
 * badge) happens in Usuarios too — the badge is printed from the user's card.
 */
const QUICK_STEPS = [
  { key: 'quick1', section: 'projects' },
  { key: 'quick2', section: 'users' },
  { key: 'quick3', section: 'users' },
] as const;

function markSeen(username: string | null) {
  try {
    localStorage.setItem(seenKey(username), new Date().toISOString());
  } catch {
    /* storage unavailable (private mode) — the tour just re-offers next visit */
  }
}

function hasSeen(username: string | null): boolean {
  try {
    return localStorage.getItem(seenKey(username)) !== null;
  } catch {
    return true; // can't persist "seen" → don't nag on every load
  }
}

/** Desktop only. jsdom (tests) and tiny viewports never auto-open the tour. */
function canAutoStart(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(min-width: 768px)').matches;
}

/** Let the dashboard paint before the welcome lands on top of it. */
const WELCOME_DELAY_MS = 600;

/** Steps whose target is present AND visible (display:none → offsetParent null). */
function availableSteps(): string[] {
  return STEP_KEYS.filter(key => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${key}"]`);
    return !!el && el.offsetParent !== null;
  });
}

export function OnboardingTour({
  username,
  replayNonce,
  onNavigate,
}: {
  username: string | null;
  /** Increment to re-open the welcome (topbar help button). 0 = untouched. */
  replayNonce: number;
  /** Opens a sidebar section. When set, the welcome's three quick steps are
   *  rows that jump straight to Proyectos / Usuarios; without it they are
   *  plain text (the row has nowhere to go). */
  onNavigate?: (section: string) => void;
}) {
  const { t } = useTranslation(['admin']);
  const [stage, setStage] = useState<'idle' | 'welcome' | 'tour'>('idle');
  const [steps, setSteps] = useState<string[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [handedOn, setHandedOn] = useState(false);

  // Our claim on the row: a first visit we have not given up yet, on a
  // viewport where the tour can actually run.
  const pending = useMemo(
    () => !handedOn && !hasSeen(username) && canAutoStart(),
    [handedOn, username],
  );
  const myTurn = useFirstRunTurn('onboardingTour', pending);

  // Our turn: open the welcome once the dashboard has painted.
  useEffect(() => {
    if (!myTurn) return;
    const timer = setTimeout(() => setStage('welcome'), WELCOME_DELAY_MS);
    return () => clearTimeout(timer);
  }, [myTurn]);

  // Help-button replay. User-initiated and off the row: the notices behind us
  // are unreachable while a first-run overlay is up, so a replay can only ever
  // happen once the row has already drained.
  useEffect(() => {
    if (replayNonce > 0) setStage('welcome');
  }, [replayNonce]);

  /** Done with the tour — finished, skipped or nothing to show. Marks it seen
   *  and hands the row to whoever is next, in this session, with no reload. */
  const finish = useCallback(() => {
    markSeen(username);
    setStage('idle');
    setHandedOn(true);
  }, [username]);

  const startTour = useCallback(() => {
    const found = availableSteps();
    if (found.length === 0) {
      finish();
      return;
    }
    markSeen(username);
    setSteps(found);
    setStepIdx(0);
    setStage('tour');
  }, [username, finish]);

  /** A quick step was clicked: the user chose to act instead of touring.
   *  Same exit as "explore on my own", then the section opens. */
  const goTo = useCallback((section: string) => {
    finish();
    onNavigate?.(section);
  }, [finish, onNavigate]);

  return (
    <>
      <WelcomeDialog
        open={stage === 'welcome'}
        onClose={finish}
        onStartTour={startTour}
        onNavigate={onNavigate ? goTo : undefined}
      />
      {stage === 'tour' && steps.length > 0 && (
        <Spotlight
          firstRunId="onboardingTour"
          anchor={steps[stepIdx]}
          title={t(`admin:tour.step.${steps[stepIdx]}.title`)}
          body={t(`admin:tour.step.${steps[stepIdx]}.body`)}
          index={stepIdx}
          total={steps.length}
          onBack={() => setStepIdx(i => Math.max(0, i - 1))}
          onNext={() =>
            stepIdx >= steps.length - 1 ? finish() : setStepIdx(i => i + 1)
          }
          onSkip={finish}
        />
      )}
    </>
  );
}

function WelcomeDialog({
  open,
  onClose,
  onStartTour,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onStartTour: () => void;
  onNavigate?: (section: string) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  // Decide per-open whether a tour can be offered: desktop width AND the
  // dashboard targets on screen. Phones get the single-action variant — a
  // dimmed hole on a 375px screen hides the very thing it points at, which is
  // why the section tours are desktop-only too.
  const [tourAvailable, setTourAvailable] = useState(false);
  useEffect(() => {
    if (open) setTourAvailable(canAutoStart() && availableSteps().length > 0);
  }, [open]);

  // Company name for the kicker (white-label, same as the dashboard header).
  // Decorative: a failure just leaves the generic kicker.
  const [orgName, setOrgName] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    try {
      getBranding().then(b => setOrgName(b.organizationName)).catch(() => {});
    } catch {
      /* no client available — the kicker stays generic */
    }
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(11,10,9,0.40)]" />
        <DialogPrimitive.Content
          data-first-run="onboardingTour"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 outline-none"
        >
          <div className={cn('bt-modal-in bg-white', WINDOW_SHADOW)}>
            {/* Ink header: kicker + display title + square close */}
            <InkBar className="px-4 pt-4 pb-5 sm:px-[22px] sm:pt-5 sm:pb-6">
              <div className="relative flex items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="font-bt-mono text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F97316] leading-relaxed sm:leading-normal">
                    {t('admin:dash.kicker')}
                    {orgName && (
                      <>
                        <span className="hidden sm:inline"> · </span>
                        <br className="sm:hidden" />
                        {orgName}
                      </>
                    )}
                  </p>
                  <DialogPrimitive.Title className="font-bt-display font-extrabold uppercase text-[28px] sm:text-[36px] leading-none tracking-[0.01em] text-[#F5F1E8] mt-2 sm:mt-2.5">
                    {t('admin:tour.welcome.title')}
                  </DialogPrimitive.Title>
                </div>
                <DialogPrimitive.Close asChild>
                  <CloseButton onDark aria-label={t('common:buttons.close')} className="w-8 h-8 sm:w-7 sm:h-7" />
                </DialogPrimitive.Close>
              </div>
            </InkBar>

            {/* Body: intro + the three quick steps */}
            <div className="px-4 pt-[18px] pb-1 sm:px-[22px] sm:pt-[22px] sm:pb-1.5">
              <DialogPrimitive.Description className="text-sm leading-[1.6] text-[#5A5346] max-w-[430px]">
                {t('admin:tour.welcome.body')}
              </DialogPrimitive.Description>

              <p className="flex items-center gap-2 mt-[18px] mb-0.5 sm:mt-[22px] sm:mb-1">
                <span className="w-2 h-2 bg-[#F97316] flex-shrink-0" aria-hidden="true" />
                <span className="font-bt-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5A5346]">
                  {t('admin:tour.welcome.quickTitle')}
                </span>
              </p>

              <ol>
                {QUICK_STEPS.map((step, i) => {
                  const rowClass = cn(
                    'w-full flex items-start gap-3 text-left border-t border-[#EDE7DB] py-[13px] px-1 sm:gap-[13px] sm:px-2.5',
                    i === QUICK_STEPS.length - 1 && 'border-b',
                  );
                  const inner = (
                    <>
                      <span className="w-5 h-5 flex-shrink-0 bg-[#F97316] text-[#0A0A0A] font-bt-mono text-[11px] font-semibold flex items-center justify-center mt-px">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm leading-normal text-[#2E2A24]">
                        {t(`admin:tour.welcome.${step.key}`)}
                      </span>
                      {onNavigate && (
                        <span className="hidden sm:block font-bt-mono text-[11px] text-[#B4A992] group-hover:text-[#C2410C] mt-[3px]" aria-hidden="true">
                          →
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={step.key}>
                      {onNavigate ? (
                        <button
                          type="button"
                          onClick={() => onNavigate(step.section)}
                          className={cn(
                            rowClass,
                            'group border-l-2 border-l-transparent hover:border-l-[#F97316] hover:bg-[#F3EEE4] transition-colors',
                            FOCUS_RING,
                          )}
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className={rowClass}>{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Paper footer with the actions. Without a tour to offer, the
                only action is the primary one. */}
            <div className="bg-[#FAF7F0] border-t border-[#EDE7DB] mt-4 px-4 py-3.5 sm:mt-5 sm:px-[22px] sm:py-4 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
              {tourAvailable ? (
                <>
                  <SecondaryButton onClick={onClose} className="w-full sm:w-auto py-3.5 sm:py-2.5">
                    {t('admin:tour.welcome.skip')}
                  </SecondaryButton>
                  <PrimaryButton onClick={onStartTour} className="w-full sm:w-auto py-3.5 sm:py-2.5">
                    {t('admin:tour.welcome.start')}
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </PrimaryButton>
                </>
              ) : (
                <PrimaryButton onClick={onClose} className="w-full sm:w-auto py-3.5 sm:py-2.5">
                  {t('admin:tour.welcome.skip')}
                </PrimaryButton>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
