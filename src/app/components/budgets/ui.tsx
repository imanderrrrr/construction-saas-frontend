import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Mono } from '../projects/bt';
import { gaugeTone, pct as fmtPct, type GaugeTone } from './bits';

/**
 * The pieces the two views share (Claude Design "Presupuestos BuildTrack" and
 * "Presupuestos Reporte BuildTrack", 2026-09).
 *
 * They are shared because the fusion's one promise is that the two views are
 * the same screen: the same bar, the same four filters, the same figures
 * obeying them. Anything drawn twice is a place where they can drift apart.
 */

export type View = 'works' | 'report';

/**
 * Obras | Reporte.
 *
 * Sits exactly where the "Reporte de presupuestos →" secondary button was, and
 * replaces it: the report stops being an entry in the menu of two panels and
 * becomes the second position of this control.
 */
export function ViewSwitcher({ view, onChange, bodyId }: {
  view: View;
  onChange: (view: View) => void;
  /** The element the tabs control, for `aria-controls`. */
  bodyId: string;
}) {
  const { t } = useTranslation('admin');
  const refs = useRef<Record<View, HTMLButtonElement | null>>({ works: null, report: null });
  const order: View[] = ['works', 'report'];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const next = order[(order.indexOf(view) + step + order.length) % order.length];
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={t('budgets.view.label')} className="flex border border-[#0A0A0A]">
      {order.map((key, i) => {
        const active = view === key;
        return (
          <button
            key={key}
            ref={el => { refs.current[key] = el; }}
            type="button"
            role="tab"
            id={`bt-budgets-tab-${key}`}
            aria-selected={active}
            aria-controls={bodyId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={onKeyDown}
            className={cn(
              'flex items-center gap-[7px] font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] px-4 py-[11px] transition-colors',
              i > 0 && 'border-l border-[#0A0A0A]',
              active
                ? 'bg-[#0A0A0A] text-[#F5F1E8]'
                : 'bg-[#FAF7F0] text-[#5A5346] hover:bg-[#FBEDE0] hover:text-[#C2410C]',
              FOCUS_RING,
            )}
          >
            {active && <span className="w-1.5 h-1.5 bg-[#F97316] block" aria-hidden="true" />}
            {t(key === 'works' ? 'budgets.view.works' : 'budgets.view.report')}
          </button>
        );
      })}
    </div>
  );
}

export type ReportStep = 'vista' | 'cobro' | 'reparto' | 'documento';

/**
 * A guided-tour anchor of the report view.
 *
 * The eight strings are written out one by one, and they have to be: the
 * registry guardian (onboarding/sectionTourSteps.test.ts) greps the source for
 * a literal data-tour attribute and cannot follow a template — and a step
 * whose anchor it cannot see is a step `visibleSteps()` silently drops at
 * runtime, which is how a tour announces "1 de 4" and then shows one stop.
 *
 * Two sets because the copy is keyed per scope: finance tours the same four
 * stops under its own key, so it is not told to adjust budgets it cannot edit.
 */
export function TourAnchor({ step, readOnly, children }: {
  step: ReportStep;
  readOnly: boolean;
  children: ReactNode;
}) {
  if (readOnly) {
    if (step === 'vista') return <div data-tour="sec.budgets-reporte-finanzas.vista">{children}</div>;
    if (step === 'cobro') return <div data-tour="sec.budgets-reporte-finanzas.cobro">{children}</div>;
    if (step === 'reparto') return <div data-tour="sec.budgets-reporte-finanzas.reparto">{children}</div>;
    return <div data-tour="sec.budgets-reporte-finanzas.documento">{children}</div>;
  }
  if (step === 'vista') return <div data-tour="sec.budgets-reporte.vista">{children}</div>;
  if (step === 'cobro') return <div data-tour="sec.budgets-reporte.cobro">{children}</div>;
  if (step === 'reparto') return <div data-tour="sec.budgets-reporte.reparto">{children}</div>;
  return <div data-tour="sec.budgets-reporte.documento">{children}</div>;
}

/** One of the four leading figures: display value, mono label, optional aside. */
export function Figure({ value, label, aside, tone = 'ink', sheet = false, last = false }: {
  value: ReactNode;
  label: ReactNode;
  aside?: ReactNode;
  tone?: 'ink' | 'orange' | 'green';
  /** Paints the cell on #FBF8F2 — the one figure the view is about. */
  sheet?: boolean;
  last?: boolean;
}) {
  return (
    <div className={cn('px-5 py-[13px]', !last && 'border-r border-[#EDE7DB]', sheet && 'bg-[#FBF8F2]')}>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'font-bt-display font-extrabold text-[30px] md:text-[36px] leading-[0.85] tabular-nums',
            tone === 'orange' && 'text-[#C2410C]',
            tone === 'green' && 'text-[#2E7D4F]',
            tone === 'ink' && 'text-[#0B0A09]',
          )}
        >
          {value}
        </span>
        {aside && <Mono className="text-[10px] tracking-[0.08em] text-[#5A5346]">{aside}</Mono>}
      </div>
      <Mono className="block text-[10px] tracking-[0.1em] text-[#5A5346] mt-[5px] leading-[1.35]">{label}</Mono>
    </div>
  );
}

/** The strip the four figures sit in. Orange top edge while a filter is on. */
export function FigureStrip({ filtered, children, ...rest }: {
  filtered: boolean;
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.05fr] bg-white border border-[#E7E1D5]',
        filtered && 'border-t-[3px] border-t-[#F97316]',
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

const FILL: Record<GaugeTone, string> = {
  ok: 'bg-[#0B0A09]',
  limit: 'bg-[#F97316]',
  over: 'bg-[#B3402A]',
};
const TEXT: Record<GaugeTone, string> = {
  ok: 'text-[#5A5346]',
  limit: 'text-[#C2410C]',
  over: 'text-[#B3402A]',
};

/**
 * The spend gauge, which always says what it is dividing by.
 *
 * Three signals when it falls back to the contract, not one — dotted border,
 * faded fill, an orange caption naming the denominator — because a single one
 * disappears in a row of four money columns, and a gauge without a declared
 * denominator is the quickest way to lie with a bar.
 */
export function Gauge({ pctValue, fallback, lang, note }: {
  pctValue: number;
  /** True when there is no cost budget and the contract is standing in. */
  fallback: boolean;
  lang: string;
  note?: ReactNode;
}) {
  const { t } = useTranslation('admin');
  const tone = gaugeTone(pctValue);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <Mono className={cn('text-[12px] font-semibold tabular-nums', fallback ? 'text-[#C2410C]' : TEXT[tone])}>
          {fmtPct(pctValue, lang)} %
        </Mono>
        {note}
      </div>
      <div
        className={cn(
          'h-[7px] mt-[5px] flex bg-[#F3EEE4]',
          fallback ? 'border border-dashed border-[#F97316]' : 'border border-[#EDE7DB]',
        )}
      >
        <div
          className={cn('h-full', fallback ? 'bg-[#B4A992]' : FILL[tone])}
          style={{ width: `${Math.min(Math.max(pctValue, 0), 100)}%` }}
        />
      </div>
      <Mono className={cn('block text-[9px] tracking-[0.08em] mt-[3px]', fallback ? 'text-[#C2410C]' : 'text-[#A69C8D]')}>
        {t(fallback ? 'budgets.gauge.againstContract' : 'budgets.gauge.againstCost')}
      </Mono>
    </div>
  );
}

/** Collected over invoiced. Ink until it is paid off; the only green in the table. */
export function CollectionBar({ pctValue, lang }: { pctValue: number; lang: string }) {
  const done = pctValue >= 100;
  return (
    <div>
      <Mono className="block text-[10.5px] text-[#5A5346] tabular-nums">{fmtPct(pctValue, lang)} %</Mono>
      <div className="h-[7px] mt-1 flex bg-[#F3EEE4] border border-[#EDE7DB]">
        <div className={cn('h-full', done ? 'bg-[#2E7D4F]' : 'bg-[#0B0A09]')} style={{ width: `${Math.min(pctValue, 100)}%` }} />
      </div>
    </div>
  );
}

/**
 * Read only, once.
 *
 * The chip it replaces was `bg-purple-50 text-purple-600` — a fifth accent
 * that belongs to nobody — and it said one word. This says what finance CAN
 * do, and appears once at the top: a screen that announces "read only" six
 * times is a screen that has not made up its mind.
 */
export function ReadOnlyNote() {
  const { t } = useTranslation('admin');
  return (
    <div className="inline-flex items-start gap-2.5 border border-[#0A0A0A] bg-white px-3 py-2.5 max-w-[420px]">
      <Lock className="w-3.5 h-3.5 text-[#0A0A0A] mt-[1px] flex-shrink-0" strokeWidth={2.2} />
      <div className="min-w-0">
        <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A]">{t('budgets.readOnly.title')}</Mono>
        <span className="block text-[12px] leading-[1.45] text-[#5A5346] mt-1">{t('budgets.readOnly.body')}</span>
      </div>
    </div>
  );
}

/**
 * A load that failed, and stays failed.
 *
 * Never a toast: it fades after four seconds and leaves a blank table behind,
 * which reads as "you have no jobsites" — the worse of the two lies. The
 * figures fall to an em dash rather than to $0, and the technical code is
 * folded away for support instead of being the headline.
 */
export function LoadFailure({ title, body, code, onRetry, secondary }: {
  title: string;
  body: string;
  code: string;
  onRetry: () => void;
  secondary?: ReactNode;
}) {
  const { t } = useTranslation('admin');
  return (
    <div className="space-y-2.5">
      <div className="bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#B3402A] px-4 py-[15px]">
        <div className="flex items-start gap-3 flex-wrap">
          <span className="font-bt-display font-extrabold text-[22px] leading-none text-[#B3402A] mt-[1px]" aria-hidden="true">!</span>
          <div className="min-w-0 flex-1">
            <div className="font-bt-heading font-bold text-[15px] text-[#0A0A0A]">{title}</div>
            <p className="text-[13px] leading-[1.5] text-[#5A5346] mt-1">{body}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <PrimaryButton onClick={onRetry}>{t('budgets.retry')}</PrimaryButton>
            {secondary}
          </div>
        </div>
      </div>
      <details className="bg-white border border-[#E7E1D5] px-4 py-2.5">
        <summary className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A8175] cursor-pointer', FOCUS_RING)}>
          {t('budgets.support')}
        </summary>
        <Mono className="block text-[10px] text-[#5A5346] mt-2 break-all normal-case">{code}</Mono>
      </details>
    </div>
  );
}

/** The heading of one block: display title, mono hint, optional right-hand chip. */
export function BlockHead({ title, hint, right, className }: {
  title: ReactNode;
  hint?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3.5 flex-wrap px-[18px] pt-[11px] pb-[9px]', className)}>
      <div className="flex items-baseline gap-2.5 flex-wrap min-w-0">
        <span className="font-bt-display font-extrabold text-[20px] md:text-[22px] leading-none uppercase text-[#0B0A09]">{title}</span>
        {hint && <Mono className="text-[9.5px] tracking-[0.1em] text-[#8A8175]">{hint}</Mono>}
      </div>
      {right}
    </div>
  );
}

/** Orange-outlined count chip of a block head. */
export function CountChip({ children, tone = 'orange' }: { children: ReactNode; tone?: 'orange' | 'sand' }) {
  return (
    <Mono
      className={cn(
        'text-[9.5px] tracking-[0.1em] px-2 py-1 whitespace-nowrap',
        tone === 'orange' ? 'bg-[#FBEDE0] border border-[#F97316] text-[#C2410C]' : 'text-[#8A8175]',
      )}
    >
      {children}
    </Mono>
  );
}

/** A money cell: mono, right-aligned, tabular. */
export function Amount({ children, tone = 'ink', className }: {
  children: ReactNode;
  tone?: 'ink' | 'orange' | 'green' | 'red' | 'quiet';
  className?: string;
}) {
  return (
    <Mono
      className={cn(
        'text-[12.5px] text-right tabular-nums normal-case',
        tone === 'orange' && 'font-semibold text-[#C2410C]',
        tone === 'green' && 'font-semibold text-[#2E7D4F]',
        tone === 'red' && 'font-semibold text-[#B3402A]',
        tone === 'quiet' && 'text-[#A69C8D]',
        tone === 'ink' && 'text-[#0B0A09]',
        className,
      )}
    >
      {children}
    </Mono>
  );
}

/** Jobsite name over its client and cost code — the first cell of every table. */
export function JobsiteCell({ name, client, costCode }: { name: string; client: string | null; costCode: string | null }) {
  const sub = [client, costCode].filter(Boolean).join(' · ');
  return (
    <div className="min-w-0">
      <div className="text-[14px] font-semibold text-[#0B0A09] truncate">{name}</div>
      {sub && <Mono className="block text-[10px] tracking-[0.04em] text-[#A69C8D] mt-0.5 truncate">{sub}</Mono>}
    </div>
  );
}

/** Sand skeleton bars — the 1.4 s sweep, four figure cells and four rows. */
export function TableSkeleton({ rows = 4, cols }: { rows?: number; cols: string }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-3 items-center px-[18px] py-3 border-b border-[#F0EBE1]" style={{ gridTemplateColumns: cols }}>
          {Array.from({ length: cols.split(' ').length }).map((__, j) => (
            <div key={j} className="bt-skeleton h-3" />
          ))}
        </div>
      ))}
    </div>
  );
}

export { SecondaryButton };
