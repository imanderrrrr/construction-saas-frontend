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
