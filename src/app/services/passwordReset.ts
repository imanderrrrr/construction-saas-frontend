// BuildTrack — Password reset service (Plan A1)
// Both endpoints are public (no auth) and intentionally never reveal whether
// the (slug, email) pair exists — the request endpoint always returns 204.

import { api } from '../lib/api';

export interface PasswordResetRequestPayload {
  tenantSlug: string;
  email: string;
}

export interface PasswordResetConfirmPayload {
  token: string;
  newPassword: string;
}

export const PasswordResetService = {
  /** Always resolves on 204 — never throws "user not found" to prevent enumeration. */
  request: (payload: PasswordResetRequestPayload) =>
    api<void>('/api/v1/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Throws ApiError 410 on invalid/expired/consumed tokens. */
  confirm: (payload: PasswordResetConfirmPayload) =>
    api<void>('/api/v1/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
