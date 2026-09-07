// BuildTrack — Tasks service.
// The admin's list and the supervisor's, over /api/v1/admin/tasks and
// /api/v1/supervisor/tasks. Both roles read the same shape; the supervisor's
// is narrowed to the projects they are assigned to, on the server.

import { api, apiMultipart, getBaseUrl } from '../lib/api';

// ── Types ────────────────────────────────────────────

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskResponse {
  id: number;
  projectId: number;
  projectName: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId: number | null;
  assignedToName: string | null;
  startDate: string | null;
  dueDate: string | null;
  sortOrder: number;
  createdById: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  /**
   * When the task last changed step — its creation counts as the first move.
   * The row's "7 d en revisión" is measured from here, not from `updatedAt`,
   * which also moves when someone edits the title.
   */
  stepSince?: string | null;
  commentCount?: number | null;
  photoCount?: number | null;
  documentCount?: number | null;
  historyCount?: number | null;
}

/** The header's figures and the counts the chips and the person picker carry. */
export interface TaskSummary {
  open: number;
  overdue: number;
  dueToday: number;
  thisWeek: number;
  noDates: number;
  unassigned: number;
  /** Drawn in its own group, never added to `open`. */
  closedThisWeek: number;
  openByProject: Record<string, number>;
  openByAssignee: Record<string, number>;
}

export interface TaskPage {
  content: TaskResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface TaskQuery {
  projectId?: number;
  assigneeId?: number;
  /** Only the tasks nobody owns. */
  unassigned?: boolean;
  status?: TaskStatus;
  /** Drop the finished work the header does not count. */
  openOnly?: boolean;
  /** Title or assignee name, matched on the server across every page. */
  search?: string;
  page?: number;
  size?: number;
}

export interface CreateTaskPayload {
  projectId: number;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assignedToId?: number;
  startDate?: string;
  dueDate?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  /** Never null: clearing the owner goes through `unassignTask`. */
  assignedToId?: number;
  startDate?: string;
  dueDate?: string;
}

export interface MoveTaskPayload {
  status: TaskStatus;
  sortOrder?: number;
}

export interface TaskStatusHistoryEntry {
  id: number;
  /** null means the task was just created (initial placement in TODO) */
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  movedById: number;
  movedByUsername: string;
  movedByFullName: string | null;
  movedAt: string;
}

export interface TaskComment {
  id: number;
  authorId: number;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedById: number;
  uploadedByName: string;
  createdAt: string;
}

/** True for attachments that render as a thumbnail/lightbox image (vs. a document row). */
export function isImageAttachment(a: TaskAttachment): boolean {
  return a.contentType.startsWith('image/');
}

/** Human-readable file size (e.g. "8 KB", "1.4 MB"). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

// ── Task status metadata ─────────────────────────────

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

/** Canonical forward-only order. Higher index = further along. */
export const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  TODO:        0,
  IN_PROGRESS: 1,
  REVIEW:      2,
  DONE:        3,
};

/**
 * The four steps, in the only order the server allows.
 *
 * Their names are not here any more: they used to be a hand-written
 * `{ en, es }` map in this file — outside i18n, so the panel's language toggle
 * could not reach them. They live in `tasks.step.*` now.
 */
export function nextStep(status: TaskStatus): TaskStatus | null {
  const i = TASK_STATUSES.indexOf(status);
  return i >= 0 && i < TASK_STATUSES.length - 1 ? TASK_STATUSES[i + 1] : null;
}

export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// ── Admin endpoints ──────────────────────────────────

function taskQuery(q: TaskQuery): string {
  const p = new URLSearchParams();
  if (q.projectId != null) p.set('projectId', String(q.projectId));
  if (q.assigneeId != null) p.set('assigneeId', String(q.assigneeId));
  if (q.unassigned) p.set('unassigned', 'true');
  if (q.status) p.set('status', q.status);
  if (q.openOnly) p.set('openOnly', 'true');
  if (q.search) p.set('search', q.search);
  p.set('page', String(q.page ?? 0));
  p.set('size', String(q.size ?? 100));
  return `?${p.toString()}`;
}

/** The list. Without `projectId` it spans every project — the panel no longer starts by picking one. */
export async function listTasks(q: TaskQuery = {}): Promise<TaskPage> {
  return api<TaskPage>(`/api/v1/admin/tasks${taskQuery(q)}`);
}

export async function getTasksSummary(): Promise<TaskSummary> {
  return api<TaskSummary>('/api/v1/admin/tasks/summary');
}

export async function getTask(id: number): Promise<TaskResponse> {
  return api<TaskResponse>(`/api/v1/admin/tasks/${id}`);
}

/**
 * Leave a task with no owner. Its own endpoint because a PATCH cannot say it:
 * there a null `assignedToId` already means "don't change the assignee".
 */
export async function unassignTask(id: number): Promise<TaskResponse> {
  return api<TaskResponse>(`/api/v1/admin/tasks/${id}/assignee`, { method: 'DELETE' });
}

export async function createTask(payload: CreateTaskPayload): Promise<TaskResponse> {
  return api<TaskResponse>('/api/v1/admin/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTask(id: number, payload: UpdateTaskPayload): Promise<TaskResponse> {
  return api<TaskResponse>(`/api/v1/admin/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function moveTask(id: number, payload: MoveTaskPayload): Promise<TaskResponse> {
  return api<TaskResponse>(`/api/v1/admin/tasks/${id}/move`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTask(id: number): Promise<void> {
  return api<void>(`/api/v1/admin/tasks/${id}`, { method: 'DELETE' });
}

// ── Supervisor endpoints ─────────────────────────────

export async function listSupervisorTasks(q: TaskQuery = {}): Promise<TaskPage> {
  return api<TaskPage>(`/api/v1/supervisor/tasks${taskQuery(q)}`);
}

export async function getSupervisorTasksSummary(): Promise<TaskSummary> {
  return api<TaskSummary>('/api/v1/supervisor/tasks/summary');
}

export async function getSupervisorTask(id: number): Promise<TaskResponse> {
  return api<TaskResponse>(`/api/v1/supervisor/tasks/${id}`);
}

export async function supervisorMoveTask(id: number, payload: MoveTaskPayload): Promise<TaskResponse> {
  return api<TaskResponse>(`/api/v1/supervisor/tasks/${id}/move`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getTaskHistory(id: number): Promise<TaskStatusHistoryEntry[]> {
  return api<TaskStatusHistoryEntry[]>(`/api/v1/admin/tasks/${id}/history`);
}

export async function supervisorGetTaskHistory(id: number): Promise<TaskStatusHistoryEntry[]> {
  return api<TaskStatusHistoryEntry[]>(`/api/v1/supervisor/tasks/${id}/history`);
}

// ── Comments ─────────────────────────────────────────

export async function getTaskComments(taskId: number): Promise<TaskComment[]> {
  return api<TaskComment[]>(`/api/v1/admin/tasks/${taskId}/comments`);
}

export async function addTaskComment(taskId: number, body: string): Promise<TaskComment> {
  return api<TaskComment>(`/api/v1/admin/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

// ── Attachments ──────────────────────────────────────
// Admin routes — the task-detail modal is admin-side (the Kanban board).

export async function getTaskAttachments(taskId: number): Promise<TaskAttachment[]> {
  return api<TaskAttachment[]>(`/api/v1/admin/tasks/${taskId}/attachments`);
}

export async function uploadTaskAttachment(taskId: number, file: File): Promise<TaskAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  return apiMultipart<TaskAttachment>(`/api/v1/admin/tasks/${taskId}/attachments`, 'POST', formData);
}

export async function deleteTaskAttachment(taskId: number, attId: number): Promise<void> {
  return api<void>(`/api/v1/admin/tasks/${taskId}/attachments/${attId}`, { method: 'DELETE' });
}

/**
 * Authenticated download/preview URL for an attachment. Consumed via a blob
 * fetch (a bare <img src>/<a href> can't reliably carry the session cookie) —
 * see AuthImage and the modal's download/preview helpers.
 */
export function taskAttachmentUrl(taskId: number, attId: number): string {
  return `${getBaseUrl()}/api/v1/admin/tasks/${taskId}/attachments/${attId}/download`;
}
