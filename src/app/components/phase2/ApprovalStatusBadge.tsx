import { useTranslation } from 'react-i18next';
import { ApprovalStatus } from '../../types';

// The label is not in here: the same status is already named by
// `admin:apr.st.<STATUS>`, which the approvals inbox, the record drawer and the
// hours report all read. A second set of words for one status is a second set
// to keep in step.
const STYLES: Record<ApprovalStatus, { bg: string; text: string; border: string; dot: string }> = {
  PENDING:  { bg: 'bg-amber-50',      text: 'text-amber-700',   border: 'border-amber-200',    dot: 'bg-amber-400 animate-pulse'   },
  APPROVED: { bg: 'bg-emerald-50',    text: 'text-emerald-700', border: 'border-emerald-200',  dot: 'bg-emerald-500'               },
  OBSERVED: { bg: 'bg-[#F97316]/10', text: 'text-[#F97316]',   border: 'border-[#F97316]/20', dot: 'bg-[#F97316]'                 },
  REJECTED:      { bg: 'bg-red-50',        text: 'text-red-700',     border: 'border-red-200',      dot: 'bg-red-500'                   },
  AUTO_REJECTED: { bg: 'bg-orange-50',     text: 'text-orange-700',  border: 'border-orange-200',   dot: 'bg-orange-500'                },
  PARTIAL:       { bg: 'bg-sky-50',        text: 'text-sky-700',     border: 'border-sky-200',      dot: 'bg-sky-400 animate-pulse'     },
};

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
  size?: 'sm' | 'md';
}

export function ApprovalStatusBadge({ status, size = 'md' }: ApprovalStatusBadgeProps) {
  const { t } = useTranslation('admin');
  const s = STYLES[status];
  const px = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 ${px} rounded-full ${text} font-semibold border font-mono ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {t(`apr.st.${status}`)}
    </span>
  );
}
