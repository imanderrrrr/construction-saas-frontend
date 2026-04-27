// OFJR Construction — Warehouse Service
// All warehouse API endpoints: tools, assignments, consumables, dashboard

import { api } from '../lib/api';

// ── Types ────────────────────────────────────────────

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// Dashboard

export interface DashboardActivityEntry {
  id: number;
  date: string;
  code: string;
  tool: string;
  action: string;
  worker: string;
  notes: string;
}

export interface LowStockAlertEntry {
  code: string;
  name: string;
  stock: number;
  min: number;
  unit: string;
  status: string;
}

export interface DashboardKpis {
  totalTools: number;
  availableTools: number;
  assignedTools: number;
  needsAttention: number;
  consumableItems: number;
  lowStockAlerts: number;
}

export interface DashboardResponse {
  recentActivity: DashboardActivityEntry[];
  lowStockAlerts: LowStockAlertEntry[];
  kpis: DashboardKpis;
}

// Tools

export interface ToolHistoryEntry {
  id: number;
  date: string;
  time: string;
  action: string;
  worker: string | null;
  project: string | null;
  toolCode: string | null;
  toolName: string | null;
  notes: string | null;
}

export interface ToolResponse {
  id: number;
  code: string;
  name: string;
  category: string;
  status: string;
  assignedTo: string | null;
  assignedToId: number | null;
  projectName: string | null;
  projectId: number | null;
  lastActivity: string;
  dateRegistered: string;
  notes: string | null;
  history: ToolHistoryEntry[];
}

export interface ToolSummary {
  total: number;
  available: number;
  assigned: number;
  inReview: number;
  damaged: number;
  lost: number;
}

// Assignments

export interface AssignmentResponse {
  id: number;
  toolCode: string;
  toolName: string;
  category: string;
  status: string;
  worker: string;
  workerId: number;
  assignedDate: string;
  project: string;
  projectId: number;
  daysOut: number;
}

export interface AssignmentLogEntry {
  id: number;
  date: string;
  toolCode: string;
  toolName: string;
  action: string;
  worker: string;
  project: string;
  condition: string;
  notes: string;
}

export interface AssignmentSummaryResponse {
  activeAssignments: number;
  assignedToday: number;
  returnedToday: number;
}

// Consumables

export interface ConsumableResponse {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  status: string;
  lastRestocked: string | null;
  notes: string | null;
}

export interface DispatchResponse {
  id: number;
  consumableCode: string;
  consumableName: string;
  unit: string;
  quantity: number;
  project: string;
  projectId: number;
  requestedBy: string;
  requestedById: number;
  date: string;
  notes: string | null;
}

// ── Dashboard ────────────────────────────────────────

export async function getDashboard(): Promise<DashboardResponse> {
  return api<DashboardResponse>('/api/v1/warehouse/dashboard');
}

// ── Tools ────────────────────────────────────────────

export async function listTools(params?: {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<ToolResponse>> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.category) q.set('category', params.category);
  if (params?.search) q.set('search', params.search);
  q.set('page', String(params?.page ?? 0));
  q.set('size', String(params?.size ?? 50));
  return api<PageResponse<ToolResponse>>(`/api/v1/warehouse/tools?${q}`);
}

export async function getToolSummary(): Promise<ToolSummary> {
  return api<ToolSummary>('/api/v1/warehouse/tools/summary');
}

export async function createTool(payload: {
  code: string;
  name: string;
  category: string;
  notes?: string;
}): Promise<ToolResponse> {
  return api<ToolResponse>('/api/v1/warehouse/tools', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTool(id: number, payload: {
  name?: string;
  category?: string;
  notes?: string;
}): Promise<ToolResponse> {
  return api<ToolResponse>(`/api/v1/warehouse/tools/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function changeToolStatus(id: number, payload: {
  newStatus: string;
  reason?: string;
}): Promise<ToolResponse> {
  return api<ToolResponse>(`/api/v1/warehouse/tools/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getToolHistory(toolId: number): Promise<ToolHistoryEntry[]> {
  return api<ToolHistoryEntry[]>(`/api/v1/warehouse/tools/${toolId}/history`);
}

export async function getGlobalToolHistory(params?: {
  toolCode?: string;
  action?: string;
  worker?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<ToolHistoryEntry>> {
  const q = new URLSearchParams();
  if (params?.toolCode) q.set('toolCode', params.toolCode);
  if (params?.action) q.set('action', params.action);
  if (params?.worker) q.set('worker', params.worker);
  if (params?.dateFrom) q.set('dateFrom', params.dateFrom);
  if (params?.dateTo) q.set('dateTo', params.dateTo);
  q.set('page', String(params?.page ?? 0));
  q.set('size', String(params?.size ?? 50));
  return api<PageResponse<ToolHistoryEntry>>(`/api/v1/warehouse/tools/history?${q}`);
}

// ── Assignments ──────────────────────────────────────

export async function getActiveAssignments(): Promise<AssignmentResponse[]> {
  return api<AssignmentResponse[]>('/api/v1/warehouse/assignments/active');
}

export async function getAssignmentLog(params?: {
  page?: number;
  size?: number;
}): Promise<PageResponse<AssignmentLogEntry>> {
  const q = new URLSearchParams();
  q.set('page', String(params?.page ?? 0));
  q.set('size', String(params?.size ?? 50));
  return api<PageResponse<AssignmentLogEntry>>(`/api/v1/warehouse/assignments/log?${q}`);
}

export async function getAssignmentSummary(): Promise<AssignmentSummaryResponse> {
  return api<AssignmentSummaryResponse>('/api/v1/warehouse/assignments/summary');
}

export async function assignTool(payload: {
  toolCode: string;
  toolName?: string;
  worker?: string;
  workerId?: number;
  project?: string;
  projectId?: number;
  notes?: string;
}): Promise<AssignmentResponse> {
  return api<AssignmentResponse>('/api/v1/warehouse/assignments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function returnTool(toolId: number, payload: {
  condition: string;
  notes?: string;
}): Promise<ToolResponse> {
  return api<ToolResponse>(`/api/v1/warehouse/assignments/${toolId}/return`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Worker Projects (for cascading dropdown) ────────

export interface WorkerProjectOption {
  id: number;
  name: string;
}

export async function getWorkerProjects(workerId: number): Promise<WorkerProjectOption[]> {
  return api<WorkerProjectOption[]>(`/api/v1/warehouse/assignments/worker-projects?workerId=${workerId}`);
}

// ── Consumables ──────────────────────────────────────

export async function listConsumables(params?: {
  search?: string;
  category?: string;
}): Promise<ConsumableResponse[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.category) q.set('category', params.category);
  return api<ConsumableResponse[]>(`/api/v1/warehouse/consumables?${q}`);
}

export async function createConsumable(payload: {
  code?: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  notes?: string;
}): Promise<ConsumableResponse> {
  return api<ConsumableResponse>('/api/v1/warehouse/consumables', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateConsumable(id: number, payload: {
  name?: string;
  category?: string;
  unit?: string;
  currentStock?: number;
  minimumStock?: number;
  notes?: string;
}): Promise<ConsumableResponse> {
  return api<ConsumableResponse>(`/api/v1/warehouse/consumables/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getConsumableDispatches(consumableId: number): Promise<DispatchResponse[]> {
  return api<DispatchResponse[]>(`/api/v1/warehouse/consumables/${consumableId}/dispatches`);
}

export async function getAllDispatches(params?: {
  page?: number;
  size?: number;
}): Promise<PageResponse<DispatchResponse>> {
  const q = new URLSearchParams();
  q.set('page', String(params?.page ?? 0));
  q.set('size', String(params?.size ?? 50));
  return api<PageResponse<DispatchResponse>>(`/api/v1/warehouse/consumables/dispatches?${q}`);
}

export async function dispatchConsumable(payload: {
  consumableCode: string;
  consumableName?: string;
  unit?: string;
  quantity: number;
  project?: string;
  projectId?: number;
  requestedBy?: string;
  requestedById?: number;
  notes?: string;
}): Promise<DispatchResponse> {
  return api<DispatchResponse>('/api/v1/warehouse/consumables/dispatch', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Worker / Supervisor / Admin views ────────────────

export async function getWorkerTools(): Promise<AssignmentResponse[]> {
  return api<AssignmentResponse[]>('/api/v1/worker/tools');
}

export async function getWorkerToolSummary(): Promise<ToolSummary> {
  return api<ToolSummary>('/api/v1/worker/tools/summary');
}

export async function getSupervisorTools(): Promise<AssignmentResponse[]> {
  return api<AssignmentResponse[]>('/api/v1/supervisor/tools');
}

export async function getSupervisorToolSummary(): Promise<ToolSummary> {
  return api<ToolSummary>('/api/v1/supervisor/tools/summary');
}

export async function getAdminToolSummary(): Promise<ToolSummary> {
  return api<ToolSummary>('/api/v1/admin/tools/summary');
}

export async function getAdminTools(params?: {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<ToolResponse>> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.category) q.set('category', params.category);
  if (params?.search) q.set('search', params.search);
  q.set('page', String(params?.page ?? 0));
  q.set('size', String(params?.size ?? 50));
  return api<PageResponse<ToolResponse>>(`/api/v1/admin/tools?${q}`);
}
