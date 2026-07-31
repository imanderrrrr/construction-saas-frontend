import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '../ui/button';

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
 */
export function Spotlight({
  anchor,
  title,
  body,
  index,
  total,
  onBack,
  onNext,
  onSkip,
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
        data-testid="tour-spotlight-card"
      >
        <p className="text-[11px] font-semibold text-[#F97316] uppercase tracking-wide mb-1">
          {t('admin:tour.stepOf', { current: index + 1, total })}
        </p>
        <h3 className="text-sm font-semibold text-[#0A0A0A] mb-1.5">{title}</h3>
        <p className="text-sm text-[#52525B] leading-relaxed mb-4">{body}</p>

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
