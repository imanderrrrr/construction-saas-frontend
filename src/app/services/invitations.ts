// BuildTrack — Invitations Service
// Phase-3 onboarding via QR. Admins create invitations, invitees accept.

import { api } from '../lib/api';
import type { CanonicalRole } from '../types';
import type { LoginResponse } from './auth';

/** Server response for admin create / list / revoke. */
export interface AdminInvitation {
  id: number;
  token: string;
  role: CanonicalRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  invitedByUserId: number;
  acceptedAt: string | null;
  acceptedUserId: number | null;
}

/** Public preview of an invitation token used by the accept page. */
export interface InvitationPreview {
  role: CanonicalRole;
  tenantName: string;
  tenantSlug: string;
  invitedByName: string | null;
  expiresAt: string;
}

export interface AcceptInvitationPayload {
  username: string;
  password: string;
  fullName: string;
}

export const InvitationsService = {
  /** ADMIN: create a new invitation; returns the token to render the QR. */
  create: (role: CanonicalRole) =>
    api<AdminInvitation>('/api/v1/admin/invitations', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  /** ADMIN: list invitations in current tenant. */
  list: () => api<AdminInvitation[]>('/api/v1/admin/invitations'),

  /** ADMIN: revoke a pending invitation. */
  revoke: (id: number) =>
    api<AdminInvitation>(`/api/v1/admin/invitations/${id}`, { method: 'DELETE' }),

  /** PUBLIC: preview the invitation. Throws ApiError 410 if invalid/expired. */
  preview: (token: string) =>
    api<InvitationPreview>(`/api/v1/auth/invitations/${encodeURIComponent(token)}`),

  /** PUBLIC: accept the invitation. Server sets cookies and the new
   *  user is auto-logged in (response shape mirrors /login). */
  accept: (token: string, payload: AcceptInvitationPayload) =>
    api<LoginResponse>(`/api/v1/auth/invitations/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
