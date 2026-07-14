// BuildTrack — Internal RFI management ("Consultas de obra", Procore-style).
// ADMIN works tenant-wide; SUPERVISOR only on assigned projects (enforced by
// the backend). Cookie-auth via the shared api()/apiMultipart() wrappers.

import { api, apiMultipart, getBaseUrl } from '../lib/api';

export type RfiStatus = 'DRAFT' | 'OPEN' | 'RESPONDED' | 'CLOSED';

/** Whose move it is — DERIVED server-side from status, never stored. */
export type RfiBallInCourt = 'CLIENT' | 'COMPANY' | 'NONE';

export type RfiImpact = 'YES' | 'NO' | 'TBD';

export interface RfiPhoto {
  id: number;
  kind: 'QUESTION' | 'RESPONSE';
  fileName: string | null;
  contentType: string;
  sizeBytes: number;
  uploadedByName: string | null;
  createdAt: string;
  url: string;
}

/** One message of the RFI's thread as seen internally (full identities). */
export interface RfiResponseEntry {
  id: number;
  /** Null = the external client answered (render as the project's client). */
  authorName: string | null;
  byClient: boolean;
  body: string;
  /** True when this message is THE chosen official answer. */
  official: boolean;
  photos: RfiPhoto[];
  createdAt: string;
}

export interface RfiEvent {
  type: 'CREATED' | 'SUBMITTED' | 'RESPONDED' | 'COMMENTED' | 'CLOSED';
  actorName: string | null;
  /** True when the external client acted through the portal. */
  byClient: boolean;
  note: string | null;
  createdAt: string;
}

export interface Rfi {
  id: number;
  /** Per-project number, claimed at submit — null while DRAFT. */
  rfiNumber: number | null;
  /** Preformatted "RFI #001" (null while DRAFT — render the draft label). */
  displayNumber: string | null;
  subject: string;
  question: string;
  status: RfiStatus;
  ballInCourt: RfiBallInCourt;
  /** DERIVED — answer overdue (due date past && still OPEN). */
  overdue: boolean;
  dueDate: string | null;
  costImpact: RfiImpact;
  costImpactAmountCents: number | null;
  scheduleImpact: RfiImpact;
  scheduleImpactDays: number | null;
  officialResponseId: number | null;
  createdByName: string;
  submittedAt: string | null;
  submittedByName: string | null;
  respondedAt: string | null;
  closedAt: string | null;
  closedByName: string | null;
  /** True when close is available right now (open + at least one answer). */
  closable: boolean;
  responseCount: number;
  questionPhotos: RfiPhoto[];
  /** Populated on the detail endpoint only; empty on lists. */
  responses: RfiResponseEntry[];
  /** Populated on detail only, like responses. */
  events: RfiEvent[];
  createdAt: string;
  updatedAt: string;
}

/** Internal caps mirrored client-side for early feedback (server re-validates). */
export const MAX_INTERNAL_PHOTOS = 5;
export const MAX_INTERNAL_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

export function listRfis(
  projectId: number,
  filters: { status?: RfiStatus } = {},
): Promise<Rfi[]> {
  const qs = filters.status ? `?status=${filters.status}` : '';
  return api<Rfi[]>(`/api/v1/projects/${projectId}/rfis${qs}`);
}

/**
 * Create a consulta (multipart; question photos ≤5). `submit: true` sends it
 * to the client in the same stroke (numbered + team notified); otherwise it
 * stays as an internal DRAFT the portal never sees.
 */
export function createRfi(
  projectId: number,
  input: {
    subject: string;
    question: string;
    dueDate?: string;
    photos?: File[];
    submit?: boolean;
  },
): Promise<Rfi> {
  const formData = new FormData();
  formData.append('subject', input.subject);
  formData.append('question', input.question);
  if (input.dueDate) formData.append('dueDate', input.dueDate);
  if (input.submit) formData.append('submit', 'true');
  (input.photos ?? []).forEach((photo) => formData.append('photos', photo));
  return apiMultipart<Rfi>(`/api/v1/projects/${projectId}/rfis`, 'POST', formData);
}

/** Full detail including the thread and the audit timeline. */
export function getRfi(id: number): Promise<Rfi> {
  return api<Rfi>(`/api/v1/rfis/${id}`);
}

/** Edit a DRAFT (the only editable state). Omitted dueDate clears it. */
export function updateRfiDraft(
  id: number,
  input: { subject: string; question: string; dueDate?: string },
): Promise<Rfi> {
  return api<Rfi>(`/api/v1/rfis/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      subject: input.subject,
      question: input.question,
      dueDate: input.dueDate || null,
    }),
  });
}

/** Discard a DRAFT (never numbered, never seen by the portal). */
export function deleteRfiDraft(id: number): Promise<void> {
  return api<void>(`/api/v1/rfis/${id}`, { method: 'DELETE' });
}

/** DRAFT → OPEN: claims the per-project number and notifies the team. */
export function submitRfi(id: number): Promise<Rfi> {
  return api<Rfi>(`/api/v1/rfis/${id}/submit`, { method: 'POST' });
}

/** Internal follow-up in the thread (multipart; photos ≤5). */
export function addRfiResponse(
  id: number,
  input: { body: string; photos?: File[] },
): Promise<RfiResponseEntry> {
  const formData = new FormData();
  formData.append('body', input.body.trim());
  (input.photos ?? []).forEach((photo) => formData.append('photos', photo));
  return apiMultipart<RfiResponseEntry>(`/api/v1/rfis/${id}/responses`, 'POST', formData);
}

/** Impacts stay editable while the RFI is open/responded (frozen at close). */
export function updateRfiImpacts(
  id: number,
  input: {
    costImpact: RfiImpact;
    costImpactAmountCents?: number | null;
    scheduleImpact: RfiImpact;
    scheduleImpactDays?: number | null;
  },
): Promise<Rfi> {
  return api<Rfi>(`/api/v1/rfis/${id}/impacts`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** Close with THE official answer (required) + final impacts. */
export function closeRfi(
  id: number,
  input: {
    officialResponseId: number;
    costImpact?: RfiImpact;
    costImpactAmountCents?: number | null;
    scheduleImpact?: RfiImpact;
    scheduleImpactDays?: number | null;
  },
): Promise<Rfi> {
  return api<Rfi>(`/api/v1/rfis/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Authenticated (cookie) download URL for an internal RFI photo — blob-fetch it. */
export function rfiPhotoUrl(rfiId: number, photoId: number): string {
  return `${getBaseUrl()}/api/v1/rfis/${rfiId}/photos/${photoId}`;
}
