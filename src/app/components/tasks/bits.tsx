import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';
import { Mono } from '../projects/bt';
import type { TaskPriority, TaskStatus } from '../../services/tasks';
import { initials } from './grouping';

/**
 * The pieces the list, the week and the windows share (Claude Design "Tareas
 * BuildTrack" + its spec sheet, 2026-09).
 *
 * The colour rules of this section, in one place because they are the whole
 * argument: green is a state and never a button, red is what is late and what
 * destroys, and orange is what is due now.
 */

/** Left edge of a row: the priority, 3 px. */
export const PRIORITY_EDGE: Record<TaskPriority, string> = {
  URGENT: '#B3402A',
  HIGH: '#F97316',
  MEDIUM: '#8A8175',
  LOW: '#CDBFA6',
};

/** Two-letter mark of a step, for the week's bars: PH · EP · RV · CP. */
export const STEP_MARK: Record<TaskStatus, { es: string; en: string }> = {
  TODO: { es: 'PH', en: 'TD' },
  IN_PROGRESS: { es: 'EP', en: 'IP' },
  REVIEW: { es: 'RV', en: 'RV' },
  DONE: { es: 'CP', en: 'DN' },
};

const CHIP = 'inline-flex items-center font-bt-mono text-[9px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap px-[7px] py-1';

/**
 * The step, as a chip. Only two carry colour — In progress, because it is
 * moving, and Completed, because it is done — and the green is a state, never
 * something you can press.
 */
export function StepChip({ status, className }: { status: TaskStatus; className?: string }) {
  const { t } = useTranslation(['tasks']);
  const look = {
    TODO: 'bg-[#F3EEE4] text-[#5A5346]',
    IN_PROGRESS: 'bg-[#FBEDE0] text-[#C2410C]',
    REVIEW: 'bg-[#F3EEE4] text-[#0B0A09]',
    DONE: 'bg-[#FAF7F0] text-[#2E7D4F]',
  }[status];
  return <span className={cn(CHIP, look, className)}>{t(`tasks:step.${status}`)}</span>;
}

/** A person's initials in a square. `muted` is the one nobody owns. */
export function Avatar({ name, size = 22, className }: { name: string | null; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center flex-shrink-0 font-bt-mono font-semibold uppercase',
        name ? 'bg-[#0B0A09] text-[#F5F1E8]' : 'bg-[#F3EEE4] text-[#A69C8D]',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {name ? initials(name) : '—'}
    </span>
  );
}

/** An empty cell: mono, sand, uppercase. Never a dash, never italic. */
export function CellEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return <Mono className={cn('text-[10px] tracking-[0.06em] text-[#A69C8D]', className)}>{children}</Mono>;
}

/** The button that names the next step. Orange only in the group that is due today. */
export function StepButton({ label, urgent = false, className, ...rest }: {
  label: string;
  urgent?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-bt-mono text-[9px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap',
        'px-[9px] h-[30px] md:h-[30px] transition-colors border',
        urgent
          ? 'bg-[#F97316] border-[#F97316] text-[#0B0A09] hover:bg-[#C2410C] hover:text-[#F5F1E8]'
          : 'bg-[#FAF7F0] border-[#DBD0BB] text-[#0B0A09] hover:bg-[#F97316] hover:border-[#F97316]',
        'disabled:bg-[#EAE4D8] disabled:text-[#A69C8D] disabled:border-transparent disabled:cursor-not-allowed',
        FOCUS_RING,
        className,
      )}
      {...rest}
    >
      {label}
    </button>
  );
}

/** The group header: bone on ink, with its note and its count. */
export function GroupHeader({ label, note, right, tourAnchor }: {
  label: string;
  note?: string;
  right?: ReactNode;
  tourAnchor?: string;
}) {
  return (
    <div
      data-tour={tourAnchor}
      className="flex items-center justify-between gap-3 bg-[#0B0A09] px-4 md:px-5 py-[6px] min-h-[24px]"
    >
      <Mono className="text-[9.5px] font-semibold tracking-[0.13em] text-[#F5F1E8]">{label}</Mono>
      <div className="flex items-center gap-3">
        {note && <Mono className="text-[9px] tracking-[0.1em] text-[#A69C8D] hidden sm:block">{note}</Mono>}
        {right}
      </div>
    </div>
  );
}

/** The one-row grey line an always-shown group draws when it is empty. */
export function GroupEmptyLine({ children }: { children: ReactNode }) {
  return (
    <div className="h-[38px] flex items-center px-4 md:px-5 bg-[#FBF8F2] border-b border-[#F0EBE1]">
      <Mono className="text-[10px] tracking-[0.06em] text-[#A69C8D]">{children}</Mono>
    </div>
  );
}

/** "Vie 11 sep" — the list's due-date stamp. */
export function stampDue(iso: string, lang: string): string {
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
    return d
      .toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })
      .replace(/\./g, '');
  } catch {
    return iso;
  }
}

/** "5 sep" — the shorter form, for what is already late. */
export function stampShort(iso: string, lang: string): string {
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
    return d.toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { day: 'numeric', month: 'short' }).replace(/\./g, '');
  } catch {
    return iso;
  }
}

/** "lunes 7 de septiembre" — the eyebrow's date. */
export function stampLongDay(date: Date, lang: string): string {
  return date.toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** "7 sep 2026 · 16:40" — comments and history. */
export function stampDateTime(iso: string, lang: string): string {
  try {
    const d = new Date(iso);
    const locale = lang.startsWith('es') ? 'es-GT' : 'en-US';
    return `${d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '')} · ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  } catch {
    return iso;
  }
}

/** An ISO business date ("2026-09-12") for a `<input type="date">`. */
export function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
