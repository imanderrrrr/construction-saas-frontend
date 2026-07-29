// OFJR Construction — Users Service (real API)
// Admin-only CRUD over /api/v1/admin/users
import { api } from '../lib/api';

// Types

type Role = 'ADMIN' | 'SUPERVISOR' | 'WORKER' | 'FINANCE' | 'WAREHOUSE' | 'SUBCONTRACTOR';
type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface UserDTO {
  id: number;
  username: string;
  fullName: string | null;
  role: Role;
  status: UserStatus;
  updatedAt: string;
  hourlyRate?: number | null;
}

export interface UsersPage {
  content: UserDTO[];
  totalElements: number;
  totalPages: number;
  number: number;   // current page (0-based)
  size: number;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  fullName?: string | null;
  role: Role;
  hourlyRate?: number | null;
}

export interface UpdateUserPayload {
  fullName?: string | null;
  role?: Role;
  status?: UserStatus;
  hourlyRate?: number | null;
}

export interface ResetPasswordPayload {
  newPassword: string;
}

// Worker QR + PIN access (field roles only)

/**
 * QR + PIN access descriptor for a field-role worker.
 * `qrToken` is a signed string that must be rendered as a QR code for the
 * worker to scan on the mobile app. `hasPin` reports whether a PIN is set.
 */
export interface WorkerQrDTO {
  qrToken: string;
  username: string;
  tenant: string;
  hasPin: boolean;
}

// Session types

export interface SessionDTO {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  status: 'ACTIVE' | 'REVOKED';
  ipAddress: string | null;
  userAgent: string | null;
}

// Activity types

export interface AuditEntryDTO {
  id: number;
  actorUsername: string;
  action: string;
  entity: string;
  entityId: string | null;
  payloadJson: string | null;
  createdAt: string;
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

// User CRUD

export async function listUsers(params: {
  search?: string;
  role?: string;
  status?: string;
  page?: number;   // 0-based for backend
  size?: number;
} = {}): Promise<UsersPage> {
  const q = buildQuery({
    search: params.search,
    role:   params.role,
    status: params.status,
    page:   params.page,
    size:   params.size,
  });
  return api<UsersPage>(`/api/v1/admin/users${q}`);
}

export async function getUser(id: number): Promise<UserDTO> {
  return api<UserDTO>(`/api/v1/admin/users/${id}`);
}

export async function createUser(payload: CreateUserPayload): Promise<UserDTO> {
  return api<UserDTO>('/api/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<UserDTO> {
  return api<UserDTO>(`/api/v1/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch all active users (for assignment selectors, etc.).
 * Optionally filter by role.
 * Returns the content array of UserDTO directly.
 */
export async function listActiveUsers(role?: string): Promise<UserDTO[]> {
  const q = buildQuery({ status: 'ACTIVE', role, page: 0, size: 100 });
  const page = await api<UsersPage>(`/api/v1/admin/users${q}`);
  return page.content;
}

export async function resetPassword(id: number, payload: ResetPasswordPayload): Promise<void> {
  return api<void>(`/api/v1/admin/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch the worker's current QR access token + PIN state.
 * Field roles only (WORKER / SUPERVISOR / SUBCONTRACTOR); office roles return
 * 400 USER_NOT_FIELD_ROLE.
 */
export async function getWorkerQr(id: number): Promise<WorkerQrDTO> {
  return api<WorkerQrDTO>(`/api/v1/admin/users/${id}/qr`);
}

/**
 * Regenerate the worker's QR token, invalidating any previously issued QR.
 * Returns the new token (same shape as getWorkerQr). Confirm before calling —
 * it breaks every QR already handed out to the worker.
 */
export async function regenerateWorkerQr(id: number): Promise<WorkerQrDTO> {
  return api<WorkerQrDTO>(`/api/v1/admin/users/${id}/qr/regenerate`, {
    method: 'POST',
  });
}

/**
 * Set or reset the worker's initial 6-digit PIN. The PIN must be exactly 6
 * digits (the backend rejects anything else with 400). The plaintext PIN is
 * never retrievable afterwards — it can only be reset.
 */
export async function setWorkerPin(id: number, pin: string): Promise<void> {
  return api<void>(`/api/v1/admin/users/${id}/pin`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

// Sessions

export async function listUserSessions(userId: number): Promise<SessionDTO[]> {
  return api<SessionDTO[]>(`/api/v1/admin/users/${userId}/sessions`);
}

export async function revokeSession(userId: number, sessionId: string): Promise<void> {
  return api<void>(`/api/v1/admin/users/${userId}/sessions/${sessionId}/revoke`, {
    method: 'POST',
  });
}

export async function revokeAllSessions(userId: number): Promise<void> {
  return api<void>(`/api/v1/admin/users/${userId}/sessions/revoke-all`, {
    method: 'POST',
  });
}

// Activity

export async function listUserActivity(userId: number, size = 20): Promise<AuditEntryDTO[]> {
  return api<AuditEntryDTO[]>(`/api/v1/admin/users/${userId}/activity?size=${size}`);
}
