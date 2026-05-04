import { platformApi } from '../lib/platformApi';
import type {
  FleetOverview,
  Page,
  PlatformAuditEntry,
  PlatformMe,
  TenantDetail,
  TenantSummary,
  TenantUserSummary,
} from '../types';

export async function getMe(): Promise<PlatformMe> {
  return platformApi<PlatformMe>('/platform/me');
}

export async function getOverview(): Promise<FleetOverview> {
  return platformApi<FleetOverview>('/platform/overview');
}

export async function listTenants(page = 0, size = 50): Promise<Page<TenantSummary>> {
  return platformApi<Page<TenantSummary>>(`/platform/tenants?page=${page}&size=${size}`);
}

export async function getTenant(id: number): Promise<TenantDetail> {
  return platformApi<TenantDetail>(`/platform/tenants/${id}`);
}

export async function listTenantUsers(
  id: number,
  page = 0,
  size = 50,
): Promise<Page<TenantUserSummary>> {
  return platformApi<Page<TenantUserSummary>>(
    `/platform/tenants/${id}/users?page=${page}&size=${size}`,
  );
}

export async function getTenantAudit(
  id: number,
  page = 0,
  size = 100,
): Promise<Page<PlatformAuditEntry>> {
  return platformApi<Page<PlatformAuditEntry>>(
    `/platform/tenants/${id}/audit?page=${page}&size=${size}`,
  );
}

export async function suspendTenant(id: number, reason: string): Promise<TenantSummary> {
  return platformApi<TenantSummary>(`/platform/tenants/${id}/suspend`, {
    method: 'POST',
    body: { reason },
  });
}

export async function reactivateTenant(id: number, note?: string): Promise<TenantSummary> {
  return platformApi<TenantSummary>(`/platform/tenants/${id}/reactivate`, {
    method: 'POST',
    body: { note: note ?? null },
  });
}

export async function deleteTenant(
  id: number,
  reason: string,
  confirmSlug: string,
): Promise<TenantSummary> {
  return platformApi<TenantSummary>(`/platform/tenants/${id}`, {
    method: 'DELETE',
    body: { reason, confirmSlug },
  });
}

export interface AuditSearchParams {
  actorId?: number;
  action?: string;
  targetTenantId?: number;
  page?: number;
  size?: number;
}

export async function searchAudit(params: AuditSearchParams = {}): Promise<Page<PlatformAuditEntry>> {
  const qs = new URLSearchParams();
  if (params.actorId !== undefined) qs.set('actorId', String(params.actorId));
  if (params.action) qs.set('action', params.action);
  if (params.targetTenantId !== undefined) qs.set('targetTenantId', String(params.targetTenantId));
  qs.set('page', String(params.page ?? 0));
  qs.set('size', String(params.size ?? 100));
  return platformApi<Page<PlatformAuditEntry>>(`/platform/audit?${qs.toString()}`);
}
