// OFJR Construction — Projects Service (real API)
// Admin-only CRUD over /api/v1/admin/projects
import { api } from '../lib/api';

// Types

export type ProjectStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';

export interface ClientSummary {
  id: number;
  name: string;
}

export interface ProjectResponse {
  id: number;
  name: string;
  status: ProjectStatus;
  clientId: number | null;
  client: ClientSummary | null;
  costCode: string | null;
  originalContractCents: number | null;
  changeOrdersTotalCents: number;        // sum of all change-order amounts
  revisedContractCents: number | null;   // originalContractCents + changeOrdersTotalCents
  contractAmountCents: number | null;
  approvedExpensesCents: number;         // sum of APPROVED expenses for this project
  totalConsumedCents: number | null;     // total consumed from ALL sources (expenses + labor + payables)
  // The gauge. costBudgetCents is what the company planned to SPEND, typed in
  // by hand; budgetBaseCents is what the gauge divides by, falling back to the
  // revised contract while no budget is set. Divide by budgetBaseCents and
  // nothing else — the backend already resolved that fallback.
  costBudgetCents: number | null;        // planned spend; null = never set
  budgetBaseCents: number | null;        // costBudgetCents, else revisedContractCents
  remainingBudgetCents: number | null;   // budgetBaseCents − totalConsumedCents
  // Receivable side — every field above is spend. Summed by the backend in one
  // grouped query; never total receivable pages in the browser to get these.
  invoicedCents: number;                 // billed to the client (excludes unapproved/rejected CORs)
  collectedCents: number;                // how much of that has been paid
  outstandingCents: number;              // invoiced − collected = what they still owe
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  assignedUserIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsPage {
  content: ProjectResponse[];
  totalElements: number;
  totalPages: number;
  number: number;   // current page (0-based)
  size: number;
}

export interface CreateProjectPayload {
  name: string;
  clientId?: number;
  costCode?: string;
  contractAmountCents: number;
  costBudgetCents?: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
}

export interface UpdateProjectPayload {
  name?: string;
  status?: ProjectStatus;
  clientId?: number;
  costCode?: string;
  contractAmountCents?: number;
  // 0 clears it: null already means "leave this field alone" in a PATCH.
  costBudgetCents?: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
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

// Service functions

export async function listProjects(params: {
  search?: string;
  status?: ProjectStatus;
  page?: number;   // 0-based for backend
  size?: number;
} = {}): Promise<ProjectsPage> {
  const q = buildQuery({
    search: params.search,
    status: params.status,
    page: params.page,
    size: params.size,
  });
  return api<ProjectsPage>(`/api/v1/admin/projects${q}`);
}

export async function getProject(id: number): Promise<ProjectResponse> {
  return api<ProjectResponse>(`/api/v1/admin/projects/${id}`);
}

export async function createProject(payload: CreateProjectPayload): Promise<ProjectResponse> {
  return api<ProjectResponse>('/api/v1/admin/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProject(id: number, payload: UpdateProjectPayload): Promise<ProjectResponse> {
  return api<ProjectResponse>(`/api/v1/admin/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * AP Block 4 — soft-delete a project (ADMIN only). Blocked by the backend
 * (409 PROJECT_HAS_ACTIVE_RECORDS) while the project still has payables,
 * expenses, time records or any other financial/operational history.
 */
export async function deleteProject(id: number): Promise<void> {
  return api<void>(`/api/v1/admin/projects/${id}`, { method: 'DELETE' });
}

export async function setAssignments(projectId: number, userIds: number[]): Promise<ProjectResponse> {
  return api<ProjectResponse>(`/api/v1/admin/projects/${projectId}/assignments`, {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  });
}

// ── Contract History ──────────────────────────────────

export interface ContractHistoryEntry {
  id: number;
  changeType: string;
  amountCents: number;
  balanceAfterCents: number;
  referenceId: number | null;
  description: string | null;
  createdAt: string;
}

export async function getContractHistory(projectId: number): Promise<ContractHistoryEntry[]> {
  return api<ContractHistoryEntry[]>(`/api/v1/admin/projects/${projectId}/contract-history`);
}

// ── Finance endpoints (read-only) ────────────────────

export async function listFinanceProjects(params: {
  search?: string;
  status?: ProjectStatus;
  page?: number;
  size?: number;
} = {}): Promise<ProjectsPage> {
  const q = buildQuery({
    search: params.search,
    status: params.status,
    page: params.page,
    size: params.size,
  });
  return api<ProjectsPage>(`/api/v1/finance/projects${q}`);
}

export async function getFinanceContractHistory(projectId: number): Promise<ContractHistoryEntry[]> {
  return api<ContractHistoryEntry[]>(`/api/v1/finance/projects/${projectId}/contract-history`);
}

// ── Change Orders ───────────────────────────────────

export interface ChangeOrderEntry {
  id: number;
  /** AP Block 5 — the client's change-order reference; null if unset. */
  number: string | null;
  description: string;
  amountCents: number;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateChangeOrderPayload {
  description: string;
  amountCents: number;
  /** AP Block 5 — optional change-order reference. */
  number?: string | null;
}

/** AP Block 5 — partial edit; omitted fields are left unchanged. */
export interface UpdateChangeOrderPayload {
  description?: string;
  amountCents?: number;
  number?: string | null;
}

export async function listChangeOrders(projectId: number): Promise<ChangeOrderEntry[]> {
  return api<ChangeOrderEntry[]>(`/api/v1/admin/projects/${projectId}/change-orders`);
}

export async function createChangeOrder(projectId: number, payload: CreateChangeOrderPayload): Promise<ChangeOrderEntry> {
  return api<ChangeOrderEntry>(`/api/v1/admin/projects/${projectId}/change-orders`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateChangeOrder(projectId: number, changeOrderId: number, payload: UpdateChangeOrderPayload): Promise<ChangeOrderEntry> {
  return api<ChangeOrderEntry>(`/api/v1/admin/projects/${projectId}/change-orders/${changeOrderId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteChangeOrder(projectId: number, changeOrderId: number): Promise<void> {
  return api<void>(`/api/v1/admin/projects/${projectId}/change-orders/${changeOrderId}`, {
    method: 'DELETE',
  });
}
