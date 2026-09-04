import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';

/**
 * Building blocks of the redesigned Projects section (Claude Design
 * "Proyectos BuildTrack", 2026-09). Everything is square, mono-labelled and
 * orange only where it asks for attention; the buttons come from
 * onboarding/chrome so the section cannot drift from the guide windows.
 */

/** Mono micro-label: kickers, table headers, field labels. */
export function Mono({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('font-bt-mono uppercase', className)}>{children}</span>;
}

/** Field label above an input: mono 9.5–10 px, tracking .12em. */
export function FieldLabel({ htmlFor, required, className, children }: {
  htmlFor?: string; required?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={cn('block font-bt-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5A5346] mb-1.5', className)}>
      {children}
      {required && <span className="text-[#F97316]"> *</span>}
    </label>
  );
}

/** Help line under a field: mono 9.5 px, tenue. */
export function FieldHint({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn('font-bt-mono text-[9.5px] tracking-[0.04em] uppercase text-[#A69C8D] mt-[5px] leading-[1.4]', className)}>{children}</p>;
}

/** Field error: mono 9.5 px, bold, #C2410C. */
export function FieldError({ children }: { children: ReactNode }) {
  return <p className="font-bt-mono text-[9.5px] tracking-[0.04em] uppercase font-semibold text-[#C2410C] mt-[5px]">{children}</p>;
}

/** The section's input look: 40 px, sand border, orange on focus. */
export const INPUT =
  'w-full h-10 border border-[#DBD0BB] bg-white px-3 text-sm text-[#0A0A0A] outline-none placeholder:text-[#A69C8D] focus:border-[#F97316] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[#F97316] focus-visible:outline-offset-2 disabled:bg-[#F3EEE4] disabled:text-[#8A8175]';
export const INPUT_ERROR = 'border-[#F97316]';
export const INPUT_MONO = 'font-bt-mono text-[12.5px] tracking-[0.04em]';

/** Square mono select on sand, as in the filter bars. */
export function MonoSelect({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] cursor-pointer',
        FOCUS_RING,
        className,
      )}
      {...rest}
    />
  );
}

/** "Crear" tier: ink with bone text, hover flips to orange with ink text. */
export function CreateButton({ className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 bg-[#0A0A0A] text-[#F5F1E8] hover:bg-[#F97316] hover:text-[#0A0A0A] font-bt-mono text-[11.5px] font-semibold uppercase tracking-[0.09em] whitespace-nowrap px-4 py-3 transition-colors disabled:opacity-50 disabled:pointer-events-none',
        FOCUS_RING,
        className,
      )}
      {...rest}
    />
  );
}

/** Paper panel with a coloured left edge: explanations, warnings. */
export function PaperNote({ tone = 'orange', className, children }: { tone?: 'orange' | 'red' | 'none'; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'bg-[#FAF7F0] border border-[#EDE7DB] px-[13px] py-[11px] text-[12.5px] leading-[1.5] text-[#43301F]',
        tone === 'orange' && 'border-l-[3px] border-l-[#F97316]',
        tone === 'red' && 'border-l-[3px] border-l-[#B3402A]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Empty / error state: a display word, a short title and a hint. */
export function EmptyWord({ word, title, hint, tone = 'sand', action, className }: {
  word: string; title: string; hint?: string; tone?: 'sand' | 'red'; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn('bg-white border border-[#E7E1D5] text-center px-6 py-[52px]', tone === 'red' && 'border-l-[3px] border-l-[#B3402A]', className)}>
      <div className={cn('font-bt-display font-bold text-[36px] md:text-[44px] leading-[0.9] uppercase', tone === 'red' ? 'text-[#B3402A]' : 'text-[#CDBFA6]')}>{word}</div>
      <div className="font-bt-heading font-bold text-[16px] md:text-[17px] text-[#0A0A0A] mt-3">{title}</div>
      {hint && <div className="text-[13px] text-[#8A8175] mt-1">{hint}</div>}
      {action && <div className="mt-[18px] flex justify-center">{action}</div>}
    </div>
  );
}

/** A skeleton bar. Width via className. */
export function Bone({ className }: { className?: string }) {
  return <div className={cn('bt-skeleton h-3', className)} aria-hidden="true" />;
}

/** "14 FEB 26" — the list's stamp style for dates. */
export function stampDate(iso: string, lang: string): string {
  try {
    return new Date(iso)
      .toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { day: '2-digit', month: 'short', year: '2-digit' })
      .replace(/\./g, '')
      .toUpperCase();
  } catch {
    return iso;
  }
}

/** "03 SEPT 2026" — the header's business-date stamp. */
export function stampDay(iso: string, lang: string): string {
  try {
    return new Date(`${iso}T00:00:00`)
      .toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })
      .replace(/\./g, '')
      .toUpperCase();
  } catch {
    return iso;
  }
}
