import type { KeyboardEvent, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../ui/utils';
import { Mono } from '../projects/bt';
import { BlockHead } from '../budgets/ui';
import { FOCUS_RING, PrimaryButton } from '../onboarding/chrome';
import { fmtCents } from '../invoices/bits';

/**
 * The small pieces the two QuickBooks screens share, in the redesign's
 * language (Claude Design "Proyectos / Presupuestos BuildTrack", 2026-09):
 * square, sand borders, mono labels, orange only where it asks for attention,
 * #B3402A only where something is wrong.
 */

/** A white panel with the block heading on top — every card of the section. */
export function Block({ title, hint, right, children, className, testId }: {
  title: ReactNode;
  hint?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cn('bg-white border border-[#E7E1D5]', className)} data-testid={testId}>
      <BlockHead title={title} hint={hint} right={right} className="border-b border-[#EDE7DB]" />
      {children}
    </section>
  );
}

/**
 * A notice with a coloured left edge: what happened, what is wrong, what this
 * does. Paper for information and success, white with a red edge for errors —
 * the same two shapes PaperNote and LoadFailure use elsewhere.
 */
export function Band({ tone, title, children, role, testId }: {
  tone: 'success' | 'danger' | 'info';
  title?: ReactNode;
  children: ReactNode;
  role?: string;
  testId?: string;
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' ? AlertTriangle : Info;
  return (
    <div
      role={role}
      data-testid={testId}
      className={cn(
        'flex items-start gap-3 border px-4 py-[13px] text-[13px] leading-[1.5]',
        tone === 'success' && 'bg-[#FAF7F0] border-[#EDE7DB] border-l-[3px] border-l-[#F97316] text-[#43301F]',
        tone === 'info' && 'bg-[#FAF7F0] border-[#EDE7DB] border-l-[3px] border-l-[#CDBFA6] text-[#43301F]',
        tone === 'danger' && 'bg-white border-[#E7E1D5] border-l-[3px] border-l-[#B3402A] text-[#0A0A0A]',
      )}
    >
      <Icon
        className={cn('mt-[2px] h-[15px] w-[15px] flex-shrink-0', tone === 'danger' ? 'text-[#B3402A]' : tone === 'success' ? 'text-[#F97316]' : 'text-[#8A8175]')}
        strokeWidth={1.9}
        aria-hidden="true"
      />
      <div className="min-w-0">
        {title && (
          <Mono className={cn('block text-[10px] font-semibold tracking-[0.14em] mb-1', tone === 'danger' ? 'text-[#B3402A]' : 'text-[#C2410C]')}>
            {title}
          </Mono>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** The one-word state of the link, with its square light. */
export function StateChip({ state, label }: { state: 'NOT_CONNECTED' | 'ACTIVE' | 'NEEDS_RECONNECT'; label: string }) {
  const tone = state === 'ACTIVE' ? 'text-[#2E7D4F]' : state === 'NEEDS_RECONNECT' ? 'text-[#B3402A]' : 'text-[#8A8175]';
  const light = state === 'ACTIVE' ? 'bg-[#2E7D4F] border-[#2E7D4F]' : state === 'NEEDS_RECONNECT' ? 'bg-[#B3402A] border-[#B3402A]' : 'bg-transparent border-[#A69C8D]';
  return (
    // A plain span rather than <Mono>: it has to carry the test id, and Mono
    // forwards nothing but className.
    <span className={cn('inline-flex items-center gap-2 font-bt-mono uppercase text-[10px] font-semibold tracking-[0.12em] whitespace-nowrap', tone)} data-testid="quickbooks-state">
      <span aria-hidden="true" className={cn('inline-block h-2.5 w-2.5 border', light)} />
      {label}
    </span>
  );
}

/** A sand tag: the environment, the country, "created from here". */
export function Tag({ children, tone = 'sand' }: { children: ReactNode; tone?: 'sand' | 'red' | 'orange' }) {
  return (
    <Mono
      className={cn(
        'inline-block text-[9.5px] tracking-[0.1em] px-2 py-1 whitespace-nowrap border',
        tone === 'sand' && 'bg-[#FAF7F0] border-[#DBD0BB] text-[#5A5346]',
        tone === 'orange' && 'bg-[#FBEDE0] border-[#F97316] text-[#C2410C]',
        tone === 'red' && 'bg-white border-[#B3402A] text-[#B3402A]',
      )}
    >
      {children}
    </Mono>
  );
}

/** One fact of the connected company: mono label over the value. */
export function Fact({ label, children, strong = false, mono = false }: {
  label: string; children: ReactNode; strong?: boolean; mono?: boolean;
}) {
  return (
    <div className={cn('border-b border-[#EDE7DB] px-4 py-3 sm:[&:nth-last-child(-n+2)]:border-b-0', strong && 'bg-[#FBF8F2]')}>
      <Mono className="block text-[9.5px] tracking-[0.12em] text-[#8A8175]">{label}</Mono>
      <div className={cn('mt-1 break-words text-[#0A0A0A]', mono ? 'font-bt-mono text-[12.5px] tracking-[0.04em]' : 'text-[13.5px]', strong && 'font-semibold')}>
        {children}
      </div>
    </div>
  );
}

/** A title and an explanation, for the states that need words rather than facts. */
export function Explain({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-bt-heading font-bold text-[15px] text-[#0A0A0A]">{title}</p>
      <p className="mt-1.5 max-w-[640px] text-[13px] leading-[1.55] text-[#5A5346]">{children}</p>
    </div>
  );
}

/** A load that failed and stays failed — no toast that fades and leaves a blank behind. */
export function LoadFailed({ title, body, retryLabel, onRetry, testId }: {
  title: string; body: string; retryLabel: string; onRetry: () => void; testId?: string;
}) {
  return (
    <div role="alert" className="bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#B3402A] px-4 py-[15px]" data-testid={testId}>
      <div className="flex items-start gap-3 flex-wrap">
        <span className="font-bt-display font-extrabold text-[22px] leading-none text-[#B3402A] mt-[1px]" aria-hidden="true">!</span>
        <div className="min-w-0 flex-1">
          <div className="font-bt-heading font-bold text-[15px] text-[#0A0A0A]">{title}</div>
          <p className="text-[13px] leading-[1.5] text-[#5A5346] mt-1">{body}</p>
        </div>
        <PrimaryButton onClick={onRetry}>{retryLabel}</PrimaryButton>
      </div>
    </div>
  );
}

/** Sand skeleton lines while a card loads. */
export function Bones({ widths }: { widths: string[] }) {
  return (
    <div className="space-y-3 px-4 py-6 md:px-[18px]" aria-busy="true" aria-hidden="true">
      {widths.map((w, i) => <div key={i} className="bt-skeleton h-3" style={{ width: w }} />)}
    </div>
  );
}

/** A square tab of the mapping block. */
/**
 * One tab. With the ARIA tabs pattern (audit B17): only the selected tab is
 * in the Tab order — the list moves with [onTabKey] — and [controls] names
 * the tabpanel it shows.
 */
export function TabButton({ active, onClick, children, id, controls }: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  id?: string;
  controls?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={cn(
        'px-3 py-3 font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] transition-colors border-b-2 -mb-px md:px-4',
        active ? 'border-[#F97316] text-[#0A0A0A]' : 'border-transparent text-[#8A8175] hover:text-[#C2410C]',
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}

/**
 * The keyboard of a tab list: the arrow keys, Home and End move to another
 * tab, select it and take the focus there (the ARIA tabs pattern).
 */
export function onTabKey<K extends string>(
  e: KeyboardEvent, keys: readonly K[], active: K, select: (key: K) => void, tabId: (key: K) => string,
): void {
  const i = keys.indexOf(active);
  const next = e.key === 'ArrowRight' ? (i + 1) % keys.length
    : e.key === 'ArrowLeft' ? (i - 1 + keys.length) % keys.length
      : e.key === 'Home' ? 0
        : e.key === 'End' ? keys.length - 1
          : null;
  if (next == null) return;
  e.preventDefault();
  select(keys[next]);
  document.getElementById(tabId(keys[next]))?.focus();
}

/** A square on/off switch in the section's grammar: filled track = on. */
export function Switch({ on, label, disabled, onToggle }: { on: boolean; label: string; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        on ? 'border-[#F97316] bg-[#F97316]' : 'border-[#DBD0BB] bg-[#FAF7F0]',
        FOCUS_RING,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute h-4 w-4 transition-all', on ? 'left-[22px] bg-white' : 'left-[3px] bg-[#DBD0BB]')}
      />
    </button>
  );
}

/**
 * `$1,234.56` in both languages, exactly as Cobrar and Pagar write it. The
 * section used Intl with es-GT, which writes «USD 1,234.56» in Spanish
 * (audit B18).
 */
export function money(cents: number): string {
  return fmtCents(cents);
}
