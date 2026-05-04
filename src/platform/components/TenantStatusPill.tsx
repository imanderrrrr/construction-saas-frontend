import type { TenantStatus } from '../types';

const STYLES: Record<TenantStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SUSPENDED: 'bg-amber-100 text-amber-700 border-amber-200',
  DELETED: 'bg-red-100 text-red-700 border-red-200',
};

export function TenantStatusPill({ status }: { status: TenantStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
