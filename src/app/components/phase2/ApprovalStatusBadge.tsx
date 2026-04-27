import { ApprovalStatus } from '../../types';

const STYLES: Record<ApprovalStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
  PENDING:  { bg: 'bg-amber-50',      text: 'text-amber-700',   border: 'border-amber-200',    dot: 'bg-amber-400 animate-pulse',   label: 'Pending'    },
  APPROVED: { bg: 'bg-emerald-50',    text: 'text-emerald-700', border: 'border-emerald-200',  dot: 'bg-emerald-500',               label: 'Approved'   },
  OBSERVED: { bg: 'bg-[#F97316]/10', text: 'text-[#F97316]',   border: 'border-[#F97316]/20', dot: 'bg-[#F97316]',                 label: 'Observed'   },
  REJECTED:      { bg: 'bg-red-50',        text: 'text-red-700',     border: 'border-red-200',      dot: 'bg-red-500',                   label: 'Rejected'      },
  AUTO_REJECTED: { bg: 'bg-orange-50',     text: 'text-orange-700',  border: 'border-orange-200',   dot: 'bg-orange-500',                label: 'Auto-rejected' },
  PARTIAL:       { bg: 'bg-sky-50',        text: 'text-sky-700',     border: 'border-sky-200',      dot: 'bg-sky-400 animate-pulse',     label: 'In review'     },
};

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
  size?: 'sm' | 'md';
}

export function ApprovalStatusBadge({ status, size = 'md' }: ApprovalStatusBadgeProps) {
  const s = STYLES[status];
  const px = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 ${px} rounded-full ${text} font-semibold border font-mono ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}
