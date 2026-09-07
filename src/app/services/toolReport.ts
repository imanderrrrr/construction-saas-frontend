import { api } from '../lib/api';
import type { PageResponse } from './warehouse';

/**
 * The tool report, aggregated on the server.
 *
 * The screen used to ask for the inventory — capped at 500 tools — and count
 * in the browser. That is why the breakdown left out the sixth state, the
 * percentages never added to 100, and a company past the cap got a report
 * that quietly described a subset of itself.
 *
 * One filter contract for everything: the same `status`, `category` and
 * `projectId` go to the figures and to the paged list, so a printed page can
 * never describe a different universe than the screen it came from.
 */

export interface ToolReportFilters {
  /** The display name the wire travels by: "Pending Acceptance". */
  status?: string;
  category?: string;
  projectId?: number;
}

export interface ToolReportStatusRow {
  status: string;
  count: number;
}

export interface ToolReportCategoryRow {
  category: string;
  count: number;
  out: number;
}

export interface ToolReportMissingSummary {
  total: number;
  unsigned: number;
  unsignedOver48h: number;
  overdue: number;
  oldestDays: number | null;
}

export interface ToolReportProjectRow {
  projectId: number | null;
  project: string | null;
  out: number;
  unsigned: number;
}

export interface ToolReportWorkerRow {
  workerId: number | null;
  worker: string | null;
  out: number;
  unsigned: number;
  oldestDays: number | null;
}

export interface ToolReportSupplyUse {
  consumableId: number;
  code: string;
  name: string;
  unit: string;
  quantity: number;
}

export interface ToolReportSupplies {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  dispatches: number;
  topUsed: ToolReportSupplyUse[];
}

export interface ToolReport {
  computedAt: string;
  /** Tools in the company, whatever the filters say. */
  totalInCompany: number;
  /** Tools that match the filters: the universe every figure describes. */
  total: number;
  /** Always the six, in enum order, zeros included. */
  byStatus: ToolReportStatusRow[];
  /** Always the five categories, in enum order, zeros included. */
  byCategory: ToolReportCategoryRow[];
  outOfWarehouse: number;
  avgDaysOut: number | null;
  missing: ToolReportMissingSummary;
  byProject: ToolReportProjectRow[];
  byWorker: ToolReportWorkerRow[];
  supplies: ToolReportSupplies;
}

export interface ToolReportMissingRow {
  toolId: number;
  code: string;
  name: string;
  category: string;
  status: string;
  worker: string | null;
  project: string | null;
  /** The last recorded checkout. Null when the tool went out before the history did. */
  outSince: string | null;
  daysOut: number | null;
  unsigned: boolean;
}

function query(filters: ToolReportFilters, extra: Record<string, string | number> = {}): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  if (filters.projectId != null) params.set('projectId', String(filters.projectId));
  for (const [key, value] of Object.entries(extra)) params.set(key, String(value));
  const q = params.toString();
  return q ? `?${q}` : '';
}

export function getToolReport(filters: ToolReportFilters = {}): Promise<ToolReport> {
  return api<ToolReport>(`/api/v1/admin/reports/tools${query(filters)}`);
}

export function getMissingTools(
  filters: ToolReportFilters = {},
  page = 0,
  size = 20,
): Promise<PageResponse<ToolReportMissingRow>> {
  return api<PageResponse<ToolReportMissingRow>>(
    `/api/v1/admin/reports/tools/missing${query(filters, { page, size })}`,
  );
}
