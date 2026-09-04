import { useTranslation } from 'react-i18next';
import type { ProjectStatus } from '../../services/projects';
import type { Role, UserForAssign } from './types';
import { fmtUSD } from './helpers';
import { cn } from '../ui/utils';

/**
 * Chips, avatars and the contract gauge of the Projects section, in the
 * panel's industrial language (Claude Design "Proyectos BuildTrack", 2026-09):
 * mono uppercase chips, square ink avatars, a 5 px gauge that turns orange
 * past 90 % and red once the remainder is negative.
 */

const CHIP = 'inline-flex items-center font-bt-mono text-[9.5px] uppercase tracking-[0.1em] whitespace-nowrap';

/** Activo on sand, Inactivo bordered, Cerrado on ink. */
export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const { t } = useTranslation('common');
  const look = status === 'ACTIVE'
    ? 'bg-[#F3EEE4] text-[#0A0A0A] px-2 py-1'
    : status === 'INACTIVE'
      ? 'border border-[#DBD0BB] text-[#5A5346] px-[7px] py-[3px]'
      : 'bg-[#0A0A0A] text-[#F5F1E8] px-2 py-1';
  return <span className={cn(CHIP, look, className)}>{t(`status.${status.toLowerCase()}`)}</span>;
}

/** The orange "Incompleta" mark next to a project's name. */
export function IncompleteChip({ className }: { className?: string }) {
  const { t } = useTranslation('admin');
  return (
    <span className={cn(CHIP, 'bg-[#F97316] text-[#0A0A0A] px-1.5 py-0.5 text-[9px]', className)}>
      {t('projectMgmt.row.incomplete')}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useTranslation('common');
  return <span className={cn(CHIP, 'bg-[#F3EEE4] text-[#0A0A0A] px-2 py-1')}>{t(`roles.${role}`)}</span>;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Square ink avatar with mono initials: 24 px in tables, 26 px in windows. */
export function UserAvatar({ user, size = 'sm', className }: { user: UserForAssign; size?: 'sm' | 'md'; className?: string }) {
  const initials = initialsOf(user.fullName || user.username);
  return (
    <span
      className={cn(
        'flex items-center justify-center flex-shrink-0 bg-[#0A0A0A] text-[#F5F1E8] font-bt-mono text-[9px]',
        size === 'sm' ? 'w-6 h-6' : 'w-[26px] h-[26px]',
        className,
      )}
      title={user.fullName || user.username}
    >
      {initials}
    </span>
  );
}

/** Up to three squares and a bordered "+N" for the rest. */
export function AssignedAvatars({ userIds, allUsers, max = 3 }: { userIds: number[]; allUsers: UserForAssign[]; max?: number }) {
  const users = userIds.slice(0, max).map(id => allUsers.find(u => u.id === id)).filter(Boolean) as UserForAssign[];
  const extra = userIds.length - users.length;
  if (userIds.length === 0) return <span className="font-bt-mono text-[10px] text-[#B4A992]">—</span>;
  return (
    <div className="flex gap-[3px]">
      {users.map(u => <UserAvatar key={u.id} user={u} />)}
      {extra > 0 && (
        <span className="w-6 h-6 flex items-center justify-center border border-[#DBD0BB] text-[#8A8175] font-bt-mono text-[9px]">
          +{extra}
        </span>
      )}
    </div>
  );
}

/**
 * What the gauge shows: consumption against the budget base. `pct` is spent
 * over base (78 % = nearly done, 104 % = over), never the remainder.
 */
export function gaugeReading({ budgetBaseCents, revisedContractCents, originalContractCents, remainingCents }: {
  originalContractCents: number | null;
  revisedContractCents?: number | null;
  budgetBaseCents?: number | null;
  remainingCents?: number | null;
}): { baseCents: number; remainingCents: number; pct: number; tone: 'ink' | 'orange' | 'red' } | null {
  // The backend resolves "cost budget, else revised contract" as budgetBaseCents;
  // the fallbacks only cover a response that predates the field.
  const baseCents = budgetBaseCents ?? revisedContractCents ?? originalContractCents;
  if (baseCents == null || baseCents <= 0) return null;
  const remaining = remainingCents ?? baseCents;
  const pct = Math.round(((baseCents - remaining) / baseCents) * 100);
  const tone = remaining < 0 ? 'red' : pct >= 90 ? 'orange' : 'ink';
  return { baseCents, remainingCents: remaining, pct, tone };
}

// CONTRACT GAUGE

export function ContractBar({
  originalContractCents,
  revisedContractCents,
  budgetBaseCents,
  remainingCents: remaining,
  className,
}: {
  originalContractCents: number | null;
  revisedContractCents?: number | null;
  budgetBaseCents?: number | null;
  remainingCents?: number | null;
  className?: string;
}) {
  const { t } = useTranslation('admin');
  const r = gaugeReading({ originalContractCents, revisedContractCents, budgetBaseCents, remainingCents: remaining });
  if (!r) {
    return <span className="font-bt-mono text-[11.5px] tracking-[0.04em] text-[#A69C8D]">{t('projectMgmt.row.notDefined')}</span>;
  }
  const bar = r.tone === 'red' ? 'bg-[#B3402A]' : r.tone === 'orange' ? 'bg-[#F97316]' : 'bg-[#0A0A0A]';
  const pctColor = r.tone === 'red' ? 'text-[#B3402A]' : r.tone === 'orange' ? 'text-[#EA580C]' : 'text-[#0A0A0A]';
  // Geometry only: the figure stays uncapped, the bar cannot overflow its track.
  const width = Math.min(Math.max(r.pct, 0), 100);
  return (
    <div className={cn('min-w-[130px]', className)} data-testid="contract-gauge">
      <div className="flex justify-between items-baseline gap-2">
        <span className="font-bt-mono text-[11.5px] tracking-[0.04em] text-[#0A0A0A]">{fmtUSD(r.baseCents)}</span>
        <span className={cn('font-bt-display font-bold text-[17px] leading-none', pctColor)} data-testid="contract-gauge-pct">{r.pct}%</span>
      </div>
      <div className="h-[5px] bg-[#EDE5D6] mt-[5px]">
        <div className={cn('h-full', bar)} style={{ width: `${width}%` }} data-testid="contract-gauge-bar" />
      </div>
      {r.remainingCents < 0 && (
        <p className="font-bt-mono text-[9.5px] tracking-[0.06em] uppercase text-[#B3402A] mt-1">
          {t('projectMgmt.row.balance', { amount: fmtUSD(r.remainingCents) })}
        </p>
      )}
    </div>
  );
}
