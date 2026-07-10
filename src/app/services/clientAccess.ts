// BuildTrack — Admin-side management of a project's client share link
// (generate / status / revoke). ADMIN tenant-wide; SUPERVISOR only on
// projects they are assigned to (enforced by the backend).

import { api } from '../lib/api';

export interface ClientAccessStatus {
  /** A share was generated and not revoked (may still be expired / cut off). */
  enabled: boolean;
  /** The link actually works right now (enabled + unexpired + project ACTIVE + client set). */
  active: boolean;
  pinRequired: boolean;
  expiresAt: string | null;
  version: number;
  clientName: string | null;
  projectOpen: boolean;
  /** Re-mint of the CURRENT link (copying does not revoke). Only when active. */
  shareToken: string | null;
}

export interface ClientAccessGenerated {
  shareToken: string;
  expiresAt: string;
  pinRequired: boolean;
  version: number;
  clientName: string;
}

export interface GenerateClientAccessInput {
  /** Optional 6-digit PIN; a value REPLACES any previous PIN, undefined leaves the link open. */
  pin?: string;
  /** Link lifetime in days (backend default: 90). */
  expiresInDays?: number;
}

export function getClientAccessStatus(projectId: number): Promise<ClientAccessStatus> {
  return api<ClientAccessStatus>(`/api/v1/projects/${projectId}/client-access`);
}

/** Generate or regenerate the share link — every call kills previously shared links. */
export function generateClientAccess(
  projectId: number,
  input: GenerateClientAccessInput = {},
): Promise<ClientAccessGenerated> {
  return api<ClientAccessGenerated>(`/api/v1/projects/${projectId}/client-access`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** One-click revoke: every shared link stops working immediately. */
export function revokeClientAccess(projectId: number): Promise<void> {
  return api<void>(`/api/v1/projects/${projectId}/client-access`, { method: 'DELETE' });
}

/** Public URL the client opens — same origin the SPA is served from. */
export function buildClientViewUrl(shareToken: string): string {
  return `${window.location.origin}/client-view/${encodeURIComponent(shareToken)}`;
}
