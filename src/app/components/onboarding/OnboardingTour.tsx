import { useCallback, useEffect, useState } from 'react';
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

/**
 * First-login onboarding for the paying admin: a welcome dialog with the three
 * first steps, plus an optional spotlight tour over the sidebar sections.
 *
 * Shown once per user per browser (versioned localStorage key — bump the
 * version to re-show after a redesign). The topbar help button replays it via
 * `replayNonce`. Desktop-first: on mobile the sidebar is a closed drawer, so
 * the welcome shows without the tour option.
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

  // First visit: open the welcome after the dashboard has painted. Guarded by
  // matchMedia so jsdom (tests) and tiny viewports never auto-open.
  useEffect(() => {
    if (hasSeen(username)) return;
    if (typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(min-width: 768px)').matches) return;
    const timer = setTimeout(() => setStage('welcome'), 600);
    return () => clearTimeout(timer);
  }, [username]);

  // Help-button replay.
  useEffect(() => {
    if (replayNonce > 0) setStage('welcome');
  }, [replayNonce]);

  const close = useCallback(() => {
    markSeen(username);
    setStage('idle');
  }, [username]);

  const startTour = useCallback(() => {
    markSeen(username);
    const found = availableSteps();
    if (found.length === 0) {
      setStage('idle');
      return;
    }
    setSteps(found);
    setStepIdx(0);
    setStage('tour');
  }, [username]);

  return (
    <>
      <WelcomeDialog
        open={stage === 'welcome'}
        onClose={close}
        onStartTour={startTour}
      />
      {stage === 'tour' && steps.length > 0 && (
        <Spotlight
          anchor={steps[stepIdx]}
          title={t(`admin:tour.step.${steps[stepIdx]}.title`)}
          body={t(`admin:tour.step.${steps[stepIdx]}.body`)}
          index={stepIdx}
          total={steps.length}
          onBack={() => setStepIdx(i => Math.max(0, i - 1))}
          onNext={() =>
            stepIdx >= steps.length - 1
              ? setStage('idle')
              : setStepIdx(i => i + 1)
          }
          onSkip={() => setStage('idle')}
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
      <DialogContent className="sm:max-w-md">
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
