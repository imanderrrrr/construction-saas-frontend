// OFJR Construction — Kanban Tasks Service
// Admin CRUD + Supervisor read/move over /api/v1/admin/tasks and /api/v1/supervisor/tasks

import { api } from '../lib/api';

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

// ── Task status metadata ─────────────────────────────

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

/** Canonical forward-only order. Higher index = further along. */
export const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  TODO:        0,
  IN_PROGRESS: 1,
  REVIEW:      2,
  DONE:        3,
};

export const TASK_STATUS_LABELS: Record<TaskStatus, { en: string; es: string }> = {
  TODO:        { en: 'To Do',       es: 'Por hacer' },
  IN_PROGRESS: { en: 'In Progress', es: 'En progreso' },
  REVIEW:      { en: 'Review',      es: 'Revisión' },
  DONE:        { en: 'Done',        es: 'Completado' },
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, { en: string; es: string }> = {
  LOW:    { en: 'Low',    es: 'Baja' },
  MEDIUM: { en: 'Medium', es: 'Media' },
  HIGH:   { en: 'High',   es: 'Alta' },
  URGENT: { en: 'Urgent', es: 'Urgente' },
};

// ── Admin endpoints ──────────────────────────────────

export async function listTasksByProject(projectId: number): Promise<TaskResponse[]> {
  return api<TaskResponse[]>(`/api/v1/admin/tasks?projectId=${projectId}`);
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

export async function listSupervisorTasks(): Promise<TaskResponse[]> {
  return api<TaskResponse[]>('/api/v1/supervisor/tasks');
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
