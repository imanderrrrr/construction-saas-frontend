// OFJR Construction — Expense API Service

import { api, apiMultipart, getBaseUrl } from '../lib/api';
import type { BudgetWarning } from '../types';

// ── Types ─────────────────────────────────────────────

export interface ExpenseResponse {
  id: number;
  workerId: number;
  workerName: string | null;
  workerUsername: string;
  projectId: number;
  projectName: string;
  expenseType: string;
  amountCents: number;
  expenseDate: string;
  description: string | null;
  status: string;
  receiptUrl: string | null;
  reviewerId: number | null;
  reviewerName: string | null;
  reviewerComment: string | null;
  reviewedAt: string | null;
  /**
   * Cuándo el trabajador corrigió un gasto observado y lo reenvió (V102).
   * `null` = nunca se reenvió. La cola lo usa para el chip «Reenviado» y para
   * contar la espera desde que volvió, no desde que se registró.
   */
  resubmittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  budgetWarning?: BudgetWarning | null;
  /**
   * El presupuesto de la obra a la que este gasto le va a restar.
   *
   * Aprobar descuenta el monto del saldo del proyecto, así que el saldo es el
   * dato que decide la aprobación. Lo calcula el servidor con la misma
   * aritmética que dibuja el medidor en Proyectos y Presupuestos. Solo viene en
   * los listados; en la respuesta de aprobar u observar es `null`.
   */
  projectBudget?: ProjectBudgetSnapshot | null;
}

/** `remaining` puede ser negativo: el presupuesto mide, no bloquea. */
export interface ProjectBudgetSnapshot {
  baseCents: number | null;
  consumedCents: number | null;
  remainingCents: number | null;
}

export interface ExpenseSummaryResponse {
  totalSubmitted: number;
  totalApprovedCents: number;
  pendingCount: number;
  observedCount: number;
  rejectedCount: number;
  /**
   * Montos por estado del conjunto filtrado. Llegan con el mismo filtro que la
   * lista, y son la razón de que la cabecera no se calcule nunca sobre la
   * página cargada: con cuarenta pendientes en cuatro páginas, sumar los diez
   * de la pantalla daba un número falso que nadie podía ver.
   */
  approvedCount?: number;
  pendingCents?: number;
  observedCents?: number;
  rejectedCents?: number;
}

export interface BatchApproveResponse {
  approvedCount: number;
  /**
   * Los que no entraron y por qué. El servidor siempre los devolvió; la
   * pantalla anterior leía solo `approvedCount` y cantaba «N aprobados»,
   * así que un gasto saltado se quedaba en la cola sin explicación.
   */
  skipped?: SkippedExpense[];
}

export interface SkippedExpense {
  expenseId: number;
  /** `EXPENSE_NOT_PENDING` (alguien lo revisó antes) o `PROJECT_CLOSED`. */
  code: string;
  reason: string | null;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ExpenseReportKpis {
  totalApprovedCents: number;
  avgPerWorkerCents: number | null;
  expenseCount: number;
  topCategory: string | null;
}

export interface TypeBreakdown {
  type: string;
  count: number;
  totalCents: number;
}

export interface ProjectExpenseRow {
  projectId: number;
  projectName: string;
  approvedCents: number;
  pendingCount: number;
  observedCount: number;
  rejectedCount: number;
  breakdown: TypeBreakdown[];
}

export interface WorkerExpenseRow {
  workerId: number;
  workerName: string | null;
  workerUsername: string;
  submittedCount: number;
  approvedCount: number;
  pendingCount: number;
  observedCount: number;
  rejectedCount: number;
  totalApprovedCents: number;
}

export interface ExpenseReportResponse {
  kpis: ExpenseReportKpis;
  byProject: ProjectExpenseRow[];
  byWorker: WorkerExpenseRow[];
}

// ── Helpers ───────────────────────────────────────────

function qs(params: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '' && v !== 'all') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ── Worker endpoints ─────────────────────────────────

export async function createExpense(
  data: {
    projectId: number;
    expenseType: string;
    amountCents: number;
    expenseDate: string;
    description?: string;
  },
  receiptFile?: File,
): Promise<ExpenseResponse> {
  const formData = new FormData();
  formData.append(
    'data',
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
  );
  if (receiptFile) {
    formData.append('receipt', receiptFile);
  }

  return apiMultipart<ExpenseResponse>('/api/v1/worker/expenses', 'POST', formData);
}

export function getMyExpenses(params?: {
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<ExpenseResponse>> {
  return api<PageResponse<ExpenseResponse>>(
    `/api/v1/worker/expenses${qs({ ...params })}`,
  );
}

export function getMySummary(): Promise<ExpenseSummaryResponse> {
  return api<ExpenseSummaryResponse>('/api/v1/worker/expenses/summary');
}

export async function resubmitExpense(
  id: number,
  data: {
    projectId: number;
    expenseType: string;
    amountCents: number;
    expenseDate: string;
    description?: string;
  },
  receiptFile?: File,
): Promise<ExpenseResponse> {
  const formData = new FormData();
  formData.append(
    'data',
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
  );
  if (receiptFile) formData.append('receipt', receiptFile);

  return apiMultipart<ExpenseResponse>(`/api/v1/worker/expenses/${id}`, 'PUT', formData);
}

// ── Supervisor endpoints ─────────────────────────────

export function getSupervisorExpenses(params?: {
  status?: string;
  type?: string;
  workerId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<ExpenseResponse>> {
  return api<PageResponse<ExpenseResponse>>(
    `/api/v1/supervisor/expenses${qs({ ...params })}`,
  );
}

export function getSupervisorSummary(): Promise<ExpenseSummaryResponse> {
  return api<ExpenseSummaryResponse>('/api/v1/supervisor/expenses/summary');
}

export function supervisorBatchApprove(): Promise<BatchApproveResponse> {
  return api<BatchApproveResponse>('/api/v1/supervisor/expenses/approve-batch', { method: 'POST' });
}

// ── Admin endpoints ──────────────────────────────────

export function getAdminExpenses(params?: {
  status?: string;
  type?: string;
  projectId?: number;
  workerId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<ExpenseResponse>> {
  return api<PageResponse<ExpenseResponse>>(
    `/api/v1/admin/expenses${qs({ ...params })}`,
  );
}

/**
 * Los mismos filtros de la lista menos `status`: la cabecera enseña los cuatro
 * estados del rango y es la pestaña la que recorta la tabla.
 */
export interface ExpenseScope {
  type?: string;
  projectId?: number;
  workerId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export function getAdminSummary(scope: ExpenseScope = {}): Promise<ExpenseSummaryResponse> {
  return api<ExpenseSummaryResponse>(`/api/v1/admin/expenses/summary${qs({ ...scope })}`);
}

/**
 * Aprueba los pendientes **del filtro**. Sin filtros aprueba todos los del
 * inquilino, que es lo que hacía siempre mientras el botón decía otra cosa.
 */
export function adminBatchApprove(scope: ExpenseScope = {}): Promise<BatchApproveResponse> {
  return api<BatchApproveResponse>(
    `/api/v1/admin/expenses/approve-batch${qs({ ...scope })}`,
    { method: 'POST' },
  );
}

// ── Shared review actions ────────────────────────────

/**
 * The approval note is optional — unlike the observe/reject comment, which the
 * backend requires. When there is no note we send no body at all, which is what
 * the endpoint expects (`@RequestBody(required = false)`).
 */
export function approveExpense(id: number, role: 'admin' | 'supervisor', comment?: string): Promise<ExpenseResponse> {
  const base = role === 'admin' ? '/api/v1/admin/expenses' : '/api/v1/supervisor/expenses';
  const note = comment?.trim();
  return api<ExpenseResponse>(`${base}/${id}/approve`, {
    method: 'PUT',
    ...(note ? { body: JSON.stringify({ comment: note }) } : {}),
  });
}

export function observeExpense(id: number, comment: string, role: 'admin' | 'supervisor'): Promise<ExpenseResponse> {
  const base = role === 'admin' ? '/api/v1/admin/expenses' : '/api/v1/supervisor/expenses';
  return api<ExpenseResponse>(`${base}/${id}/observe`, {
    method: 'PUT',
    body: JSON.stringify({ comment }),
  });
}

export function rejectExpense(id: number, comment: string, role: 'admin' | 'supervisor'): Promise<ExpenseResponse> {
  const base = role === 'admin' ? '/api/v1/admin/expenses' : '/api/v1/supervisor/expenses';
  return api<ExpenseResponse>(`${base}/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ comment }),
  });
}

// ── Report ───────────────────────────────────────────

export function getExpenseReport(params?: {
  dateFrom?: string;
  dateTo?: string;
  projectId?: number;
  type?: string;
}): Promise<ExpenseReportResponse> {
  return api<ExpenseReportResponse>(
    `/api/v1/admin/expenses/report${qs({ ...params })}`,
  );
}

export function getFinanceExpenseReport(params?: {
  dateFrom?: string;
  dateTo?: string;
  projectId?: number;
  type?: string;
}): Promise<ExpenseReportResponse> {
  return api<ExpenseReportResponse>(
    `/api/v1/finance/expenses/report${qs({ ...params })}`,
  );
}

// ── Finance endpoints ────────────────────────────────

/**
 * El mismo resumen para el rol de finanzas. Hace falta su propio endpoint
 * porque `/api/v1/admin/**` es ADMIN-only en el matcher de seguridad: finanzas
 * llamando al de admin recibe un 403, no unas cifras.
 */
export function getFinanceSummary(scope: ExpenseScope = {}): Promise<ExpenseSummaryResponse> {
  return api<ExpenseSummaryResponse>(`/api/v1/finance/expenses/summary${qs({ ...scope })}`);
}

export function getFinanceExpenses(params?: {
  type?: string;
  projectId?: number;
  workerId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<ExpenseResponse>> {
  return api<PageResponse<ExpenseResponse>>(
    `/api/v1/finance/expenses${qs({ ...params })}`,
  );
}

// ── Report Export (download file) ────────────────────

export async function exportExpenseReport(params: {
  format: 'xlsx' | 'pdf';
  dateFrom?: string;
  dateTo?: string;
  projectId?: number;
  type?: string;
  role?: 'admin' | 'finance';
}): Promise<void> {
  const { format, role = 'admin', ...rest } = params;
  const basePath = role === 'finance'
    ? '/api/v1/finance/expenses/report/export'
    : '/api/v1/admin/expenses/report/export';

  const queryStr = qs({ format, ...rest });
  const res = await fetch(`${getBaseUrl()}${basePath}${queryStr}`, {
    credentials: 'include',
    headers: {
      'Accept-Language': navigator.language || 'en',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Export failed (${res.status})`);
  }

  const blob = await res.blob();
  const filename = format === 'pdf' ? 'expense-report.pdf' : 'expense-report.xlsx';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Receipt URL builder ──────────────────────────────

export function receiptUrl(expenseId: number): string {
  return `${getBaseUrl()}/api/v1/expenses/${expenseId}/receipt`;
}

export function receiptHeaders(): Record<string, string> {
  return {};
}
