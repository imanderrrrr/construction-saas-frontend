import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';

/**
 * First-login onboarding for the paying admin: a welcome dialog with the three
 * first steps, plus an optional spotlight tour over the sidebar sections.
 *
 * Shown once per user per browser (versioned localStorage key — bump the
 * version to re-show after a redesign). The topbar help button replays it via
 * `replayNonce`. Desktop-first: on mobile the sidebar is a closed drawer, so
 * the welcome shows without the tour option.
 */

const SEEN_VERSION = 'v1';
const seenKey = (username: string | null) =>
  `bt.onboarding.${SEEN_VERSION}.${username ?? 'anon'}`;

/**
 * Tour stops, in visit order. Each targets `[data-tour="<key>"]` and reads
 * `admin:tour.step.<key>.title|body`. A handful of representative stops beats
 * walking all ~23 nav items — the goal is orientation, not exhaustion.
 */
const STEP_KEYS = [
  'dashboard',
  'users',
  'time-approvals',
  'projects',
  'invoices',
  'audit',
  'billing',
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
          stepKey={steps[stepIdx]}
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

/**
 * Spotlight step: dims the page with a box-shadow "hole" around the target and
 * shows an explanation card beside it. Re-measures on resize and any scroll
 * (capture phase — the sidebar nav scrolls internally).
 */
function Spotlight({
  stepKey,
  index,
  total,
  onBack,
  onNext,
  onSkip,
}: {
  stepKey: string;
  index: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation(['admin']);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const scrolledFor = useRef<string | null>(null);

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${stepKey}"]`);
    if (!el || el.offsetParent === null) {
      setRect(null);
      return;
    }
    if (scrolledFor.current !== stepKey) {
      scrolledFor.current = stepKey;
      el.scrollIntoView({ block: 'nearest' });
    }
    setRect(el.getBoundingClientRect());
  }, [stepKey]);

  useLayoutEffect(() => {
    measure();
    let raf = 0;
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      if (e.key === 'ArrowRight' || e.key === 'Right' || e.key === 'Enter') onNext();
      if (e.key === 'ArrowLeft' || e.key === 'Left') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSkip, onNext, onBack]);

  const pad = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const hl = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Card placement: beside the highlight (right → below → above), else centered.
  const cardW = Math.min(330, vw - 32);
  let cardStyle: React.CSSProperties;
  if (hl && hl.left + hl.width + 16 + cardW <= vw) {
    cardStyle = {
      left: hl.left + hl.width + 14,
      top: Math.min(Math.max(hl.top, 16), Math.max(16, vh - 250)),
    };
  } else if (hl && hl.top + hl.height + 16 + 220 <= vh) {
    cardStyle = {
      left: Math.min(Math.max(hl.left, 16), Math.max(16, vw - cardW - 16)),
      top: hl.top + hl.height + 14,
    };
  } else if (hl) {
    cardStyle = {
      left: Math.min(Math.max(hl.left, 16), Math.max(16, vw - cardW - 16)),
      bottom: vh - hl.top + 14,
    };
  } else {
    cardStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }

  const isLast = index >= total - 1;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      {/* Click shield: keeps the page inert while touring. Deliberately does
          NOT exit — a stray click must not kill the tour; exits are the
          explicit "skip" link and Escape. */}
      <div className="absolute inset-0" />
      {/* Dimmer + highlight ring (the huge shadow darkens everything else). */}
      {hl ? (
        <div
          className="fixed rounded-lg ring-2 ring-[#F97316] transition-all duration-300 ease-out pointer-events-none"
          style={{
            ...hl,
            boxShadow: '0 0 0 9999px rgba(10, 10, 10, 0.55)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[#0A0A0A]/55 pointer-events-none" />
      )}

      {/* Explanation card */}
      <div
        className="fixed bg-white rounded-xl shadow-2xl border border-[#E4E4E7] p-4"
        style={{ ...cardStyle, width: cardW }}
      >
        <p className="text-[11px] font-semibold text-[#F97316] uppercase tracking-wide mb-1">
          {t('admin:tour.stepOf', { current: index + 1, total })}
        </p>
        <h3 className="text-sm font-semibold text-[#0A0A0A] mb-1.5">
          {t(`admin:tour.step.${stepKey}.title`)}
        </h3>
        <p className="text-sm text-[#52525B] leading-relaxed mb-4">
          {t(`admin:tour.step.${stepKey}.body`)}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-xs text-[#71717A] hover:text-[#0A0A0A] transition-colors"
          >
            {t('admin:tour.skip')}
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={onBack} className="h-8 px-3">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                {t('admin:tour.back')}
              </Button>
            )}
            <Button
              size="sm"
              onClick={onNext}
              className="h-8 px-3 bg-[#F97316] hover:bg-[#EA580C] text-white"
            >
              {isLast ? (
                <>
                  {t('admin:tour.done')}
                  <Check className="w-3.5 h-3.5 ml-1" />
                </>
              ) : (
                <>
                  {t('admin:tour.next')}
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
