import type { ReactNode } from 'react';
import { cn } from '../ui/utils';
import { Mono } from '../projects/bt';
import { daysTone } from './bits';

/**
 * The pieces the four blocks share.
 *
 * Everything visual that is not a table cell lives here: the numbered block
 * heading, the share bar, the days chip and the fill colours of the six
 * states. The names of the states and the categories are NOT here — they come
 * from the shared `tools.*` catalogue, which this screen used to own and has
 * now handed over.
 */

/** The fill of a share bar, by state. Green is a state, never a button. */
export const STATUS_FILL: Record<string, string> = {
  'Available': '#2E7D4F',
  'Assigned': '#0B0A09',
  'Pending Acceptance': '#F97316',
  'In Review': '#5A5346',
  'Damaged': '#B3402A',
  'Lost': '#B3402A',
};

export const STATUS_EDGE: Record<string, string> = {
  'Available': '#2E7D4F',
  'Assigned': '#0B0A09',
  'Pending Acceptance': '#F97316',
  'In Review': '#8A8175',
  'Damaged': '#B3402A',
  'Lost': '#B3402A',
};

/** A numbered block heading: the number, the title and a note beside it. */
export function BlockHead({ n, title, note, tone = 'ink', right }: {
  n: number;
  title: string;
  note?: string;
  tone?: 'ink' | 'orange';
  right?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 flex-wrap mb-2.5">
      <div className="flex items-baseline gap-2.5 min-w-0">
        <span
          className={cn(
            'font-bt-mono text-[10px] font-semibold w-[19px] h-[19px] inline-flex items-center justify-center flex-shrink-0 translate-y-[1px]',
            tone === 'orange' ? 'bg-[#F97316] text-[#0B0A09]' : 'bg-[#0B0A09] text-[#F5F1E8]',
          )}
        >
          {n}
        </span>
        <h3 className="font-bt-display font-extrabold uppercase text-[22px] md:text-[24px] leading-none text-[#0B0A09]">{title}</h3>
        {note && <Mono className="text-[9.5px] tracking-[0.09em] text-[#8A8175] hidden sm:inline">{note}</Mono>}
      </div>
      {right}
    </div>
  );
}

/**
 * A share bar.
 *
 * Linear over the filtered universe, no animation, and a 0 % is drawn as an
 * empty bar rather than hidden: a category with no lost tools is a fact worth
 * seeing, and removing the row would make the table look like it has five
 * states again.
 */
export function Bar({ tenths, fill = '#0B0A09', className }: { tenths: number; fill?: string; className?: string }) {
  return (
    <div className={cn('h-[7px] bg-[#F3EEE4] border border-[#EDE7DB] min-w-[40px]', className)} aria-hidden="true">
      <div className="h-full" style={{ width: `${tenths / 10}%`, background: fill }} />
    </div>
  );
}

/**
 * How long a tool has been out.
 *
 * Calm is ink on nothing — a number nobody has to act on needs no colour.
 * Past a week it is orange on orange paper; past a month, white on solid red,
 * which stays legible in a photocopy.
 */
export function DaysChip({ days, suffix }: { days: number | null; suffix?: string }) {
  if (days == null) return <Mono className="text-[11px] text-[#A69C8D]">—</Mono>;
  const tone = daysTone(days);
  const text = suffix ? `${days} ${suffix}` : String(days);
  if (tone === 'calm') {
    return <Mono className="text-[11px] font-semibold tabular-nums text-[#0B0A09]">{text}</Mono>;
  }
  return (
    <Mono
      className={cn(
        'text-[11px] font-semibold tabular-nums inline-block whitespace-nowrap',
        tone === 'warn'
          ? 'bg-[#FBEDE0] border border-[#F97316] text-[#C2410C] px-1.5 py-[3px]'
          : 'bg-[#B3402A] text-white px-[7px] py-1',
      )}
    >
      {text}
    </Mono>
  );
}

/** The head of an aggregate table: mono, small, on sheet. */
export function TableHead({ grid, children }: { grid: string; children: ReactNode }) {
  return (
    <div className={cn(grid, 'px-4 h-[26px] items-center bg-[#FBF8F2] border-b border-[#EDE7DB] font-bt-mono text-[9px] uppercase tracking-[0.12em] text-[#A69C8D]')}>
      {children}
    </div>
  );
}

/**
 * The closing row of an aggregate table.
 *
 * The only row with a ground of its own, because it is the one that has to be
 * checked: it says the total and, when a filter is on, what it is a total of.
 */
export function TotalRow({ grid, label, note, children }: {
  grid: string;
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(grid, 'px-4 py-2 bg-[#F3EEE4] border-t border-[#DBD0BB]')}>
      <Mono className="text-[9.5px] font-semibold tracking-[0.11em] text-[#0B0A09] uppercase">{label}</Mono>
      {children}
      {note && <Mono className="text-[9px] tracking-[0.08em] text-[#8A8175] hidden xl:block">{note}</Mono>}
    </div>
  );
}

/** A panel: white on the rule, the ground every block sits on. */
export function Panel({ children, className, ...rest }: {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-white border border-[#E7E1D5]', className)} {...rest}>{children}</div>;
}
