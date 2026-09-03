import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import {
  InkBar, PrimaryButton, SecondaryButton, Segments, TertiaryButton, WINDOW_SHADOW,
} from './chrome';
import { cn } from '../ui/utils';

/**
 * One spotlight step: dims the page with a box-shadow "hole" around the target
 * and shows an explanation card beside it. Re-measures on resize and any scroll
 * (capture phase — the sidebar nav and section tables scroll internally).
 *
 * Extracted from OnboardingTour so the dashboard welcome tour and the
 * per-section tours share ONE implementation: the blocking behaviour, the
 * keyboard handling and the card placement are exactly the same everywhere,
 * which is the whole point (a tour that behaves differently per screen is
 * worse than no tour).
 *
 * Copy is resolved by the CALLER and passed in as plain strings — this
 * component stays dumb about namespaces so both callers can key their copy
 * however suits them.
 *
 * Look (Claude Design "Onboarding BuildTrack", 2026-09): a 330 px card with an
 * ink bar (counter + segment strip), display title, and a 3 px orange edge on
 * the side that faces the highlighted element. The ring is square, 2 px
 * orange, 6 px off the element, with 18 px between ring and card.
 */

/** Gap between the highlight ring and the card. */
const GAP = 18;
/** Ring margin around the element. */
const PAD = 6;
/** Card height budget for the below / above checks (the real card is ~230). */
const CARD_H = 240;

export function Spotlight({
  anchor,
  title,
  body,
  index,
  total,
  onBack,
  onNext,
  onSkip,
  firstRunId,
}: {
  /** `data-tour` value of the element to highlight. */
  anchor: string;
  title: string;
  body: string;
  index: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  /** Set when this spotlight is one of the first-run notices queued in
   *  lib/firstRunQueue (the dashboard tour). Section tours run outside the
   *  row and leave it unset. */
  firstRunId?: string;
}) {
  const { t } = useTranslation(['admin']);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const scrolledFor = useRef<string | null>(null);

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
    if (!el || el.offsetParent === null) {
      setRect(null);
      return;
    }
    if (scrolledFor.current !== anchor) {
      scrolledFor.current = anchor;
      el.scrollIntoView({ block: 'nearest' });
    }
    setRect(el.getBoundingClientRect());
  }, [anchor]);

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

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const hl = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // Card placement: beside the highlight (right → below → above), else
  // centered. Below / above, the card starts at the element's left edge; when
  // that runs off the viewport it ends at the element's right edge instead
  // (the "?" button at the top-right corner is the case that needs this).
  const cardW = Math.min(330, vw - 32);
  const alignX = (h: NonNullable<typeof hl>) =>
    h.left + cardW <= vw - 16 ? Math.max(16, h.left) : Math.max(16, h.left + h.width - cardW);

  let cardStyle: React.CSSProperties;
  /** Which edge of the card faces the element — that edge carries the accent. */
  let facing: 'left' | 'top' | 'bottom';
  if (hl && hl.left + hl.width + GAP + cardW <= vw) {
    facing = 'left';
    cardStyle = {
      left: hl.left + hl.width + GAP,
      top: Math.min(Math.max(hl.top, 16), Math.max(16, vh - CARD_H - 16)),
    };
  } else if (hl && hl.top + hl.height + GAP + CARD_H <= vh) {
    facing = 'top';
    cardStyle = { left: alignX(hl), top: hl.top + hl.height + GAP };
  } else if (hl) {
    facing = 'bottom';
    cardStyle = { left: alignX(hl), bottom: vh - hl.top + GAP };
  } else {
    facing = 'top';
    cardStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }

  const isLast = index >= total - 1;

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      data-first-run={firstRunId}
    >
      {/* Click shield: keeps the page inert while touring. Deliberately does
          NOT exit — a stray click must not kill the tour; exits are the
          explicit "skip" link and Escape. */}
      <div className="absolute inset-0" />
      {/* Dimmer + highlight ring (the huge shadow darkens everything else). */}
      {hl ? (
        <div
          className="fixed outline-2 -outline-offset-1 outline-[#F97316] transition-all duration-300 ease-out pointer-events-none"
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
        className={cn(
          'fixed bg-white bt-card-in transition-[left,top,bottom] duration-300 ease-out',
          WINDOW_SHADOW,
          facing === 'left' && 'border-l-[3px] border-l-[#F97316]',
          facing === 'top' && 'border-t-[3px] border-t-[#F97316]',
          facing === 'bottom' && 'border-b-[3px] border-b-[#F97316]',
        )}
        style={{ ...cardStyle, width: cardW }}
        data-testid="tour-spotlight-card"
      >
        <InkBar grid={24} className="px-3.5 py-2.5">
          <div className="relative flex items-center justify-between gap-3">
            <span className="font-bt-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F97316]">
              {t('admin:tour.stepOf', { current: index + 1, total })}
            </span>
            <Segments total={total} index={index} onDark />
          </div>
        </InkBar>

        <div className="px-[17px] pt-[17px] pb-[15px]">
          <h3 className="font-bt-display font-extrabold uppercase text-[28px] leading-none tracking-[0.01em] text-[#0A0A0A]">
            {title}
          </h3>
          <p className="text-[13.5px] leading-[1.55] text-[#5A5346] mt-[9px]">{body}</p>
        </div>

        <div className="bg-[#FAF7F0] border-t border-[#EDE7DB] px-[13px] py-[11px] flex items-center justify-between gap-2">
          <TertiaryButton onClick={onSkip}>{t('admin:tour.skip')}</TertiaryButton>
          <div className="flex items-center gap-[7px] flex-shrink-0">
            {index > 0 && (
              <SecondaryButton onClick={onBack} className="text-[10px] px-[11px] py-[9px] gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                {t('admin:tour.back')}
              </SecondaryButton>
            )}
            <PrimaryButton onClick={onNext} className="text-[10px] px-3 py-[9px] gap-1.5">
              {isLast ? (
                <>
                  {t('admin:tour.done')}
                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                </>
              ) : (
                <>
                  {t('admin:tour.next')}
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                </>
              )}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
