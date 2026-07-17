import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

/**
 * Shared vocabulary for the platform console's BuildTrack skin: the class
 * recipes every screen composes from, plus the motion timings. Kept in one
 * place so the console reads as one surface instead of five hand-rolled ones.
 *
 * Colors are the bt-* tokens from src/styles/tailwind.css wherever a token
 * exists; the literal hex values below (status tints, error tints) come
 * straight from the approved Claude Design reference and have no token yet.
 */

// The `bt-up` curve from src/styles/tailwind.css, as a motion easing.
export const EASE_OUT = [0.22, 0.7, 0.25, 1] as const;

/** Container/item variant pair for staggered card & form-group entrances. */
export const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
};

export const riseIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } },
};

/** Per-row entrance with a capped delay so long tables don't crawl. */
export function rowDelay(index: number): number {
  return Math.min(index, 10) * 0.03;
}

// ── Surfaces ────────────────────────────────────────────────────

export const cardCx =
  'rounded-xl border border-bt-rule bg-white shadow-[0_1px_2px_rgba(23,19,15,0.04)]';

/** Mono uppercase table-column header. */
export const colHeadCx =
  'font-bt-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-bt-muted-2';

/** Mono uppercase micro-label (section eyebrows, "AS OF …" chips). */
export const microLabelCx =
  'font-bt-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-bt-muted-2';

/** Mono identifier chip (slugs, usernames, audit action codes). */
export const chipCx =
  'inline-block max-w-full truncate rounded-md border border-bt-rule-2 bg-bt-paper px-2 py-0.5 font-bt-mono text-xs font-semibold text-bt-ink';

/** Screen H1 — Big Shoulders, uppercase, per the approved design. */
export const pageTitleCx =
  'font-bt-display text-[38px] font-extrabold uppercase leading-none tracking-[0.015em] text-bt-ink';

export const errorBoxCx =
  'rounded-lg border border-[#EEC4B2] bg-[#FAEDE7] px-4 py-3 text-sm text-[#B42318]';

// ── Form fields ─────────────────────────────────────────────────

export const labelCx = 'text-[13px] font-semibold text-bt-ink';

export const hintCx = 'text-[12.5px] leading-[1.45] text-bt-muted';

const inputBaseCx =
  'h-[38px] w-full rounded-lg border px-3 text-bt-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-bt-muted-2 focus:border-bt-orange focus:shadow-[0_0_0_3px_rgba(249,115,22,0.18)] disabled:opacity-60';

/**
 * Field input classes. Border/background pairs are branch-exclusive rather
 * than appended: two same-property Tailwind utilities on one element resolve
 * by stylesheet order, not className order, so an appended error tint can
 * silently lose to the base `bg-white`.
 */
export function fieldInputCx({ invalid = false, mono = false }: { invalid?: boolean; mono?: boolean } = {}): string {
  return `${inputBaseCx} ${mono ? 'font-bt-mono text-[13px]' : 'font-bt-body text-sm'} ${
    invalid ? 'border-[#E7B9A6] bg-[#FBF1EC]' : 'border-bt-rule bg-white'
  }`;
}

export const inputCx = fieldInputCx();
export const monoInputCx = fieldInputCx({ mono: true });

/** Border/background pair for an input currently failing validation. */
export const inputErrTintCx = 'border-[#E7B9A6] bg-[#FBF1EC]';

// ── Buttons ─────────────────────────────────────────────────────

const btnBaseCx =
  'inline-flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded-lg font-bt-body text-[13.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 motion-safe:active:scale-[0.99]';

export const primaryBtnCx = `${btnBaseCx} border border-bt-orange-hover bg-bt-orange px-[18px] font-bold text-bt-ink shadow-[0_1px_2px_rgba(23,19,15,0.18)] hover:bg-bt-orange-hover`;

export const secondaryBtnCx = `${btnBaseCx} border border-bt-rule bg-white px-4 font-semibold text-bt-ink hover:bg-bt-paper`;

export const dangerBtnCx = `${btnBaseCx} border border-[#B42318] bg-[#B42318] px-[18px] font-semibold text-white hover:bg-[#9A1D13]`;

/** Dark-ink confirm (the design's "Suspend workspace" button). */
export const inkBtnCx = `${btnBaseCx} border border-bt-ink bg-bt-ink px-[18px] font-semibold text-bt-paper hover:bg-[#2A231C]`;

// ── Small building blocks ───────────────────────────────────────

/** Inline field error: alert-circle icon + message, per the design. */
export function FieldError({ children, role }: { children: ReactNode; role?: 'alert' }) {
  return (
    <div
      role={role}
      className="flex items-start gap-1.5 text-[12.5px] font-medium leading-snug text-[#B42318]"
    >
      <CircleAlert size={13} strokeWidth={2} className="mt-px flex-none" />
      <span>{children}</span>
    </div>
  );
}

/** Shimmering placeholder block (see platform.css; static under reduced motion). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`pc-skeleton block ${className}`} />;
}

/** The design's inline spinner (btspin) for in-flight submit buttons. */
export function ButtonSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3.5 flex-none animate-spin rounded-full border-2 border-bt-ink/30 border-t-bt-ink"
    />
  );
}
