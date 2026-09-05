// BuildTrack — Password reset service (Plan A1)
// Every endpoint here is public (no auth). Request never reveals whether the
// (slug, email) pair exists — it always returns 204; preview and confirm are
// authenticated by the single-use token in the emailed link.

import { api } from '../lib/api';
import type { LoginResponse } from './auth';

export interface PasswordResetRequestPayload {
  tenantSlug: string;
  email: string;
}

export interface PasswordResetConfirmPayload {
  token: string;
  newPassword: string;
}

/**
 * What a reset link is for. RESET is the one the person asked for from
 * "¿Olvidaste tu contraseña?"; SETUP is the "activate your account" link the
 * staff send when they provision a workspace — that person has never had a
 * password, so the page speaks differently.
 */
export type PasswordResetIntent = 'RESET' | 'SETUP';

/** GET /auth/password-reset/{token} — whose link this is, before typing anything. */
export interface PasswordResetPreview {
  intent: PasswordResetIntent;
  username: string;
  fullName: string | null;
  tenantName: string;
  tenantSlug: string;
  expiresAt: string;
}

export const PasswordResetService = {
  /** Always resolves on 204 — never throws "user not found" to prevent enumeration. */
  request: (payload: PasswordResetRequestPayload) =>
    api<void>('/api/v1/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /**
   * Who the link belongs to and what it is for, without consuming it.
   * Throws ApiError 410 for an expired, used or unknown token; 404 when the
   * backend does not have the endpoint yet (the page then degrades to the
   * neutral form).
   */
  preview: (token: string) =>
    api<PasswordResetPreview>(`/api/v1/auth/password-reset/${encodeURIComponent(token)}`),

  /**
   * Throws ApiError 410 on invalid/expired/consumed tokens. On success the
   * server has already opened a session (cookies) — the response is the same
   * shape as /login, so the page can greet the person and enter the panel.
   */
  confirm: (payload: PasswordResetConfirmPayload) =>
    api<LoginResponse>('/api/v1/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
