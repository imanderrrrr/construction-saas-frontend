import { LogIn, LogOut, Utensils, Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TimeEventType } from '../../types';

// Config (icon only — labels come from i18n)

const PUNCH_ICONS: Record<TimeEventType, React.ElementType> = {
  CHECK_IN:    LogIn,
  LUNCH_START: Utensils,
  LUNCH_END:   Utensils,
  CHECK_OUT:   LogOut,
};

// Types

export type PunchState = 'done' | 'next' | 'loading' | 'upcoming';

interface TimePunchButtonProps {
  type: TimeEventType;
  state: PunchState;
  capturedAt?: string;   // ISO — shown when state === 'done'
  onClick?: () => void;
  compact?: boolean;     // smaller card variant
}

// Helper

function fmtTime(iso: string, lng: string) {
  const locale = lng === 'es' ? 'es-GT' : 'en-US';
  try {
    return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return iso; }
}

// Component

export function TimePunchButton({ type, state, capturedAt, onClick, compact = false }: TimePunchButtonProps) {
  const { t, i18n } = useTranslation('time');
  const Icon = PUNCH_ICONS[type];
  const label = t(`punchButton.${type}`);
  const isClickable = state === 'next';
  const isLoading   = state === 'loading';
  const isDone      = state === 'done';
  const isUpcoming  = state === 'upcoming';

  // Style variants
  const wrapClass = [
    'relative flex flex-col items-center justify-center rounded-2xl border-2 transition-all select-none',
    compact ? 'p-4 gap-2' : 'p-5 gap-3',
    isDone     ? 'bg-emerald-50 border-emerald-200'                                   : '',
    isClickable? 'bg-white border-[#F97316] shadow-lg shadow-[#F97316]/10 cursor-pointer hover:bg-[#F97316]/5 active:scale-95' : '',
    isLoading  ? 'bg-[#F97316]/5 border-[#F97316]/40 cursor-not-allowed'              : '',
    isUpcoming ? 'bg-[#FAFAFA] border-[#D4D4D8] cursor-not-allowed opacity-60'        : '',
  ].filter(Boolean).join(' ');

  const iconWrap = [
    'rounded-xl flex items-center justify-center flex-shrink-0',
    compact ? 'w-10 h-10' : 'w-12 h-12',
    isDone     ? 'bg-emerald-100'      : '',
    isClickable? 'bg-[#F97316]/10'    : '',
    isLoading  ? 'bg-[#F97316]/10'    : '',
    isUpcoming ? 'bg-[#D4D4D8]/50'    : '',
  ].filter(Boolean).join(' ');

  const iconColor = isDone ? 'text-emerald-600' : isClickable || isLoading ? 'text-[#F97316]' : 'text-[#D4D4D8]';

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={wrapClass}
    >
      {/* Pulse ring for next action */}
      {isClickable && (
        <span className="absolute inset-0 rounded-2xl border-2 border-[#F97316] animate-ping opacity-20 pointer-events-none" />
      )}

      {/* Icon */}
      <div className={iconWrap}>
        {isLoading ? (
          <Loader2 className={`animate-spin ${compact ? 'w-5 h-5' : 'w-6 h-6'} text-[#F97316]`} />
        ) : isDone ? (
          <Check className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} ${iconColor}`} />
        ) : (
          <Icon className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} ${iconColor}`} />
        )}
      </div>

      {/* Label */}
      <div className="text-center">
        <p className={`font-semibold font-mono uppercase tracking-wide ${compact ? 'text-[11px]' : 'text-xs'} ${
          isDone ? 'text-emerald-700' : isClickable ? 'text-[#F97316]' : 'text-[#71717A]'
        }`}>
          {label}
        </p>
        {/* Time or status */}
        {isDone && capturedAt && (
          <p className="text-xs text-emerald-600 mt-0.5">{fmtTime(capturedAt, i18n.language)}</p>
        )}
        {isLoading && (
          <p className="text-[10px] text-[#71717A] mt-0.5">{t('punchButton.saving')}</p>
        )}
        {isClickable && (
          <p className="text-[10px] text-[#F97316]/70 mt-0.5">{t('punchButton.tapToPunch')}</p>
        )}
        {isUpcoming && (
          <p className="text-[10px] text-[#D4D4D8] mt-0.5">—</p>
        )}
      </div>
    </button>
  );
}
