import type { ProjectResponse } from '../../services/projects';
import { ApiError } from '../../lib/api';
import type { Project } from './types';

export function toProject(r: ProjectResponse): Project {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    clientId: r.clientId ?? null,
    clientName: r.client?.name ?? null,
    costCode: r.costCode ?? null,
    originalContractCents: r.originalContractCents ?? null,
    changeOrdersTotalCents: r.changeOrdersTotalCents ?? 0,
    revisedContractCents: r.revisedContractCents ?? null,
    contractAmountCents: r.contractAmountCents ?? null,
    totalConsumedCents: r.totalConsumedCents ?? null,
    costBudgetCents: r.costBudgetCents ?? null,
    budgetBaseCents: r.budgetBaseCents ?? r.revisedContractCents ?? null,
    remainingBudgetCents: r.remainingBudgetCents ?? r.contractAmountCents ?? null,
    invoicedCents: r.invoicedCents ?? 0,
    collectedCents: r.collectedCents ?? 0,
    outstandingCents: r.outstandingCents ?? 0,
    address: r.address ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    geofenceRadiusMeters: r.geofenceRadiusMeters ?? 200,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    assignedUserIds: r.assignedUserIds ?? [],
  };
}

export function fmtUSD(cents: number | null): string {
  if (cents == null) return '—';
  // Sign outside the symbol: an over-budget project reads "-$500.00", not "$-500.00".
  const sign = cents < 0 ? '-' : '';
  return sign + '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(iso: string, locale = 'en-US') {
  try {
    return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

export function apiErrorMsg(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}
