// BuildTrack — Internal punch-list management (fase 2 del portal de cliente).
// ADMIN works tenant-wide; SUPERVISOR only on assigned projects (enforced by
// the backend). Cookie-auth via the shared api()/apiMultipart() wrappers.

import { api, apiMultipart, getBaseUrl } from '../lib/api';

export type PunchItemStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'READY_FOR_REVIEW'
  | 'REOPENED'
  | 'CLOSED';

export type PunchItemOrigin = 'CLIENT' | 'INTERNAL';

export interface PunchItemPhoto {
  id: number;
  kind: 'REPORT' | 'EVIDENCE';
  fileName: string | null;
  contentType: string;
  sizeBytes: number;
  uploadedByName: string | null;
  createdAt: string;
  url: string;
}

export interface PunchItemEvent {
  type: 'CREATED' | 'ASSIGNED' | 'READY' | 'CONFIRMED' | 'REJECTED' | 'CLOSED' | 'RETURNED_TO_PROGRESS';
  actorName: string | null;
  /** True when the external client acted through the portal. */
  byClient: boolean;
  note: string | null;
  createdAt: string;
}

export interface PunchItem {
  id: number;
  origin: PunchItemOrigin;
  title: string;
  description: string | null;
  location: string | null;
  status: PunchItemStatus;
  assigneeId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdByName: string | null;
  createdByClient: boolean;
  readyAt: string | null;
  readyNote: string | null;
  closedAt: string | null;
  closedByName: string | null;
  closedByClient: boolean;
  closeNote: string | null;
  reopenCount: number;
  /** True when the internal-close rules (D3) allow closing it right now. */
  closableInternally: boolean;
  photos: PunchItemPhoto[];
  /** Populated on the detail endpoint only; empty on lists. */
  events: PunchItemEvent[];
  createdAt: string;
  updatedAt: string;
}

/** Internal caps mirrored client-side for early feedback (server re-validates). */
export const MAX_INTERNAL_PHOTOS = 5;
export const MAX_INTERNAL_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

export function listPunchItems(
  projectId: number,
  filters: { status?: PunchItemStatus; assigneeId?: number } = {},
): Promise<PunchItem[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.assigneeId != null) params.set('assigneeId', String(filters.assigneeId));
  const qs = params.toString();
  return api<PunchItem[]>(`/api/v1/projects/${projectId}/punch-items${qs ? `?${qs}` : ''}`);
}

export function createPunchItem(
  projectId: number,
  input: {
    title: string;
    description?: string;
    location?: string;
    assigneeId?: number;
    dueDate?: string;
    photos?: File[];
  },
): Promise<PunchItem> {
  const formData = new FormData();
  formData.append('title', input.title);
  if (input.description?.trim()) formData.append('description', input.description.trim());
  if (input.location?.trim()) formData.append('location', input.location.trim());
  if (input.assigneeId != null) formData.append('assigneeId', String(input.assigneeId));
  if (input.dueDate) formData.append('dueDate', input.dueDate);
  (input.photos ?? []).forEach((photo) => formData.append('photos', photo));
  return apiMultipart<PunchItem>(`/api/v1/projects/${projectId}/punch-items`, 'POST', formData);
}

/** Full detail including the workflow-event timeline. */
export function getPunchItem(id: number): Promise<PunchItem> {
  return api<PunchItem>(`/api/v1/punch-items/${id}`);
}

export function assignPunchItem(id: number, assigneeId: number): Promise<PunchItem> {
  return api<PunchItem>(`/api/v1/punch-items/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assigneeId }),
  });
}

/** "Marcar listo": → READY_FOR_REVIEW with optional evidence photos + note. */
export function markPunchItemReady(
  id: number,
  input: { note?: string; photos?: File[] } = {},
): Promise<PunchItem> {
  const formData = new FormData();
  if (input.note?.trim()) formData.append('note', input.note.trim());
  (input.photos ?? []).forEach((photo) => formData.append('photos', photo));
  return apiMultipart<PunchItem>(`/api/v1/punch-items/${id}/ready`, 'POST', formData);
}

export function returnPunchItemToProgress(id: number): Promise<PunchItem> {
  return api<PunchItem>(`/api/v1/punch-items/${id}/return-to-progress`, { method: 'POST' });
}

/** Internal close (workflow rules D3 — client items only after the 7-day window). */
export function closePunchItem(id: number, note?: string): Promise<PunchItem> {
  return api<PunchItem>(`/api/v1/punch-items/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(note?.trim() ? { note: note.trim() } : {}),
  });
}

/** Authenticated (cookie) download URL for an internal punch photo — blob-fetch it. */
export function punchItemPhotoUrl(itemId: number, photoId: number): string {
  return `${getBaseUrl()}/api/v1/punch-items/${itemId}/photos/${photoId}`;
}
