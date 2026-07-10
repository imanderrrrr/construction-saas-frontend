// BuildTrack — Client portal punch items (fase 2): the building owner reports
// "cosas por terminar/arreglar" from the public portal, and confirms/rejects
// items the constructora marked ready. Auth is the phase-1 client-view
// SESSION token in an Authorization header — never a user session/cookie.

import { api, ApiError, getBaseUrl } from '../lib/api';
import { clientAuthHeaders } from './clientView';

export type ClientPunchItemStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'READY_FOR_REVIEW'
  | 'REOPENED'
  | 'CLOSED';

export interface ClientPunchItemPhoto {
  id: number;
  kind: 'REPORT' | 'EVIDENCE';
  contentType: string;
  createdAt: string;
  /** Portal-relative download path — turn into a full URL with clientPunchPhotoUrl(). */
  url: string;
}

export interface ClientPunchItem {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  status: ClientPunchItemStatus;
  createdAt: string;
  readyAt: string | null;
  readyNote: string | null;
  closedAt: string | null;
  /** True when the constructora closed it internally (the client didn't confirm). */
  closedByCompany: boolean;
  closeNote: string | null;
  lastRejectNote: string | null;
  /** True when the item waits on the client (confirm/reject buttons). */
  canReview: boolean;
  photos: ClientPunchItemPhoto[];
}

export interface ClientPunchItemPage {
  content: ClientPunchItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Portal caps mirrored client-side for early feedback (server re-validates). */
export const MAX_REPORT_PHOTOS = 3;
export const MAX_REPORT_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

/** The client's own reported items of their project, newest first. */
export function getClientPunchItems(
  sessionToken: string,
  page = 0,
  size = 20,
): Promise<ClientPunchItemPage> {
  return api<ClientPunchItemPage>(`/api/v1/client-view/punch-items?page=${page}&size=${size}`, {
    headers: clientAuthHeaders(sessionToken),
  });
}

/**
 * Report a new punch item (multipart: title + optional description/location +
 * up to 3 photos). `apiMultipart` rides the cookie session, so the portal
 * needs its own fetch with the Bearer session header; error parsing matches
 * `api()` (ApiError with backend code).
 */
export async function createClientPunchItem(
  sessionToken: string,
  input: { title: string; description?: string; location?: string; photos?: File[] },
): Promise<ClientPunchItem> {
  const formData = new FormData();
  formData.append('title', input.title);
  if (input.description?.trim()) formData.append('description', input.description.trim());
  if (input.location?.trim()) formData.append('location', input.location.trim());
  (input.photos ?? []).forEach((photo) => formData.append('photos', photo));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/api/v1/client-view/punch-items`, {
      method: 'POST',
      headers: clientAuthHeaders(sessionToken),
      body: formData,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { message?: string; code?: string };
      message = body.message ?? message;
      code = body.code;
    } catch {
      // non-JSON error body — keep the HTTP fallback message
    }
    throw new ApiError(res.status, message, undefined, code);
  }
  return (await res.json()) as ClientPunchItem;
}

/** READY_FOR_REVIEW → CLOSED (the client confirms the fix). */
export function confirmClientPunchItem(sessionToken: string, id: number): Promise<ClientPunchItem> {
  return api<ClientPunchItem>(`/api/v1/client-view/punch-items/${id}/confirm`, {
    method: 'POST',
    headers: clientAuthHeaders(sessionToken),
  });
}

/** READY_FOR_REVIEW → REOPENED (the client bounces it back, optional note). */
export function rejectClientPunchItem(
  sessionToken: string,
  id: number,
  note?: string,
): Promise<ClientPunchItem> {
  return api<ClientPunchItem>(`/api/v1/client-view/punch-items/${id}/reject`, {
    method: 'POST',
    headers: clientAuthHeaders(sessionToken),
    body: JSON.stringify(note?.trim() ? { note: note.trim() } : {}),
  });
}

/** Full URL for a portal punch photo (feed to AuthImage/Lightbox + clientAuthHeaders). */
export function clientPunchPhotoUrl(photo: ClientPunchItemPhoto): string {
  return `${getBaseUrl()}${photo.url}`;
}
