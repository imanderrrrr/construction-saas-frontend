import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Lock } from 'lucide-react';
import { cn } from '../../ui/utils';
import { FOCUS_RING, TertiaryButton } from '../../onboarding/chrome';
import { Mono } from '../bt';

/**
 * The ficha's shared pieces (Claude Design "Proyectos BuildTrack" fase 2):
 * the subventana panel, its label/value rows, the tab strip and the button
 * that lives on the ink bar. Nothing here knows about projects.
 */

/** Subventana: white panel, display title + one sentence of purpose. */
export function Panel({ title, purpose, actions, children, className }: {
  title: string;
  purpose: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('bg-white border border-[#E7E1D5] px-4 py-4 md:px-[22px] md:py-5', className)}>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4 md:mb-5">
        <div className="min-w-0">
          <h3 className="font-bt-display font-extrabold uppercase text-[24px] md:text-[26px] leading-none text-[#0A0A0A]">{title}</h3>
          <p className="text-[13.5px] leading-[1.55] text-[#5A5346] mt-1.5">{purpose}</p>
        </div>
        {actions && <div className="flex items-center gap-2.5 flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Label / value row of the Resumen: mono label, 13 px value, hairline divider. */
export function Row({ label, children, empty }: { label: string; children?: ReactNode; empty?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-[9px] border-b border-[#F0EBE1] last:border-b-0">
      <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346] w-[140px] md:w-[150px] flex-shrink-0 pt-[3px]">{label}</Mono>
      <div className="text-[13px] leading-[1.45] text-[#0A0A0A] text-right min-w-0 break-words">
        {children ?? <span className="italic text-[#A69C8D]">{empty}</span>}
      </div>
    </div>
  );
}

/** Mono heading with a rule running to the right edge. */
export function SubHead({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 mb-3', className)}>
      <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A] flex-shrink-0">{children}</Mono>
      <span className="flex-1 h-px bg-[#E7E1D5]" aria-hidden="true" />
      {right}
    </div>
  );
}

/** One cell of a figure strip: display number over a mono label. */
export function Figure({ value, label, tone = 'ink', size = 'md', className }: {
  value: ReactNode;
  label: ReactNode;
  tone?: 'ink' | 'orange' | 'red' | 'muted';
  size?: 'md' | 'sm';
  className?: string;
}) {
  const color = {
    ink: 'text-[#0A0A0A]',
    orange: 'text-[#C2410C]',
    red: 'text-[#B3402A]',
    muted: 'text-[#A69C8D]',
  }[tone];
  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn('font-bt-display font-extrabold leading-none tracking-[0.01em] tabular-nums truncate', size === 'md' ? 'text-[30px]' : 'text-[22px]', color)}>{value}</div>
      <Mono className="block text-[9.5px] tracking-[0.12em] text-[#5A5346] mt-1.5">{label}</Mono>
    </div>
  );
}

/** Secondary button for the ink bar: bone text, 25 % bone border, orange on hover. */
export function DarkButton({ className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-colors',
        'border border-[rgba(245,241,232,0.25)] text-[#F5F1E8] hover:border-[#F97316] hover:text-[#F97316]',
        'disabled:opacity-50 disabled:pointer-events-none px-[13px] py-[10px]',
        FOCUS_RING,
        className,
      )}
      {...rest}
    />
  );
}

export interface FichaTabDef<K extends string> {
  key: K;
  label: string;
  /** Number on the tab; `queue` paints it orange (work waiting), else bone. */
  count?: number | null;
  queue?: boolean;
  /** Not in the plan: greyed, padlocked, still selectable to show why. */
  locked?: boolean;
}

/** The six-tab strip. On phones it scrolls sideways instead of wrapping. */
export function FichaTabs<K extends string>({ tabs, active, onChange }: {
  tabs: FichaTabDef<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  const { t } = useTranslation(['admin']);
  return (
    <div role="tablist" className="flex overflow-x-auto bt-scroll-none -mb-px">
      {tabs.map(tab => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={tab.locked || undefined}
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-[11px] font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap',
              'border border-[#E7E1D5] border-b-0 -ml-px first:ml-0 transition-colors',
              FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
              isActive ? 'bg-[#0A0A0A] text-[#F5F1E8] border-[#0A0A0A]' : tab.locked ? 'bg-[#F3EEE4] text-[#B4A992] cursor-not-allowed' : 'bg-white text-[#5A5346] hover:text-[#0A0A0A]',
            )}
          >
            {tab.label}
            {tab.locked && <Lock className="w-[10px] h-[10px]" strokeWidth={2.2} aria-label={t('admin:projectFicha.locked.chip')} />}
            {!tab.locked && tab.count != null && tab.count > 0 && (
              <span className={cn('font-bt-mono text-[9px] font-semibold px-1.5 py-[2px] leading-none', tab.queue ? 'bg-[#F97316] text-[#0A0A0A]' : 'bg-[#F3EEE4] text-[#0A0A0A]')}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 03J — the plan does not include the client portal. */
export function LockedPanel({ onPlans }: { onPlans?: () => void }) {
  const { t } = useTranslation(['admin']);
  return (
    <section className="bg-white border border-[#E7E1D5] px-5 py-8 md:px-[22px] md:py-10 flex flex-col items-center text-center">
      <span className="w-9 h-9 bg-[#F3EEE4] flex items-center justify-center" aria-hidden="true">
        <Lock className="w-4 h-4 text-[#B4A992]" strokeWidth={2} />
      </span>
      <Mono className="mt-3 text-[9.5px] tracking-[0.12em] text-[#B4A992]">{t('admin:projectFicha.locked.chip')}</Mono>
      <h3 className="font-bt-display font-extrabold uppercase text-[26px] leading-none text-[#0A0A0A] mt-2">{t('admin:projectFicha.locked.title')}</h3>
      <p className="text-[13.5px] leading-[1.55] text-[#5A5346] mt-2 max-w-[420px]">{t('admin:projectFicha.locked.body')}</p>
      {onPlans && (
        <TertiaryButton onClick={onPlans} className="mt-4 inline-flex items-center gap-1.5">
          {t('admin:projectFicha.locked.cta')}<ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </TertiaryButton>
      )}
    </section>
  );
}
