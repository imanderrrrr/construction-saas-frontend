// OFJR Construction — Site Log (Bitácora de obra) API Service
import { api, apiMultipart, getBaseUrl, ApiError } from '../lib/api';

// ──────────────────────────── Types ────────────────────────────

export type Weather = 'SOLEADO' | 'NUBLADO' | 'LLUVIA' | 'TORMENTA' | 'NIEBLA';
export type SiteLogStatus = 'DRAFT' | 'PUBLISHED';
export type AttendanceSource = 'AUTO' | 'MANUAL';

export interface SiteLogAttendance {
  id: number;
  workerId: number | null;
  name: string;
  role: string | null;
  source: AttendanceSource;
  checkInTime: string | null;
}

export interface SiteLogTaskDone {
  id: number;
  kanbanTaskId: number | null;
  description: string;
  partida: string | null;
}

export interface SiteLogPhoto {
  id: number;
  uploaderId: number;
  uploaderName: string;
  originalName: string | null;
  caption: string | null;
  contentType: string;
  partida: string | null;
  createdAt: string;
  url: string;
}

export interface SiteLogResponse {
  id: number;
  projectId: number;
  projectName: string;
  partida: string | null;
  workDate: string;
  authorId: number;
  authorName: string;
  status: SiteLogStatus;
  weather: Weather | null;
  temperatureC: number | null;
  notes: string | null;
  attendance: SiteLogAttendance[];
  tasksDone: SiteLogTaskDone[];
  photos: SiteLogPhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface SiteLogSummary {
  id: number;
  workDate: string;
  status: SiteLogStatus;
  weather: Weather | null;
  attendanceCount: number;
  tasksDoneCount: number;
  photoCount: number;
}

export interface AttendanceSuggestion {
  workerId: number;
  name: string;
  role: string | null;
  checkInTime: string | null;
}

export interface TaskSuggestion {
  kanbanTaskId: number;
  title: string;
  partida: string | null;
}

export interface SiteLogSuggestion {
  attendance: AttendanceSuggestion[];
  doneTasks: TaskSuggestion[];
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// Request payloads
export interface AttendanceInput {
  workerId?: number | null;
  name?: string | null;
  source: AttendanceSource;
  checkInTime?: string | null;
}

export interface TaskDoneInput {
  kanbanTaskId?: number | null;
  description?: string | null;
}

export interface SiteLogPayload {
  workDate: string;
  weather?: Weather | null;
  temperatureC?: number | null;
  notes?: string | null;
  status: SiteLogStatus;
  attendance: AttendanceInput[];
  tasksDone: TaskDoneInput[];
}

// ──────────────────────────── Calls ────────────────────────────

/** Whether the tenant's plan includes the bitácora feature (drives UI gating). */
export function getSiteLogFeature(): Promise<{ enabled: boolean }> {
  return api<{ enabled: boolean }>('/api/v1/site-logs/feature');
}

/** The site log for a project on a given date, or null when there is none yet. */
export async function getSiteLogByDate(projectId: number, date: string): Promise<SiteLogResponse | null> {
  try {
    return await api<SiteLogResponse>(`/api/v1/projects/${projectId}/site-logs?date=${date}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null; // "no log yet" → empty state
    throw err;
  }
}

/** Recent logs for the project (for "ver días anteriores"). */
export function getSiteLogHistory(projectId: number, page = 0, size = 20): Promise<PageResponse<SiteLogSummary>> {
  return api<PageResponse<SiteLogSummary>>(`/api/v1/projects/${projectId}/site-logs?page=${page}&size=${size}`);
}

/** Prefill suggestion: CHECK_IN attendance + DONE kanban tasks. */
export function getSiteLogSuggestion(projectId: number, date: string): Promise<SiteLogSuggestion> {
  return api<SiteLogSuggestion>(`/api/v1/projects/${projectId}/site-logs/attendance-suggestion?date=${date}`);
}

/** Create or upsert (by work date) the project's site log. */
export function saveSiteLog(projectId: number, payload: SiteLogPayload): Promise<SiteLogResponse> {
  return api<SiteLogResponse>(`/api/v1/projects/${projectId}/site-logs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSiteLog(id: number, payload: Partial<SiteLogPayload>): Promise<SiteLogResponse> {
  return api<SiteLogResponse>(`/api/v1/site-logs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/** Multipart photo upload: a `photo` file part + optional `caption` field. */
export function uploadSiteLogPhoto(siteLogId: number, file: File, caption?: string): Promise<SiteLogResponse> {
  const formData = new FormData();
  formData.append('photo', file);
  if (caption && caption.trim()) formData.append('caption', caption.trim());
  return apiMultipart<SiteLogResponse>(`/api/v1/site-logs/${siteLogId}/photos`, 'POST', formData);
}

export function deleteSiteLogPhoto(siteLogId: number, photoId: number): Promise<void> {
  return api<void>(`/api/v1/site-logs/${siteLogId}/photos/${photoId}`, { method: 'DELETE' });
}

/** Authenticated download URL — consumed by a blob fetch (a bare <img src> can't send the session cookie reliably). */
export function siteLogPhotoUrl(siteLogId: number, photoId: number): string {
  return `${getBaseUrl()}/api/v1/site-logs/${siteLogId}/photos/${photoId}`;
}
