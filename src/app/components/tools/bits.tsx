import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';
import { Bone, Mono } from '../projects/bt';

/**
 * The pieces the two tables, the record and the four windows share (Claude
 * Design "Herramientas BuildTrack", 2026-09).
 *
 * The names of the six states, the five categories, the eight history actions
 * and the three traffic lights all live in the shared `tools.*` catalogue.
 * They used to be three hand-written maps inside the component pointing at
 * `toolReport.*` — the *reports* section — which tied this screen to another
 * one and left three actions and the whole traffic light untranslated.
 *
 * The wire carries the enum's display name in English ("Pending Acceptance"),
 * so every lookup goes through these helpers and none of them ever prints a
 * translation key at the user.
 */

/** "Pending Acceptance" → `tools.status.pendingAcceptance`. */
const STATUS_KEYS: Record<string, string> = {
  'Available': 'available',
  'Assigned': 'assigned',
  'Pending Acceptance': 'pendingAcceptance',
  'In Review': 'inReview',
  'Damaged': 'damaged',
  'Lost': 'lost',
};

const CATEGORY_KEYS: Record<string, string> = {
  'Power Tools': 'powerTools',
  'Hand Tools': 'handTools',
  'Measurement': 'measurement',
  'Safety Equipment': 'safetyEquipment',
  'Heavy Machinery': 'heavyMachinery',
};

const ACTION_KEYS: Record<string, string> = {
  'Registered': 'registered',
  'Assigned': 'assigned',
  'Returned': 'returned',
  'Status Changed': 'statusChanged',
  'Reported': 'reported',
  'Acceptance Pending': 'acceptancePending',
  'Accepted': 'accepted',
  'Rejected': 'rejected',
};

const LIGHT_KEYS: Record<string, string> = {
  'In Stock': 'inStock',
  'Low Stock': 'lowStock',
  'Out of Stock': 'outOfStock',
};

type T = (key: string, options?: Record<string, unknown>) => string;

/** The five categories, in the order the enum declares them. */
export const CATEGORIES = ['Power Tools', 'Hand Tools', 'Measurement', 'Safety Equipment', 'Heavy Machinery'];
/** The six states, in the order the strip reads them. */
export const STATUSES = ['Available', 'Assigned', 'Pending Acceptance', 'In Review', 'Damaged', 'Lost'];

export function statusName(t: T, status: string): string {
  const key = STATUS_KEYS[status];
  return key ? t(`tools:status.${key}`) : status;
}

export function categoryName(t: T, category: string): string {
  const key = CATEGORY_KEYS[category];
  return key ? t(`tools:category.${key}`) : category;
}

export function actionName(t: T, action: string): string {
  const key = ACTION_KEYS[action];
  return key ? t(`tools:action.${key}`) : action;
}

export function lightName(t: T, light: string): string {
  const key = LIGHT_KEYS[light];
  return key ? t(`tools:consumable.status.${key}`) : light;
}

const CHIP = 'inline-flex items-center font-bt-mono text-[9px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap';

/**
 * The six state chips.
 *
 * Only "Pending acceptance" is dotted, and it is the only dotted thing in the
 * section: the dots mean "a step is missing" — it left the warehouse and
 * nobody signed for it. Lost is the only solid red chip. Green is a state and
 * never a button.
 */
export function StatusChip({ status, short = false, onDark = false, className }: {
  status: string;
  /** The tablet and phone form, where the column is narrower. */
  short?: boolean;
  onDark?: boolean;
  className?: string;
}) {
  const { t } = useTranslation(['tools']);
  const pending = status === 'Pending Acceptance';
  const label = pending && short ? t('tools:status.pendingAcceptanceShort') : statusName(t, status);
  const look = {
    'Available': 'px-[7px] py-1 bg-[#FAF7F0] text-[#2E7D4F]',
    'Assigned': 'px-[7px] py-1 bg-[#F3EEE4] text-[#0B0A09]',
    'Pending Acceptance': onDark
      ? 'px-2 py-1 bg-[#F97316] text-[#0B0A09]'
      : 'px-[7px] py-1 bg-[#FBEDE0] text-[#C2410C] border border-dashed border-[#F97316]',
    'In Review': 'px-[7px] py-1 bg-[#F3EEE4] text-[#5A5346]',
    'Damaged': 'px-[6px] py-[3px] bg-white text-[#B3402A] border border-[#B3402A]',
    'Lost': 'px-[7px] py-1 bg-[#B3402A] text-white',
  }[status] ?? 'px-[6px] py-[3px] border border-[#DBD0BB] text-[#5A5346]';
  return <span className={cn(CHIP, look, className)}>{label}</span>;
}

/** The traffic light of a supply, as the server decided it. */
export function LightChip({ light, className }: { light: string; className?: string }) {
  const { t } = useTranslation(['tools']);
  const look = {
    'In Stock': 'px-[7px] py-1 bg-[#FAF7F0] text-[#2E7D4F]',
    'Low Stock': 'px-[7px] py-1 bg-[#FBEDE0] text-[#C2410C] border border-[#F97316]',
    'Out of Stock': 'px-[7px] py-1 bg-[#B3402A] text-white',
  }[light] ?? 'px-[6px] py-[3px] border border-[#DBD0BB] text-[#5A5346]';
  return <span className={cn(CHIP, look, className)}>{lightName(t, light)}</span>;
}

/** Left edge of a row: the state, 3 px. */
export const STATUS_EDGE: Record<string, string> = {
  'Available': '#2E7D4F',
  'Assigned': '#CDBFA6',
  'Pending Acceptance': '#F97316',
  'In Review': '#8A8175',
  'Damaged': '#B3402A',
  'Lost': '#B3402A',
};

export const LIGHT_EDGE: Record<string, string> = {
  'In Stock': '#2E7D4F',
  'Low Stock': '#F97316',
  'Out of Stock': '#B3402A',
};

/**
 * The stock bar.
 *
 * It measures against three times the minimum, with an ink mark at the
 * minimum — not an invented percentage. The only question it has to answer is
 * whether the fill reaches the mark.
 */
export function StockBar({ stock, minimum, light, className }: {
  stock: number;
  minimum: number;
  light: string;
  className?: string;
}) {
  const scale = Math.max(minimum * 3, stock, 1);
  const fill = Math.min(100, (stock / scale) * 100);
  const mark = Math.min(100, (minimum / scale) * 100);
  return (
    <div className={cn('relative h-[7px] bg-[#F3EEE4] border border-[#EDE7DB]', className)} aria-hidden="true">
      <div className="h-full" style={{ width: `${fill}%`, background: LIGHT_EDGE[light] ?? '#CDBFA6' }} />
      {minimum > 0 && (
        <span className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-[#0B0A09]" style={{ left: `${mark}%` }} />
      )}
    </div>
  );
}

/** An empty cell: mono, sand, uppercase. Never a dash. */
export function CellEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return <Mono className={cn('text-[9.5px] tracking-[0.06em] text-[#A69C8D]', className)}>{children}</Mono>;
}

/** The code, always mono and always uppercase: it is read off a label stuck to the machine. */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return <Mono className={cn('font-semibold tracking-[0.04em] text-[#0B0A09]', className)}>{children}</Mono>;
}

/** One cell of the figure strip. The pressable ones apply their own filter. */
export function Figure({ value, text, label, note, tone = 'ink', pressed, onClick, state, className }: {
  value: number | undefined;
  /**
   * Drawn instead of [value] when the figure carries its unit — "8,4 días",
   * "35,0 %". The unit belongs inside the display and is translated together
   * with the number; split into a label beside it, it came out in English.
   */
  text?: string;
  label: string;
  note?: string;
  tone?: 'ink' | 'orange' | 'red' | 'green';
  pressed?: boolean;
  onClick?: () => void;
  state: 'loading' | 'ready' | 'failed';
  className?: string;
}) {
  const color = { ink: 'text-[#0B0A09]', orange: 'text-[#C2410C]', red: 'text-[#B3402A]', green: 'text-[#2E7D4F]' }[tone];
  const body = (
    <>
      <div className={cn('font-bt-display font-extrabold text-[38px] leading-[0.85] tabular-nums', color)}>
        {state === 'ready' ? (text ?? value) : state === 'failed' ? <span className="text-[#CDBFA6]">—</span> : <Bone className="w-12 h-7" />}
      </div>
      <Mono className="block text-[9.5px] tracking-[0.1em] text-[#5A5346] mt-1.5">{label}</Mono>
      {note && <Mono className="block text-[8.5px] tracking-[0.08em] text-[#A69C8D] mt-[3px]">{note}</Mono>}
    </>
  );
  const padding = 'px-4 py-[13px] min-w-0 text-left';
  return onClick ? (
    <button
      type="button"
      disabled={state !== 'ready'}
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        padding,
        'transition-colors disabled:cursor-default',
        state === 'ready' && (tone === 'ink' ? 'hover:bg-[#F3EEE4]' : 'hover:bg-[#FBEDE0]'),
        pressed && 'bg-[#FBEDE0] shadow-[inset_0_-3px_0_#F97316]',
        FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
        className,
      )}
    >
      {body}
    </button>
  ) : (
    <div className={cn(padding, className)}>{body}</div>
  );
}

/** "16:40". */
export function stampTime(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString(lang.startsWith('es') ? 'es-GT' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

/** "5 sep · 16:40", or "Hoy · 06:20" when it happened today. */
export function stampMoment(iso: string | null | undefined, lang: string, todayWord: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const time = stampTime(iso, lang);
    return d.toDateString() === new Date().toDateString()
      ? `${todayWord} · ${time}`
      : `${stampDay(iso, lang)} · ${time}`;
  } catch {
    return iso;
  }
}

/** "5 sep" — the shorter form. */
export function stampDay(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
    return d.toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { day: 'numeric', month: 'short' }).replace(/\./g, '');
  } catch {
    return iso;
  }
}

/** Whole days between an instant and now, on the calendar. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

/**
 * Which states this screen offers from the current one.
 *
 * A rule of the screen, not of the API: the server only refuses while the tool
 * is Assigned or Pending acceptance and accepts any other jump. Assigned is in
 * no list, because assigning is a counter act with a person in front of you,
 * not a change of field.
 */
export function pathsFrom(status: string): string[] {
  return {
    'Available': ['In Review', 'Damaged', 'Lost'],
    'In Review': ['Available', 'Damaged', 'Lost'],
    'Damaged': ['In Review', 'Available', 'Lost'],
    'Lost': ['Available', 'In Review', 'Damaged'],
  }[status] ?? [];
}

/** A tool that is out: its status cannot be fixed until the warehouse takes it back. */
export function isOut(status: string): boolean {
  return status === 'Assigned' || status === 'Pending Acceptance';
}

/**
 * Who can do it now.
 *
 * The sheet ends both blocked paths — the record's "the warehouse handles
 * this" and the blocked fix-status window — with a link into the warehouse
 * panel. That panel is guarded by role (`allowedRoles={['WAREHOUSE']}`), so an
 * admin following that link is bounced back to their own dashboard. A button
 * that always fails is worse than no button, and the sheet already carries the
 * honest half of the answer: it names the person at the counter. So the link
 * becomes the name, and the name comes from the company's warehouse users.
 *
 * With none registered the block says so, because that is the company where
 * nothing can be returned at all.
 */
export function WhoCan({ keepers, onGoUsers, className }: {
  keepers: { id: number; fullName?: string | null; username: string }[];
  onGoUsers?: () => void;
  className?: string;
}) {
  const { t } = useTranslation(['tools']);
  return (
    <section className={className}>
      <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346] mb-2">{t('tools:whoCan')}</Mono>
      {keepers.length === 0 ? (
        <>
          <p className="text-[12.5px] leading-[1.5] text-[#5A5346]">{t('tools:whoCan.none')}</p>
          {onGoUsers && (
            <button
              type="button"
              onClick={onGoUsers}
              className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] mt-1.5', FOCUS_RING)}
            >
              {t('tools:whoCan.goUsers')}
            </button>
          )}
        </>
      ) : (
        <ul className="space-y-2">
          {keepers.map(k => {
            const name = k.fullName ?? k.username;
            return (
              <li key={k.id} className="flex items-center gap-2.5">
                <span aria-hidden="true" className="w-7 h-7 flex-shrink-0 bg-[#0B0A09] text-[#F5F1E8] font-bt-mono text-[9.5px] font-semibold flex items-center justify-center">
                  {initials(name)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#0B0A09] truncate">{name}</span>
                  <Mono className="block text-[9px] tracking-[0.09em] text-[#8A8175]">{t('tools:whoCan.role')}</Mono>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}
