// BuildTrack — Client portal RFIs ("Consultas de obra"): the constructora
// asks a formal technical question and the building owner ANSWERS it from
// the public portal. Auth is the client-view SESSION token in an
// Authorization header — never a user session/cookie.

import { api, ApiError, getBaseUrl } from '../lib/api';
import { clientAuthHeaders } from './clientView';

export type ClientRfiStatus = 'OPEN' | 'RESPONDED' | 'CLOSED';

export interface ClientRfiPhoto {
  id: number;
  kind: 'QUESTION' | 'RESPONSE';
  contentType: string;
  createdAt: string;
  /** Portal-relative download path — turn into a full URL with clientRfiPhotoUrl(). */
  url: string;
}

/**
 * One thread message as the portal sees it. Deliberately NO author identity
 * (punch D7): render `byClient` as either the client's own name (the session
 * knows it) or the localized "construction team" label.
 */
export interface ClientRfiResponseEntry {
  id: number;
  /** True = the client wrote it; false = the construction team did. */
  byClient: boolean;
  body: string;
  /** True when this message was chosen as the official answer at close. */
  official: boolean;
  photos: ClientRfiPhoto[];
  createdAt: string;
}

export interface ClientRfi {
  id: number;
  /** Per-project number — the portal never sees unnumbered drafts. */
  rfiNumber: number;
  /** Preformatted "RFI #001" — render this everywhere the consulta is named. */
  displayNumber: string;
  subject: string;
  question: string;
  status: ClientRfiStatus;
  /** True while the ball is on the client's side (answer expected). */
  awaitingClient: boolean;
  /** The answer-by date the constructora needs. */
  dueDate: string | null;
  /** DERIVED — the answer is late (due date past && still OPEN). */
  overdue: boolean;
  /** True while the client can still write in the thread (not CLOSED). */
  canRespond: boolean;
  sentAt: string | null;
  respondedAt: string | null;
  closedAt: string | null;
  /** The thread message chosen as the official answer (visible once closed). */
  officialResponseId: number | null;
  /** Thread size — the thread itself loads through getClientRfiResponses(). */
  responseCount: number;
  questionPhotos: ClientRfiPhoto[];
}

export interface ClientRfiPage {
  content: ClientRfi[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Portal caps mirrored client-side for early feedback (server re-validates). */
export const MAX_RESPONSE_PHOTOS = 3;
export const MAX_RESPONSE_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

/** Every consulta SENT to this project (never drafts), newest first. */
export function getClientRfis(
  sessionToken: string,
  page = 0,
  size = 20,
): Promise<ClientRfiPage> {
  return api<ClientRfiPage>(`/api/v1/client-view/rfis?page=${page}&size=${size}`, {
    headers: clientAuthHeaders(sessionToken),
  });
}

/** The RFI's thread, oldest first — no internal identities. */
export function getClientRfiResponses(
  sessionToken: string,
  rfiId: number,
): Promise<ClientRfiResponseEntry[]> {
  return api<ClientRfiResponseEntry[]>(`/api/v1/client-view/rfis/${rfiId}/responses`, {
    headers: clientAuthHeaders(sessionToken),
  });
}

/**
 * The client answers (multipart: body + up to 3 photos). Rate-limited
 * server-side (429 → retry later). `apiMultipart` rides the cookie session,
 * so the portal needs its own fetch with the Bearer session header; error
 * parsing matches `api()` (ApiError with backend code).
 */
export async function respondClientRfi(
  sessionToken: string,
  rfiId: number,
  input: { body: string; photos?: File[] },
): Promise<ClientRfiResponseEntry> {
  const formData = new FormData();
  formData.append('body', input.body.trim());
  (input.photos ?? []).forEach((photo) => formData.append('photos', photo));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/api/v1/client-view/rfis/${rfiId}/responses`, {
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
  return (await res.json()) as ClientRfiResponseEntry;
}

/** Full URL for a portal RFI photo (feed to AuthImage/Lightbox + clientAuthHeaders). */
export function clientRfiPhotoUrl(photo: ClientRfiPhoto): string {
  return `${getBaseUrl()}${photo.url}`;
}
