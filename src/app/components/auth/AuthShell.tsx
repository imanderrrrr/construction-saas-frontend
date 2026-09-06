import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Building2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { cn } from '../ui/utils';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { FOCUS_RING, inkGrid } from '../onboarding/chrome';
import { INPUT, INPUT_ERROR, Mono } from '../projects/bt';

/**
 * The public composition (Claude Design "Login BuildTrack" 01 / 01C, reused
 * verbatim by "Contraseñas BuildTrack" 01–03): a fixed ink column of 592 px
 * with the blueprint grid — wordmark on top, a kicker, a display headline,
 * the orange rule, one paragraph and two seals at the foot — next to a paper
 * column with the ES/EN switch, a 404 px form and the legal foot. Under
 * 1024 px the ink column folds into an 82 px bar (wordmark + kicker) and the
 * form fills the width.
 *
 * Extracted from Login.tsx so the password pages are its siblings instead of
 * copies: same pixels, different kicker and headline. The pieces below are
 * the form vocabulary those pages share with the login (paper kicker and
 * title, the notice, the eye, the submit button, the field look).
 */

export interface InkStamp {
  /** The big display figure: "Rev 09.2026", "1 hora", "8 a 100". */
  value: ReactNode;
  /** The mono caption under it. */
  label: ReactNode;
  /** The first seal is orange on the sheet; the second, bone. */
  tone?: 'orange' | 'bone';
}

export interface AuthShellProps {
  /** Orange mono kicker: on the bar under lg and above the headline on desktop. */
  kicker: ReactNode;
  /** Display headline of the ink column (76 px). */
  heroTitle: ReactNode;
  /** The one paragraph under the rule. */
  heroBody: ReactNode;
  /** Anything under the paragraph: the invitation's role and company chips. */
  heroExtra?: ReactNode;
  /** Two seals at the foot of the column. */
  stamps: InkStamp[];
  /** The 404 px paper block. */
  children: ReactNode;
}

export function AuthShell({ kicker, heroTitle, heroBody, heroExtra, stamps, children }: AuthShellProps) {
  const { t } = useTranslation(['common']);
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FAF7F0]">
      {/* Ink column — the pitch; folds into a bar under 1024 px */}
      <aside className="relative bg-[#0A0A0A] text-[#F5F1E8] overflow-hidden flex-shrink-0 h-[82px] lg:h-auto lg:min-h-screen lg:w-[592px]">
        <div className="absolute inset-0 pointer-events-none" style={inkGrid(26)} aria-hidden="true" />

        {/* Bar (phones and tablets) */}
        <div className="relative lg:hidden h-full flex items-center justify-between px-5">
          <Wordmark />
          <Mono className="text-[9.5px] font-semibold tracking-[0.14em] text-[#F97316]">{kicker}</Mono>
        </div>

        {/* Column (desktop) */}
        <div className="relative hidden lg:flex flex-col justify-between h-full px-12 py-11">
          <Wordmark />
          <div>
            <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#F97316]">{kicker}</Mono>
            <h2 className="font-bt-display font-extrabold uppercase text-[76px] leading-[0.9] tracking-[0.01em] max-w-[420px] mt-4">{heroTitle}</h2>
            <span className="block w-16 h-[2px] bg-[#F97316] mt-6" aria-hidden="true" />
            <p className="text-[15px] leading-[1.6] text-[rgba(245,241,232,0.78)] max-w-[440px] mt-5">{heroBody}</p>
            {heroExtra}
          </div>
          <div className="flex items-end gap-10">
            {stamps.map((stamp, i) => (
              <div key={i}>
                <div className={cn('font-bt-display font-extrabold text-[30px] leading-none', (stamp.tone ?? (i === 0 ? 'orange' : 'bone')) === 'orange' ? 'text-[#F97316]' : 'text-[#F5F1E8]')}>{stamp.value}</div>
                <Mono className="block text-[9.5px] tracking-[0.12em] text-[rgba(245,241,232,0.6)] mt-2">{stamp.label}</Mono>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Paper column — the form */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-end px-5 pt-5 lg:px-12 lg:pt-8">
          <LanguageSwitcher variant="shell" />
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-8 lg:px-12">
          <div className="w-full max-w-[404px]">
            {children}
          </div>
        </div>

        <footer className="flex flex-col items-center gap-2 px-5 pb-6 lg:px-12 lg:pb-8">
          <div className="flex items-center gap-3 font-bt-mono text-[9.5px] uppercase tracking-[0.14em] text-[#8A8175]">
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className={cn('hover:text-[#C2410C]', FOCUS_RING)}>{t('common:privacyPolicy')}</a>
            <span aria-hidden="true">·</span>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className={cn('hover:text-[#C2410C]', FOCUS_RING)}>{t('common:termsOfService')}</a>
          </div>
          <span className="font-bt-mono text-[9px] uppercase tracking-[0.14em] text-[#B4A992]">{t('common:poweredBy')} ArchLogic Systems</span>
        </footer>
      </main>
    </div>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="w-8 h-8 bg-[#F97316] flex items-center justify-center flex-shrink-0" aria-hidden="true">
        <Building2 className="w-4 h-4 text-[#0A0A0A]" strokeWidth={1.8} />
      </span>
      <span className="font-bt-display font-extrabold uppercase text-[26px] leading-none tracking-[0.01em]">BuildTrack</span>
    </span>
  );
}

/** Mono kicker above the paper title: "Portal administrativo", "Acceso · recuperar". */
export function PaperKicker({ children }: { children: ReactNode }) {
  return <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#8A8175]">{children}</Mono>;
}

/** The paper title: display 46 px (38 on phones), uppercase. */
export function PaperTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h1 className={cn('font-bt-display font-extrabold uppercase text-[38px] lg:text-[46px] leading-[0.94] text-[#0A0A0A] mt-2', className)}>{children}</h1>;
}

/** The one paragraph under the paper title. */
export function PaperLead({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn('text-[13.5px] leading-[1.55] text-[#5A5346] mt-2.5', className)}>{children}</p>;
}

/**
 * 01B — panel of paper with a coloured edge. Red is an error (white paper,
 * #B3402A edge); orange is information and the 429 (#FBEDE0, #F97316 edge).
 */
export function AuthNotice({ tone, title, children, action, className }: {
  tone: 'red' | 'orange';
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'border border-[#EDE7DB] border-l-[3px] px-[15px] py-[13px] mb-5',
        tone === 'red' ? 'bg-white border-l-[#B3402A]' : 'bg-[#FBEDE0] border-l-[#F97316]',
        className,
      )}
    >
      {title && <Mono className={cn('block text-[9.5px] font-semibold tracking-[0.12em]', tone === 'red' ? 'text-[#B3402A]' : 'text-[#C2410C]')}>{title}</Mono>}
      <p className={cn('text-[13.5px] leading-[1.5] text-[#43301F]', title && 'mt-1')}>{children}</p>
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}

/** Small bordered "Reintentar" inside a notice. */
export function AuthRetryButton({ className, children, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] px-3 py-2 border border-[#DBD0BB] bg-white text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] transition-colors', FOCUS_RING, className)}
      {...rest}
    >
      <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}

/** The field look on these pages: 44 px on phones, 40 on desktop. */
export function authField(bad: boolean, busy: boolean): string {
  return cn(INPUT, 'h-11 lg:h-10', bad && INPUT_ERROR, busy && 'opacity-75');
}

/**
 * Square eye next to a password field (42 px on phones, 38 on desktop).
 * `active` paints the open state as the sheet does on the new-password
 * pages — sand background, orange icon — so the login keeps its quiet look.
 */
export function EyeButton({ shown, onToggle, disabled, showLabel, hideLabel, active = false, className }: {
  shown: boolean;
  onToggle: () => void;
  disabled?: boolean;
  showLabel: string;
  hideLabel: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? hideLabel : showLabel}
      aria-pressed={shown}
      tabIndex={-1}
      disabled={disabled}
      className={cn(
        'w-[42px] lg:w-[38px] flex-shrink-0 flex items-center justify-center border border-l-0 border-[#DBD0BB] hover:text-[#C2410C] disabled:opacity-75',
        active && shown ? 'bg-[#F3EEE4] text-[#C2410C]' : 'bg-[#FAF7F0] text-[#5A5346]',
        FOCUS_RING,
        className,
      )}
    >
      {shown ? <EyeOff className="w-4 h-4" strokeWidth={1.8} /> : <Eye className="w-4 h-4" strokeWidth={1.8} />}
    </button>
  );
}

/**
 * Full-width primary: ink with bone text, orange on hover. `busy` swaps the
 * label for a spinner and the busy label; `disabled` (without busy) is the
 * sheet's switched-off look — sand with muted text.
 */
export function AuthSubmitButton({ busy, busyLabel, disabled, className, children, type = 'submit', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  busyLabel?: ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      className={cn(
        'w-full inline-flex items-center justify-center gap-2.5 py-[17px] lg:py-4 font-bt-mono text-[11.5px] font-semibold uppercase tracking-[0.12em] transition-colors',
        busy
          ? 'bg-[#3A3733] text-[#F5F1E8] cursor-wait'
          : disabled
            ? 'bg-[#DBD0BB] text-[#8A8175] cursor-not-allowed'
            : 'bg-[#0A0A0A] text-[#F5F1E8] hover:bg-[#F97316] hover:text-[#0A0A0A]',
        FOCUS_RING,
        className,
      )}
      {...rest}
    >
      {busy ? (
        <>
          <AuthSpinner />
          {busyLabel}
        </>
      ) : children}
    </button>
  );
}

/** 12 px square-ish spinner: bone ring with an orange head. */
export function AuthSpinner({ onPaper = false }: { onPaper?: boolean }) {
  return (
    <span
      className={cn('inline-block w-3 h-3 rounded-full border-2 border-t-[#F97316] animate-spin', onPaper ? 'border-[#DBD0BB]' : 'border-[rgba(245,241,232,0.35)]')}
      aria-hidden="true"
    />
  );
}

/**
 * The person a link belongs to (02 / 02A / 03): initials square, username in
 * mono and the workspace in small caps. Only rendered once the preflight has
 * answered — the neutral form has nothing to put here.
 */
export function AccountBlock({ username, fullName, tenantName, className }: {
  username: string;
  fullName?: string | null;
  tenantName: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 bg-[#F3EEE4] border-l-[3px] border-[#0A0A0A] px-3.5 py-2.5', className)}>
      <span className="w-[26px] h-[26px] flex-shrink-0 flex items-center justify-center bg-[#0A0A0A] text-[#F5F1E8] font-bt-mono text-[10px] font-semibold" aria-hidden="true">
        {initials(fullName, username)}
      </span>
      <span className="min-w-0">
        <Mono className="block text-[11.5px] font-semibold tracking-[0.06em] text-[#0A0A0A] normal-case truncate">{username}</Mono>
        <Mono className="block text-[9px] tracking-[0.11em] text-[#8A8175] truncate">{tenantName}</Mono>
      </span>
    </div>
  );
}

export function initials(fullName: string | null | undefined, username: string): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

/** A small mono seal with the orange square: "El enlace expira en 1 hora". */
export function AuthSeal({ children, className, tone = 'muted' }: { children: ReactNode; className?: string; tone?: 'muted' | 'orange' }) {
  return (
    <Mono className={cn('inline-flex items-center gap-2.5 text-[9.5px] tracking-[0.14em]', tone === 'orange' ? 'text-[#C2410C] font-semibold' : 'text-[#8A8175]', className)}>
      <span className="inline-block w-2 h-2 bg-[#F97316] flex-shrink-0" aria-hidden="true" />
      {children}
    </Mono>
  );
}

/** Orange mono chip: "Enlace en camino". */
export function AuthChip({ children, className }: { children: ReactNode; className?: string }) {
  return <Mono className={cn('inline-block bg-[#F97316] text-[#0A0A0A] text-[9.5px] font-semibold tracking-[0.14em] px-2.5 py-1', className)}>{children}</Mono>;
}

/** Secondary button on paper: bordered, mono, orange on hover. */
export function AuthSecondaryButton({ className, children, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn('inline-flex items-center justify-center gap-2 px-4 py-3 border border-[#DBD0BB] bg-white text-[#0A0A0A] font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] hover:border-[#F97316] hover:text-[#C2410C] transition-colors disabled:opacity-60', FOCUS_RING, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Mono text link back to the sign-in page. */
export function AuthTextLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING, className)}>
      {children}
    </Link>
  );
}

/**
 * The full-page hand-over shown for ~900 ms before the welcome overlay takes
 * the screen (02B "listo", 03 "cuenta creada"): ink, the wordmark, a title
 * and the person's name and workspace.
 */
export function AuthDone({ title, subtitle, name, tenantName }: { title: ReactNode; subtitle: ReactNode; name: string; tenantName?: string | null }) {
  return (
    <div className="fixed inset-0 z-[110] bg-[#0A0A0A] text-[#F5F1E8] flex flex-col items-center justify-center px-6 text-center" role="status" aria-live="polite" data-testid="auth-done">
      <div className="absolute inset-0 pointer-events-none" style={inkGrid(26)} aria-hidden="true" />
      <div className="relative">
        <Mono className="block text-[10px] font-semibold tracking-[0.42em] text-[#EA580C]">{title}</Mono>
        <div className="font-bt-display font-extrabold uppercase text-[56px] md:text-[76px] leading-[0.9] mt-4">{subtitle}</div>
        <span className="block w-[60px] h-[2px] mx-auto mt-6" style={{ background: 'rgba(249,115,22,0.55)' }} aria-hidden="true" />
        <p className="text-[18px] font-semibold mt-5">{name}{tenantName ? <span className="font-normal text-[rgba(245,241,232,0.7)]"> · {tenantName}</span> : null}</p>
      </div>
    </div>
  );
}
