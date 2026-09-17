import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronRight, ImageIcon, MoreVertical, Search } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';
import { Mono } from '../projects/bt';
import { Amount } from '../budgets/ui';
import { fmtMoney } from '../invoices/bits';

/**
 * The pieces Cobrar and Pagar share — deliberately few.
 *
 * The two screens this replaces were the same screen with different data, and
 * that is exactly what made them impossible to tell apart. So what is shared
 * here is the *chassis* (a stamp, a figure cell, a filter bar, a menu button)
 * and never the composition: the direction, the figures, the grouping and the
 * verb are each screen's own, and they are meant to differ.
 */

export type Direction = 'in' | 'out';

/**
 * The direction stamp: a solid square with the arrow that already labels the
 * section in the sidebar — down into a line for money coming in, up out of one
 * for money going out. Orange for Cobrar, ink for Pagar, the same pairing the
 * dashboard's money block uses for these two figures.
 */
export function DirectionStamp({ direction, size = 62 }: { direction: Direction; size?: number }) {
  const Icon = direction === 'in' ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn('flex items-center justify-center flex-shrink-0', direction === 'in' ? 'bg-[#F97316]' : 'bg-[#0A0A0A]')}
    >
      <Icon
        strokeWidth={2.1}
        style={{ width: Math.round(size * 0.48), height: Math.round(size * 0.48) }}
        className={direction === 'in' ? 'text-[#0A0A0A]' : 'text-[#F5F1E8]'}
      />
    </span>
  );
}

/** Eyebrow, display title, purpose line, and whatever the screen puts on the right. */
export function DirectionHeader({ direction, eyebrow, title, purpose, aside, tourAnchor }: {
  direction: Direction;
  eyebrow: string;
  title: string;
  purpose: string;
  aside?: ReactNode;
  /**
   * The section tour's anchor for this stop. Named `tourAnchor` because the
   * registry guardian (onboarding/sectionTourSteps.test.ts) greps the source
   * for that literal attribute or prop and cannot follow a template.
   */
  tourAnchor?: string;
}) {
  return (
    <div data-tour={tourAnchor} className="flex items-start justify-between gap-6 flex-wrap">
      <div className="flex items-start gap-4 min-w-0">
        <DirectionStamp direction={direction} />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className={cn('w-2 h-2 block flex-shrink-0', direction === 'in' ? 'bg-[#F97316]' : 'bg-[#0A0A0A]')} />
            <Mono className={cn('text-[10.5px] font-semibold tracking-[0.14em]', direction === 'in' ? 'text-[#C2410C]' : 'text-[#0A0A0A]')}>
              {eyebrow}
            </Mono>
          </div>
          <h2 className="font-bt-display font-extrabold uppercase text-[38px] md:text-[50px] leading-[0.9] tracking-[0.01em] text-[#0A0A0A] mt-1">
            {title}
          </h2>
          <p className="text-[13.5px] leading-[1.5] text-[#5A5346] mt-[7px] max-w-[580px]">{purpose}</p>
        </div>
      </div>
      {aside && <div className="flex flex-col items-start md:items-end gap-2.5 flex-shrink-0">{aside}</div>}
    </div>
  );
}

/* ── The three figures ─────────────────────────────────────────────────── */

export type FigureTone = 'orange' | 'ink' | 'red' | 'green' | 'plain';

const FIGURE_VALUE: Record<FigureTone, string> = {
  orange: 'text-[#C2410C]',
  ink: 'text-white',
  red: 'text-[#B3402A]',
  green: 'text-[#2E7D4F]',
  plain: 'text-[#0A0A0A]',
};

/**
 * One cell of the strip: label, big tabular number, an optional chip beside it
 * and a meta line underneath.
 *
 * `onClick` turns the cell into a filter — Cobrar's Vencido is the only figure
 * that is also a control, because "start with what is late" is that screen's
 * whole thesis. Everywhere else a figure is a figure.
 */
export function Figure({ label, value, chip, meta, tone = 'plain', sheet, onClick, pressed, tourAnchor, className }: {
  label: string;
  value: string;
  chip?: ReactNode;
  meta?: ReactNode;
  tone?: FigureTone;
  /** Paints the cell — sand for the orange figure, ink for the week block. */
  sheet?: 'sand' | 'ink';
  onClick?: () => void;
  pressed?: boolean;
  /** Section-tour anchor; see the note on DirectionHeader. */
  tourAnchor?: string;
  className?: string;
}) {
  const body = (
    <>
      <Mono className={cn(
        'block text-[10.5px] font-semibold tracking-[0.12em]',
        tone === 'orange' ? 'text-[#C2410C]' : tone === 'red' ? 'text-[#B3402A]' : sheet === 'ink' ? 'text-[#F5F1E8]' : 'text-[#5A5346]',
      )}>
        {label}
      </Mono>
      <div className="flex items-baseline gap-2.5 mt-[5px] flex-wrap">
        <span className={cn('font-bt-display font-extrabold text-[32px] md:text-[40px] leading-[0.85] tabular-nums', FIGURE_VALUE[tone])}>
          {value}
        </span>
        {chip}
      </div>
      {meta && (
        <Mono className={cn('block text-[10.5px] tracking-[0.08em] mt-1.5', sheet === 'ink' ? 'text-[#A69C8D]' : 'text-[#5A5346]')}>
          {meta}
        </Mono>
      )}
    </>
  );

  const shell = cn(
    'px-5 py-[13px] text-left',
    sheet === 'sand' && 'bg-[#FBEDE0] border-t-[3px] border-t-[#F97316]',
    sheet === 'ink' && 'bg-[#0A0A0A]',
    !sheet && 'bg-white border-t-[3px] border-t-[#EDE7DB]',
    className,
  );

  if (!onClick) return <div className={shell} data-tour={tourAnchor}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      data-tour={tourAnchor}
      className={cn(shell, 'cursor-pointer transition-colors hover:bg-[#F9E3CE]', pressed && 'ring-2 ring-inset ring-[#F97316]', FOCUS_RING)}
    >
      {body}
    </button>
  );
}

/** The chip that rides beside a figure: "2 facturas", "43 días". */
export function FigureChip({ tone = 'orange', children }: { tone?: 'orange' | 'red' | 'onInk'; children: ReactNode }) {
  return (
    <Mono className={cn(
      'text-[10px] tracking-[0.09em] px-1.5 py-[3px] whitespace-nowrap',
      tone === 'orange' && 'bg-[#F97316] text-[#0A0A0A]',
      tone === 'red' && 'bg-[#B3402A] text-white',
      tone === 'onInk' && 'border border-[#5A5346] text-[#F5F1E8]',
    )}>
      {children}
    </Mono>
  );
}

export function FiguresStrip({ direction, children, ...rest }: { direction: Direction; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#EDE7DB]',
        direction === 'in' ? 'border border-[#E7E1D5] bg-white' : 'border border-[#0A0A0A] bg-white',
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** The sand line under the strip, where the figures are reconciled out loud. */
export function ContextLine({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap bg-[#F3EEE4] border border-[#E7E1D5] border-t-0 px-5 py-[7px]">
      <Mono className="text-[10.5px] tracking-[0.07em] text-[#5A5346]">{children}</Mono>
      {aside && <Mono className="ml-auto text-[10.5px] tracking-[0.07em] text-[#A69C8D]">{aside}</Mono>}
    </div>
  );
}

/* ── Filters ───────────────────────────────────────────────────────────── */

/** The one-line bar: a view toggle, mono selects, the search box, a count. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap bg-white border border-[#E7E1D5] px-3 py-2">
      {children}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder, label }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className={cn('flex items-center gap-[7px] border border-[#DBD0BB] bg-[#FAF7F0] px-2.5 py-2 flex-1 min-w-[140px]', 'focus-within:border-[#F97316]')}>
      <Search className="w-3.5 h-3.5 text-[#8A8175] flex-shrink-0" strokeWidth={2.2} />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-0 bg-transparent outline-none w-full min-w-0 font-bt-mono text-[11px] tracking-[0.05em] text-[#0A0A0A] placeholder:text-[#A69C8D]"
      />
    </label>
  );
}

/**
 * Two positions, one of them on. Same keyboard contract as the Presupuestos
 * switcher: a tablist with arrow keys, because it swaps the body below it.
 */
export function ViewToggle<T extends string>({ value, options, onChange, label, bodyId, tourAnchor }: {
  value: T;
  options: Array<{ key: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
  bodyId: string;
  tourAnchor?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const order = options.map(o => o.key);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const next = order[(order.indexOf(value) + step + order.length) % order.length];
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} data-tour={tourAnchor} className="flex border border-[#DBD0BB]">
      {options.map((o, i) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            ref={el => { refs.current[o.key] = el; }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={bodyId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={onKeyDown}
            className={cn(
              'font-bt-mono text-[10.5px] uppercase tracking-[0.09em] px-3 py-2 transition-colors whitespace-nowrap',
              i > 0 && 'border-l border-[#DBD0BB]',
              active ? 'bg-[#0A0A0A] text-[#F5F1E8] font-semibold' : 'bg-white text-[#5A5346] hover:bg-[#F3EEE4] hover:text-[#0A0A0A]',
              FOCUS_RING,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Row furniture ─────────────────────────────────────────────────────── */

/** The ⋮ that opens a row's menu. */
export function RowMenuButton({ label, ...rest }: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        'w-7 h-7 inline-flex items-center justify-center border border-[#DBD0BB] bg-white text-[#5A5346] transition-colors hover:border-[#F97316] hover:text-[#C2410C] flex-shrink-0',
        FOCUS_RING,
        rest.className,
      )}
    >
      <MoreVertical className="w-3.5 h-3.5" />
    </button>
  );
}

/** The chassis' menu surface: square, sand-bordered, orange edge on focus. */
export const MENU_CONTENT = 'w-[250px] rounded-none border-[#CDBFA6] p-0 shadow-[0_16px_48px_rgba(23,19,15,0.3)]';
export const MENU_ITEM = 'rounded-none cursor-pointer px-3.5 py-[11px] font-bt-mono text-[10.5px] uppercase tracking-[0.08em] text-[#0A0A0A] border-l-2 border-l-transparent focus:bg-[#F3EEE4] focus:border-l-[#F97316] data-[highlighted]:bg-[#F3EEE4]';
export const MENU_ITEM_DANGER = 'rounded-none cursor-pointer px-3.5 py-[11px] font-bt-mono text-[10.5px] uppercase tracking-[0.08em] text-[#B3402A] border-l-2 border-l-transparent focus:bg-[#FBEDE0] focus:border-l-[#B3402A] data-[highlighted]:bg-[#FBEDE0]';
export const MENU_LABEL = 'font-bt-mono text-[9.5px] font-normal uppercase tracking-[0.14em] text-[#8A8175] px-3.5 pt-2.5 pb-2 border-b border-[#EDE7DB] truncate';

/** A due date and how far away it is — red once it is behind. */
export function DueCell({ date, days, todayLabel, className }: {
  /** Already formatted for display. */
  date: string;
  /** Positive = late, 0 = today, negative = ahead. */
  days: number;
  todayLabel?: string;
  className?: string;
}) {
  const { t } = useTranslation('finance');
  const late = days > 0;
  const tomorrow = days === -1;
  return (
    <div className={cn('min-w-0', className)}>
      <Mono className={cn('block text-[11px] font-semibold normal-case', late ? 'text-[#B3402A]' : 'text-[#0A0A0A]')}>
        {late ? t('accounts.due.expiredOn', { date }) : date}
      </Mono>
      {tomorrow ? (
        <Mono className="inline-block text-[9.5px] tracking-[0.06em] bg-[#F97316] text-[#0A0A0A] px-1 mt-[2px]">
          {t('accounts.due.tomorrow')}
        </Mono>
      ) : (
        <Mono className={cn('block text-[10px] tracking-[0.06em] mt-[2px]', late ? 'text-[#B3402A]' : 'text-[#A69C8D]')}>
          {late
            ? t('accounts.due.daysLate', { count: days })
            : days === 0
              ? (todayLabel ?? t('accounts.due.today'))
              : t('accounts.due.inDays', { count: -days })}
        </Mono>
      )}
    </div>
  );
}

/**
 * The document's photo, or the frame where one would be.
 *
 * A dashed empty frame rather than nothing: on this screen the absence of a
 * photo is information — it is the bill somebody typed in by hand.
 */
export function PhotoCell({ children, count, empty, label }: {
  children?: ReactNode;
  count?: number;
  empty: boolean;
  label: string;
}) {
  return (
    <span
      title={label}
      className={cn(
        'relative w-[38px] h-7 flex items-center justify-center flex-shrink-0 overflow-hidden',
        empty ? 'border border-dashed border-[#DBD0BB] bg-[#FAF7F0]' : 'border border-[#DBD0BB] bg-[#D9D2C4]',
      )}
    >
      {children ?? <ImageIcon className={cn('w-3.5 h-3.5', empty ? 'text-[#CDBFA6]' : 'text-[#5A5346]')} strokeWidth={2} />}
      {!!count && count > 1 && (
        <Mono className="absolute -right-1 -top-1 text-[8px] bg-[#0A0A0A] text-[#F5F1E8] px-[3px] leading-[1.4]">{count}</Mono>
      )}
    </span>
  );
}

/** A small square chip: category, document type, signature state. */
export function Tag({ tone = 'sand', children, className }: {
  tone?: 'sand' | 'orangeDashed' | 'green' | 'red' | 'outline';
  children: ReactNode;
  className?: string;
}) {
  return (
    <Mono className={cn(
      'inline-block text-[10px] tracking-[0.07em] px-1.5 py-[4px] whitespace-nowrap',
      tone === 'sand' && 'bg-[#F3EEE4] text-[#5A5346]',
      tone === 'outline' && 'border border-[#DBD0BB] text-[#8A8175]',
      tone === 'orangeDashed' && 'bg-[#FBEDE0] border border-dashed border-[#F97316] text-[#C2410C]',
      tone === 'green' && 'bg-[#FAF7F0] border border-[#2E7D4F] text-[#2E7D4F]',
      tone === 'red' && 'bg-[#FAF7F0] border border-[#B3402A] text-[#B3402A]',
      className,
    )}>
      {children}
    </Mono>
  );
}

/* ── The window chrome both screens' dialogs wear ──────────────────────── */

export const WINDOW = 'rounded-none border border-[#CDBFA6] p-0 gap-0 sm:max-w-[440px] bg-white';
export const WINDOW_SHEET = 'px-[18px] py-4 flex flex-col gap-3.5';

/** A window's head: direction kicker over a display title, on a solid band. */
export function WindowHead({ kicker, title, tone }: { kicker: string; title: ReactNode; tone: 'orange' | 'ink' | 'red' }) {
  return (
    <div className={cn(
      'px-[18px] py-3.5',
      tone === 'orange' && 'bg-[#F97316] text-[#0A0A0A]',
      tone === 'ink' && 'bg-[#0A0A0A] text-[#F5F1E8]',
      tone === 'red' && 'bg-[#B3402A] text-white',
    )}>
      <Mono className={cn(
        'block text-[9.5px] font-semibold tracking-[0.14em]',
        tone === 'orange' ? 'text-[#7C2D12]' : tone === 'ink' ? 'text-[#A69C8D]' : 'text-white/75',
      )}>
        {kicker}
      </Mono>
      {title}
    </div>
  );
}

/** A window's foot: the verb, cancel, and an optional line of consequence. */
export function WindowFoot({ confirm, onConfirm, onCancel, busy, tone, note, cancelLabel, disabled }: {
  confirm: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  tone: 'orange' | 'ink' | 'red';
  note?: string;
  cancelLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="border-t border-[#E7E1D5] bg-[#FBF8F2] px-[18px] py-3.5 flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || disabled}
          className={cn(
            'flex-1 border-0 cursor-pointer px-4 py-3.5 font-bt-mono text-[11px] font-semibold uppercase tracking-[0.09em] transition-colors disabled:opacity-50 disabled:pointer-events-none',
            tone === 'orange' && 'bg-[#F97316] text-[#0A0A0A] hover:bg-[#C2410C] hover:text-[#F5F1E8]',
            tone === 'ink' && 'bg-[#0A0A0A] text-[#F5F1E8] hover:bg-[#F97316] hover:text-[#0A0A0A]',
            tone === 'red' && 'bg-[#B3402A] text-white hover:bg-[#8F3221]',
            FOCUS_RING,
          )}
        >
          {confirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={cn('border border-[#DBD0BB] bg-white cursor-pointer px-3.5 py-3.5 font-bt-mono text-[10.5px] uppercase tracking-[0.09em] text-[#5A5346] transition-colors hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
        >
          {cancelLabel}
        </button>
      </div>
      {note && <Mono className="text-[9.5px] tracking-[0.05em] text-[#A69C8D] leading-[1.5] normal-case">{note}</Mono>}
    </div>
  );
}

/** The document line inside a window: number, who, and the balance. */
export function WindowSubject({ number, who, label, amount }: {
  number: string; who: string; label: string; amount: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 bg-[#F3EEE4] px-3 py-2.5">
      <div className="min-w-0">
        <Mono className="block text-[12.5px] font-semibold normal-case text-[#0A0A0A]">{number}</Mono>
        <span className="block text-[12.5px] text-[#5A5346] mt-[3px] truncate">{who}</span>
      </div>
      <div className="text-right flex-shrink-0">
        <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175]">{label}</Mono>
        <Mono className="block text-[14px] font-semibold normal-case tabular-nums">{amount}</Mono>
      </div>
    </div>
  );
}

/* ── The aging row both screens share ──────────────────────────────────── */

export const AGING_GRID = 'grid grid-cols-[2.1fr_1fr_1fr_.85fr_.85fr_1.15fr_30px] gap-3 items-center';

/**
 * One party — a client in Cobrar, a vendor in Pagar — with its four aging
 * columns.
 *
 * On a phone the four columns would be four unreadable slivers, so the card
 * shows the two that decide what you do today (current and 1–30) and the
 * total; the rest is one tap away, inside. Nothing scrolls sideways.
 */
export function AgingPartyRow({ row, open, onToggle, subtitle, labels, children }: {
  row: AgingRowShape;
  open: boolean;
  onToggle: () => void;
  subtitle: string;
  labels: { current: string; d1_30: string; d31_60: string; d60plus: string };
  children?: ReactNode;
}) {
  const money = (n: number) => (n ? fmtMoney(n) : '—');
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          AGING_GRID, 'hidden sm:grid w-full text-left px-5 py-2.5 border-b border-[#F0EBE1] border-l-2 transition-colors cursor-pointer',
          open ? 'bg-[#FBF8F2] border-l-[#F97316]' : 'border-l-transparent hover:bg-[#FBF8F2] hover:border-l-[#F97316]',
          FOCUS_RING,
        )}
      >
        <div className="min-w-0">
          <div className="text-[14.5px] font-semibold text-[#0A0A0A] truncate">{row.party}</div>
          <Mono className="block text-[10px] tracking-[0.05em] text-[#A69C8D] mt-[3px] truncate">{subtitle}</Mono>
        </div>
        <Amount>{money(row.current)}</Amount>
        <Amount tone={row.d1_30 ? 'orange' : 'quiet'}>{money(row.d1_30)}</Amount>
        <Amount tone={row.d31_60 ? 'orange' : 'quiet'}>{money(row.d31_60)}</Amount>
        <Amount tone={row.d60plus ? 'red' : 'quiet'}>{money(row.d60plus)}</Amount>
        <Amount className="text-[13.5px] font-semibold">{fmtMoney(row.total)}</Amount>
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-[#C2410C] justify-self-end" strokeWidth={2.4} />
          : <ChevronRight className="w-3.5 h-3.5 text-[#8A8175] justify-self-end" strokeWidth={2.4} />}
      </button>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'sm:hidden w-full text-left px-3.5 py-3 border-b border-[#F0EBE1] border-l-2 cursor-pointer',
          open ? 'bg-[#FBF8F2] border-l-[#F97316]' : 'border-l-transparent',
          FOCUS_RING,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[#0A0A0A] truncate">{row.party}</div>
            <Mono className="block text-[9.5px] tracking-[0.05em] text-[#A69C8D] mt-[3px] truncate">{subtitle}</Mono>
          </div>
          <span className="font-bt-display font-extrabold text-[24px] leading-none tabular-nums flex-shrink-0">{fmtMoney(row.total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-px bg-[#EDE7DB] border border-[#EDE7DB] mt-2.5">
          <div className="bg-white px-2.5 py-2">
            <Mono className="block text-[8.5px] tracking-[0.1em] text-[#8A8175]">{labels.current}</Mono>
            <Mono className="block text-[12.5px] font-semibold normal-case tabular-nums mt-[2px]">{money(row.current)}</Mono>
          </div>
          <div className={cn('px-2.5 py-2', row.overdue ? 'bg-[#FBEDE0]' : 'bg-white')}>
            <Mono className={cn('block text-[8.5px] tracking-[0.1em]', row.overdue ? 'text-[#C2410C]' : 'text-[#8A8175]')}>{labels.d1_30}</Mono>
            <Mono className={cn('block text-[12.5px] font-semibold normal-case tabular-nums mt-[2px]', row.overdue && 'text-[#C2410C]')}>
              {money(row.overdue)}
            </Mono>
          </div>
        </div>
        {(row.d31_60 > 0 || row.d60plus > 0) && (
          <Mono className="block text-[9.5px] tracking-[0.06em] text-[#8A8175] mt-2 normal-case">
            {labels.d31_60} {money(row.d31_60)} · {labels.d60plus} {money(row.d60plus)}
          </Mono>
        )}
      </button>

      {children}
    </>
  );
}

/** What AgingPartyRow needs — the shape `agingByParty` returns. */
export interface AgingRowShape {
  party: string;
  current: number;
  d1_30: number;
  d31_60: number;
  d60plus: number;
  overdue: number;
  total: number;
}

/** The ink totals row under an aging table — four columns, or two on a phone. */
export function AgingTotalsRow({ label, totals, labels }: {
  label: string;
  totals: Pick<AgingRowShape, 'current' | 'd1_30' | 'd31_60' | 'd60plus' | 'overdue' | 'total'>;
  labels: { current: string; overdue: string };
}) {
  return (
    <>
      <div className={cn(AGING_GRID, 'hidden sm:grid px-5 py-3 bg-[#0A0A0A] text-[#F5F1E8]')}>
        <Mono className="text-[10.5px] font-semibold tracking-[0.12em]">{label}</Mono>
        <Mono className="text-[12.5px] text-right tabular-nums normal-case">{fmtMoney(totals.current)}</Mono>
        <Mono className="text-[12.5px] text-right tabular-nums normal-case font-semibold text-[#F97316]">{fmtMoney(totals.d1_30)}</Mono>
        <Mono className="text-[12.5px] text-right tabular-nums normal-case">{fmtMoney(totals.d31_60)}</Mono>
        <Mono className="text-[12.5px] text-right tabular-nums normal-case">{fmtMoney(totals.d60plus)}</Mono>
        <Mono className="text-[13.5px] text-right tabular-nums normal-case font-semibold">{fmtMoney(totals.total)}</Mono>
        <span />
      </div>
      <div className="sm:hidden bg-[#0A0A0A] text-[#F5F1E8] px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <Mono className="text-[10px] font-semibold tracking-[0.12em]">{label}</Mono>
          <span className="font-bt-display font-extrabold text-[24px] leading-none tabular-nums">{fmtMoney(totals.total)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 mt-1.5">
          <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D]">{labels.current} {fmtMoney(totals.current)}</Mono>
          <Mono className="text-[9.5px] tracking-[0.08em] text-[#F97316] font-semibold normal-case">
            {labels.overdue} {fmtMoney(totals.overdue)}
          </Mono>
        </div>
      </div>
    </>
  );
}
