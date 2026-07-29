// BuildTrack — Client portal (public read-only site-log view) API service.
// Consumed by the PUBLIC /client-view/:token page: no user session, no
// cookies-based auth. The link token is exchanged (+ optional PIN) for a
// short-lived session token that travels in the Authorization header.

import { api, getBaseUrl } from '../lib/api';
import type { Weather } from './siteLog';

// ──────────────────────────── Types ────────────────────────────

export interface ClientViewProject {
  projectName: string;
  clientName: string;
  address: string | null;
}

export interface ClientViewSession {
  sessionToken: string;
  expiresAt: string;
  project: ClientViewProject;
}

export interface ClientAttendanceEntry {
  name: string;
}

export interface ClientTaskDoneEntry {
  description: string;
}

export interface ClientPhotoEntry {
  id: number;
  caption: string | null;
  contentType: string;
  createdAt: string;
  /** Portal-relative download path — turn into a full URL with clientPhotoUrl(). */
  url: string;
}

export interface ClientSiteLogEntry {
  workDate: string;
  weather: Weather | null;
  temperatureC: number | null;
  notes: string | null;
  attendance: ClientAttendanceEntry[];
  tasksDone: ClientTaskDoneEntry[];
  photos: ClientPhotoEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientSiteLogPage {
  content: ClientSiteLogEntry[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ──────────────────────────── Calls ────────────────────────────

/** Exchange the shared link token (+ PIN when the link is protected) for a session. */
export function openClientSession(token: string, pin?: string): Promise<ClientViewSession> {
  return api<ClientViewSession>('/api/v1/client-view/session', {
    method: 'POST',
    body: JSON.stringify(pin ? { token, pin } : { token }),
  });
}

/** PUBLISHED site logs of the session's project, newest first. */
export function getClientSiteLogs(
  sessionToken: string,
  page = 0,
  size = 20,
): Promise<ClientSiteLogPage> {
  return api<ClientSiteLogPage>(`/api/v1/client-view/site-logs?page=${page}&size=${size}`, {
    headers: clientAuthHeaders(sessionToken),
  });
}

/** Full URL for a portal photo (feed to AuthImage/Lightbox along with clientAuthHeaders). */
export function clientPhotoUrl(photo: ClientPhotoEntry): string {
  return `${getBaseUrl()}${photo.url}`;
}

/** Authorization header carrying the portal session token. */
export function clientAuthHeaders(sessionToken: string): Record<string, string> {
  return { Authorization: `Bearer ${sessionToken}` };
}
