import { platformApi } from '../lib/platformApi';
import type {
  CreateTenantRequest,
  CreateTenantResponse,
  FleetOverview,
  Page,
  PlatformAuditEntry,
  PlatformMe,
  RecordPaymentRequest,
  TenantDetail,
  TenantPayments,
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

/**
 * Provision a customer workspace: tenant + admin + a MANUAL billing row
 * carrying the plan, then the backend emails the admin a set-your-password
 * link. OWNER / SUPPORT only.
 *
 * `planCode` / `billingInterval` are sent explicitly rather than relying on
 * the backend defaults, because the form always has a value for them — the
 * defaults exist for API callers, not for this UI.
 */
export async function createTenant(request: CreateTenantRequest): Promise<CreateTenantResponse> {
  return platformApi<CreateTenantResponse>('/platform/tenants', {
    method: 'POST',
    body: request,
  });
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

/**
 * Billing summary + manual payment history for the tenant-detail Payments
 * panel. OWNER / BILLING only. Returns the whole panel in one round-trip.
 */
export async function getTenantPayments(id: number): Promise<TenantPayments> {
  return platformApi<TenantPayments>(`/platform/tenants/${id}/payments`);
}

/**
 * Record an out-of-band payment (wire/Wise/PayPal/transfer — never Paddle),
 * which also sets `current_period_ends_at = coversUntil` and reactivates the
 * account to ACTIVE. OWNER / BILLING only. Returns the updated panel (new
 * status + period + history) so the caller can re-render without a refetch.
 * Rejected with 409 BILLING_ACCOUNT_NOT_MANUAL for a Paddle account.
 */
export async function recordTenantPayment(
  id: number,
  body: RecordPaymentRequest,
): Promise<TenantPayments> {
  return platformApi<TenantPayments>(`/platform/tenants/${id}/payments`, {
    method: 'POST',
    body,
  });
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
