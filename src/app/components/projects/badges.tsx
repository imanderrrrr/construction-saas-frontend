import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProjectStatus } from '../../services/projects';
import type { Role, UserForAssign } from './types';
import { fmtUSD } from './helpers';

// STYLE MAPS

export const ROLE_STYLES: Record<Role, { bg: string; text: string; border: string }> = {
  ADMIN: { bg: 'bg-[#C2410C]/10', text: 'text-[#C2410C]', border: 'border-[#C2410C]/20' },
  SUPERVISOR: { bg: 'bg-[#F97316]/10', text: 'text-[#F97316]', border: 'border-[#F97316]/20' },
  WORKER: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  FINANCE: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  WAREHOUSE: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  SUBCONTRACTOR: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
};

export const AVATAR_BG: Record<Role, string> = {
  ADMIN: 'bg-[#C2410C]', SUPERVISOR: 'bg-[#F97316]',
  WORKER: 'bg-emerald-600', FINANCE: 'bg-purple-600', WAREHOUSE: 'bg-amber-600',
  SUBCONTRACTOR: 'bg-orange-600',
};

// BADGE COMPONENTS

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useTranslation('common');
  const s = ROLE_STYLES[role];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono border ${s.bg} ${s.text} ${s.border}`}>
      {t(`roles.${role}`)}
    </span>
  );
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useTranslation('common');
  return status === 'ACTIVE' ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t(`status.${status.toLowerCase()}`)}
    </span>
  ) : status === 'INACTIVE' ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAFAFA] text-[#71717A] border border-[#D4D4D8]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#71717A]" />{t(`status.${status.toLowerCase()}`)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      <Lock className="w-3 h-3" />{t(`status.${status.toLowerCase()}`)}
    </span>
  );
}

export function UserAvatar({ user, size = 'sm' }: { user: UserForAssign; size?: 'sm' | 'md' }) {
  const displayName = user.fullName || user.username;
  const initials = displayName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} ${AVATAR_BG[user.role]} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export function AssignedAvatars({ userIds, allUsers }: { userIds: number[]; allUsers: UserForAssign[] }) {
  const users = userIds.slice(0, 3).map(id => allUsers.find(u => u.id === id)).filter(Boolean) as UserForAssign[];
  const extra = userIds.length - 3;
  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1.5">
        {users.map(u => <UserAvatar key={u.id} user={u} size="sm" />)}
      </div>
      {extra > 0 && (
        <span className="text-xs text-[#71717A] ml-1">+{extra}</span>
      )}
      <span className="text-xs text-[#71717A] ml-1">
        {userIds.length === 0 ? '—' : `${userIds.length} user${userIds.length !== 1 ? 's' : ''}`}
      </span>
    </div>
  );
}

// CONTRACT BUDGET BAR

export function ContractBar({
  originalContractCents,
  revisedContractCents,
  remainingCents: remaining,
}: {
  originalContractCents: number | null;
  revisedContractCents?: number | null;
  remainingCents?: number | null;
}) {
  const baseCents = revisedContractCents ?? originalContractCents;
  if (baseCents == null || baseCents === 0) {
    return <span className="text-xs text-[#71717A]">—</span>;
  }

  const remainingCents = remaining != null ? Math.max(0, remaining) : baseCents;
  const pct = Math.round((remainingCents / baseCents) * 100);

  const barColor  = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-500';
  const textColor = pct >= 75 ? 'text-emerald-700' : pct >= 40 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="min-w-[130px]">
      <p className="text-xs font-semibold text-[#0A0A0A] mb-0.5">{fmtUSD(remainingCents)}</p>
      <p className={`text-[10px] font-medium ${textColor} mb-1`}>{pct}% of {fmtUSD(baseCents)}</p>
      <div className="h-1.5 w-full bg-[#E8EDF2] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
