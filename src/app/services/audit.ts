// OFJR Construction — Audit Service (real API)
// Admin-only read-only access to GET /api/v1/admin/audit-logs
import { api } from '../lib/api';

// Types

export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export interface AuditLogDTO {
  id: number;
  actorUsername: string;
  actorUserId: number | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  outcome: AuditOutcome;
  reasonCode: string | null;
  message: string | null;
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  httpMethod: string | null;
  httpPath: string | null;
  payloadJson: string | null;
  occurredAt: string; // ISO-8601
}

export interface AuditLogsPage {
  content: AuditLogDTO[];
  totalElements: number;
  totalPages: number;
  page: number;   // current page (0-based)
  size: number;
}

export interface AuditSearchParams {
  actions?: string; // single action or comma-separated list
  actor?: string;
  entityType?: string;
  entityId?: string;
  outcome?: string;
  dateFrom?: string; // ISO-8601
  dateTo?: string;   // ISO-8601
  page?: number;     // 0-based
  size?: number;
}

// Query params builder

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

// API calls

export async function searchAuditLogs(params: AuditSearchParams = {}): Promise<AuditLogsPage> {
  const q = buildQuery({
    actions: params.actions,
    actor: params.actor,
    entityType: params.entityType,
    entityId: params.entityId,
    outcome: params.outcome,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page: params.page,
    size: params.size,
  });
  return api<AuditLogsPage>(`/api/v1/admin/audit-logs${q}`);
}

export async function getAuditLog(id: number): Promise<AuditLogDTO> {
  return api<AuditLogDTO>(`/api/v1/admin/audit-logs/${id}`);
}
