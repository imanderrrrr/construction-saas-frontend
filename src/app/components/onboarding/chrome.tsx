import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../ui/utils';

/**
 * Chrome shared by the four guide windows — the welcome, the tour card, the
 * section banner and the what's-new carousel. Ported from the Claude Design
 * sheet "Onboarding BuildTrack" (2026-09-03): ink bar with the blueprint grid,
 * three button tiers, the square close and the segment strip live HERE so the
 * windows cannot drift apart from each other, or from the panel they sit on.
 *
 * Radius is 0 everywhere. The panel's controls are square; so are these.
 */

/** Window shadow, identical on all four. */
export const WINDOW_SHADOW = 'shadow-[0_16px_48px_rgba(23,19,15,0.3)]';

/** Focus ring on every control: 2 px orange, 3 px off the edge. Never removed. */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[#F97316] focus-visible:outline-offset-[3px]';

/** Blueprint grid over ink — the motif of the dashboard hero and the sidebar plate. */
export function inkGrid(size: number): CSSProperties {
  return {
    backgroundImage:
      'linear-gradient(rgba(245,241,232,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(245,241,232,0.055) 1px, transparent 1px)',
    backgroundSize: `${size}px ${size}px`,
  };
}

/**
 * Ink surface with the grid painted underneath. Callers put `relative` on
 * their own content so it renders above the grid layer.
 */
export function InkBar({ grid = 26, className, children }: {
  grid?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('relative overflow-hidden bg-[#0A0A0A] text-[#F5F1E8]', className)}>
      <div className="absolute inset-0 pointer-events-none" style={inkGrid(grid)} aria-hidden="true" />
      {children}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

const MONO_BUTTON =
  'inline-flex items-center justify-center gap-2 font-bt-mono font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none';

/** Orange, white text. The one action the window wants. */
export function PrimaryButton({ className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(MONO_BUTTON, 'bg-[#F97316] hover:bg-[#EA580C] text-white text-[11px] px-4 py-2.5', FOCUS_RING, className)}
      {...rest}
    />
  );
}

/** Bordered, transparent. Hover turns the border and the text orange. */
export function SecondaryButton({ className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        MONO_BUTTON,
        'bg-transparent border border-[#DBD0BB] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] text-[11px] px-3.5 py-2.5',
        FOCUS_RING,
        className,
      )}
      {...rest}
    />
  );
}

/** Text only — "Saltar recorrido". */
export function TertiaryButton({ className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'font-bt-mono text-[9.5px] font-medium uppercase tracking-[0.1em] whitespace-nowrap flex-shrink-0 text-[#8A8175] hover:text-[#C2410C] transition-colors',
        FOCUS_RING,
        className,
      )}
      {...rest}
    />
  );
}

/**
 * Square close: 28 px with a 1 px border (32 px on phones — pass the size via
 * className). `onDark` is the ink-bar variant; the default sits on paper.
 */
export function CloseButton({ onDark = false, className, type = 'button', ...rest }: ButtonProps & { onDark?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        'w-7 h-7 flex items-center justify-center flex-shrink-0 border transition-colors',
        onDark
          ? 'border-[rgba(245,241,232,0.3)] bg-transparent text-[#F5F1E8] hover:border-[#F97316] hover:text-[#F97316]'
          : 'border-[#DBD0BB] bg-white text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]',
        FOCUS_RING,
        className,
      )}
      {...rest}
    >
      <X className="w-[13px] h-[13px]" strokeWidth={2} strokeLinecap="square" />
    </button>
  );
}

/**
 * Segment strip: one 3 px bar per stop. Current is orange; on ink the ones
 * behind are bone at 40 % and the ones ahead bone at 18 %; on paper the ones
 * behind stay orange and the ones ahead are sand. With `onPick` each segment
 * is a button (the carousel), otherwise it is decorative.
 */
export function Segments({ total, index, onDark = false, width = 14, onPick, labelFor }: {
  total: number;
  index: number;
  onDark?: boolean;
  width?: 12 | 14;
  onPick?: (i: number) => void;
  labelFor?: (i: number) => string;
}) {
  const w = width === 12 ? 'w-3' : 'w-3.5';
  return (
    <div className="flex gap-1" aria-hidden={onPick ? undefined : true}>
      {Array.from({ length: total }, (_, i) => {
        const state = i === index ? 'current' : i < index ? 'done' : 'todo';
        const color = onDark
          ? state === 'current' ? 'bg-[#F97316]' : state === 'done' ? 'bg-[rgba(245,241,232,0.4)]' : 'bg-[rgba(245,241,232,0.18)]'
          : state === 'todo' ? 'bg-[#DBD0BB]' : 'bg-[#F97316]';
        const bar = cn('block h-[3px]', w, color);
        if (!onPick) return <span key={i} className={bar} />;
        return (
          <button
            key={i}
            type="button"
            aria-label={labelFor?.(i)}
            aria-current={i === index}
            onClick={() => onPick(i)}
            // The bar is 3 px tall: a pseudo-element widens the hit area
            // without changing what is drawn.
            className={cn(bar, "relative p-0 border-0 cursor-pointer before:absolute before:-inset-y-2 before:-inset-x-0.5 before:content-['']", FOCUS_RING)}
          />
        );
      })}
    </div>
  );
}
