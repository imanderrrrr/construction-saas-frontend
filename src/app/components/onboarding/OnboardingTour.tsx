import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Compass } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Spotlight } from './Spotlight';
import { useFirstRunTurn } from '../../lib/firstRunQueue';

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
 */

// v2 — re-anchored to the redesigned dashboard (money-first blocks + pulse +
// sidebar favorites). Bumping the version re-shows the tour once to users who
// saw v1: the screen they learned no longer exists.
const SEEN_VERSION = 'v2';
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
}: {
  username: string | null;
  /** Increment to re-open the welcome (topbar help button). 0 = untouched. */
  replayNonce: number;
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

  return (
    <>
      <WelcomeDialog
        open={stage === 'welcome'}
        onClose={finish}
        onStartTour={startTour}
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
}: {
  open: boolean;
  onClose: () => void;
  onStartTour: () => void;
}) {
  const { t } = useTranslation(['admin']);
  // Decide per-open whether the sidebar targets are actually visible (desktop).
  const [tourAvailable, setTourAvailable] = useState(false);
  useEffect(() => {
    if (open) setTourAvailable(availableSteps().length > 0);
  }, [open]);

  const quickSteps = [
    t('admin:tour.welcome.quick1'),
    t('admin:tour.welcome.quick2'),
    t('admin:tour.welcome.quick3'),
  ];

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md" data-first-run="onboardingTour">
        <DialogHeader>
          <div className="w-11 h-11 bg-[#F97316]/10 rounded-xl flex items-center justify-center mb-1">
            <Compass className="w-6 h-6 text-[#F97316]" />
          </div>
          <DialogTitle className="text-lg">{t('admin:tour.welcome.title')}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {t('admin:tour.welcome.body')}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-4">
          <p className="text-xs font-semibold text-[#0A0A0A] uppercase tracking-wide mb-3">
            {t('admin:tour.welcome.quickTitle')}
          </p>
          <ol className="space-y-2.5">
            {quickSteps.map((label, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#F97316] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-px">
                  {i + 1}
                </span>
                <span className="text-sm text-[#3F3F46] leading-snug">{label}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="sm:min-w-36">
            {t('admin:tour.welcome.skip')}
          </Button>
          {tourAvailable && (
            <Button
              onClick={onStartTour}
              className="bg-[#F97316] hover:bg-[#EA580C] text-white sm:min-w-36"
            >
              {t('admin:tour.welcome.start')}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
