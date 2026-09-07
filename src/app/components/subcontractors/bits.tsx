import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';
import { Bone, Mono, MonoSelect } from '../projects/bt';
import type { InvoiceStatus, JobStatus } from '../../services/subcontractors';

/**
 * The pieces the three tabs and the ficha share (Claude Design
 * "Subcontratistas BuildTrack" + its spec sheet, 2026-09): the two status
 * chips, the empty cell, the strip of three figures and the pagination that
 * replaced one button per page.
 */

export const PAGE_SIZES = [20, 50, 100] as const;
/** The new / just-changed row's paper background and orange edge fade out in 2 s (tailwind.css `.bt-row-flash`). */
export const FLASH_MS = 2200;

const CHIP = 'inline-flex items-center font-bt-mono text-[9.5px] uppercase tracking-[0.1em] whitespace-nowrap';

/**
 * Only two job statuses carry colour: In review, because it waits on you, and
 * Observed, because it waits on them. The rest are sand or outline — six
 * equally loud chips say nothing about what needs doing.
 */
export function JobStatusChip({ status, onDark = false, className }: { status: JobStatus; onDark?: boolean; className?: string }) {
  const { t } = useTranslation(['subcontractors']);
  const look = status === 'IN_REVIEW'
    ? 'px-2 py-1 bg-[#F97316] text-[#0A0A0A] font-semibold'
    : status === 'OBSERVED'
      ? 'px-2 py-1 bg-[#FBEDE0] text-[#C2410C] font-semibold'
      : status === 'APPROVED'
        ? 'px-2 py-1 bg-[#F3EEE4] text-[#2E7D4F] font-semibold'
        : cn('border px-[7px] py-[3px]', onDark ? 'border-[rgba(245,241,232,0.4)] text-[#F5F1E8]' : 'border-[#DBD0BB] text-[#5A5346]');
  return <span className={cn(CHIP, look, className)}>{t(`subcontractors:status.${status}`)}</span>;
}

/**
 * Approved is the only solid-ink chip of the section: it is the one state in
 * which the system expects you to move money.
 *
 * An unknown status renders its raw wire value rather than a translation key.
 * PENDING_PAYMENT is the case that matters — nothing writes it, so the panel
 * dropped it from its interface and its copy went with it; if a row ever did
 * arrive in that state the reader should see PENDING_PAYMENT, not
 * `invoiceStatus.PENDING_PAYMENT`.
 */
export function InvoiceStatusChip({ status, className }: { status: InvoiceStatus; className?: string }) {
  const { t, i18n } = useTranslation(['subcontractors']);
  const key = `subcontractors:invoiceStatus.${status}`;
  const label = i18n.exists(key) ? t(key) : status;
  const look = status === 'APPROVED'
    ? 'px-2 py-1 bg-[#0A0A0A] text-[#F5F1E8] font-semibold'
    : status === 'OBSERVED'
      ? 'px-2 py-1 bg-[#FBEDE0] text-[#C2410C] font-semibold'
      : status === 'PAID'
        ? 'px-2 py-1 bg-[#F3EEE4] text-[#5A5346]'
        : 'border border-[#DBD0BB] px-[7px] py-[3px] text-[#5A5346]';
  return <span className={cn(CHIP, look, className)}>{label}</span>;
}

/** The red stamp next to a title. Overdue is not a status — it crosses with one. */
export function OverdueStamp({ className }: { className?: string }) {
  const { t } = useTranslation(['subcontractors']);
  return (
    <span className={cn('inline-flex items-center font-bt-mono text-[8.5px] font-semibold uppercase tracking-[0.12em] bg-[#B3402A] text-white px-1.5 py-[3px] whitespace-nowrap', className)}>
      {t('subcontractors:jobs.overdue')}
    </span>
  );
}

/** An empty cell: mono 10.5 px #A69C8D in uppercase — never italic, never a dash. */
export function CellEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return <Mono className={cn('text-[10.5px] tracking-[0.06em] text-[#A69C8D]', className)}>{children}</Mono>;
}

/** "$8,400.00". Cents in, tabular out. */
export function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "$28,550" — the figure strip's shorter form: no cents above a hundred dollars. */
export function fmtMoneyShort(cents: number | null | undefined): string {
  if (cents == null) return '';
  const units = cents / 100;
  return `$${units.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(units) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export interface FigureDef {
  key: string;
  value: ReactNode;
  label: ReactNode;
  /** Makes the cell a button that applies its filter. */
  onClick?: () => void;
  pressed?: boolean;
  tone?: 'ink' | 'orange';
}

/**
 * The strip of three leading figures.
 *
 * `state` is the whole point of this component. The numbers come from a server
 * summary over the entire tenant; when that call fails the cell writes an em
 * dash and stops being pressable. It is never filled in from the page on
 * screen — that arithmetic is exactly what this redesign came to remove.
 */
export function FigureStrip({ figures, state, testId, tourAnchor }: {
  figures: FigureDef[];
  state: 'loading' | 'ready' | 'failed';
  testId?: string;
  tourAnchor?: string;
}) {
  const cellValue = (value: ReactNode) => {
    if (state === 'ready') return value;
    if (state === 'failed') return <span className="text-[#CDBFA6]">—</span>;
    return <Bone className="w-16 h-8" />;
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#E7E1D5]" data-testid={testId} data-tour={tourAnchor}>
      {figures.map((f, i) => {
        const inner = (
          <>
            <div className={cn('font-bt-display font-extrabold text-[40px] leading-[0.85] tabular-nums truncate', f.tone === 'orange' ? 'text-[#C2410C]' : 'text-[#0A0A0A]')}>
              {cellValue(f.value)}
            </div>
            <Mono className="block text-[10.5px] tracking-[0.1em] text-[#5A5346] mt-[5px]">{f.label}</Mono>
          </>
        );
        const edge = i < figures.length - 1 ? 'border-b sm:border-b-0 sm:border-r border-[#EDE7DB]' : '';
        return f.onClick ? (
          <button
            key={f.key}
            type="button"
            disabled={state !== 'ready'}
            onClick={f.onClick}
            aria-pressed={f.pressed}
            className={cn(
              'text-left px-[22px] py-4 min-w-0 transition-colors disabled:cursor-default',
              state === 'ready' && (f.tone === 'orange' ? 'hover:bg-[#FBEDE0]' : 'hover:bg-[#F3EEE4]'),
              f.pressed && 'bg-[#FBEDE0] shadow-[inset_0_-3px_0_#F97316]',
              edge, FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
            )}
          >
            {inner}
          </button>
        ) : (
          <div key={f.key} className={cn('px-[22px] py-4 min-w-0', edge)}>{inner}</div>
        );
      })}
    </div>
  );
}

/** Range, page size and prev/next — not one button per page. */
export function Pagination({ page, pageSize, totalElements, totalPages, onPage, onPageSize }: {
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const { t } = useTranslation(['subcontractors', 'common']);
  const start = totalElements === 0 ? 0 : page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalElements);
  const arrow = cn(
    'w-[30px] h-[30px] border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0A0A0A]',
    'hover:border-[#F97316] hover:text-[#C2410C] disabled:text-[#B4A992] disabled:hover:border-[#DBD0BB]',
    FOCUS_RING,
  );
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap pb-2">
      <Mono className="text-[10.5px] tracking-[0.06em] text-[#8A8175]">
        {t('subcontractors:range', { start, end, total: totalElements })}
      </Mono>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-[7px]">
          <Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">{t('subcontractors:perPage')}</Mono>
          <MonoSelect value={pageSize} onChange={e => onPageSize(Number(e.target.value))} className="px-[9px] py-1.5" aria-label={t('subcontractors:perPage')}>
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </MonoSelect>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0} aria-label={t('common:buttons.prev')} className={arrow}>
            <ChevronLeft className="w-3 h-3" strokeWidth={2.4} />
          </button>
          <Mono className="text-[11px] tracking-[0.06em] text-[#0A0A0A] min-w-[104px] text-center">
            {t('subcontractors:page', { current: page + 1, total: Math.max(totalPages, 1) })}
          </Mono>
          <button type="button" onClick={() => onPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} aria-label={t('common:buttons.next')} className={arrow}>
            <ChevronRight className="w-3 h-3" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** "03 SEPT 2026 · 08:12" — the stamp under a note and a history row. */
export function stampDateTime(iso: string, lang: string): string {
  try {
    const d = new Date(iso);
    const locale = lang.startsWith('es') ? 'es-GT' : 'en-US';
    const date = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').toUpperCase();
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} · ${time}`;
  } catch {
    return iso;
  }
}

/** A bare business date ("2026-09-12") gets a local midnight, not a UTC one. */
export function parseBusinessDate(iso: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
}

/** "12 sept 2026" — dates inside the ficha, in sentence case. */
export function softDate(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  try {
    return parseBusinessDate(iso)
      .toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
      .replace(/\./g, '');
  } catch {
    return iso;
  }
}
