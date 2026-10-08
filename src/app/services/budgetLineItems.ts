import { api } from '../lib/api';

export const LINE_ITEM_CATEGORIES = ['LABOR', 'SUBCONTRACTOR', 'MATERIAL', 'EQUIPMENT', 'GENERAL'] as const;
export type LineItemCategory = typeof LINE_ITEM_CATEGORIES[number];
export type LineItemVarianceStatus = 'OK' | 'WARNING' | 'OVER_BUDGET';

export interface CreateLineItemPayload {
  code: string;
  name: string;
  category?: LineItemCategory;
  unit?: string;
  quantity?: number;
  unitCostCents?: number;
  originalBudgetCents?: number;
  notes?: string | null;
}

export interface UpdateLineItemPayload extends Partial<CreateLineItemPayload> {
  changeOrdersCents?: number;
  committedCents?: number;
}

export interface LineItemOption { id: number; code: string; name: string }

export interface LineItemSpendByPillar {
  payrollCents: number;
  subcontractorCents: number;
  supplierCents: number;
  warehouseCents: number;
  expenseCents: number;
}

export interface BudgetLineItem extends LineItemOption {
  projectId: number;
  category: LineItemCategory;
  unit: string;
  quantity: number;
  unitCostCents: number;
  originalBudgetCents: number;
  changeOrdersCents: number;
  revisedBudgetCents: number;
  spentCents: number;
  committedCents: number;
  balanceCents: number;
  consumptionPct: number;
  varianceStatus: LineItemVarianceStatus;
  spendByPillar: LineItemSpendByPillar;
  notes: string | null;
}

export interface ProjectWbsSummary {
  projectId: number;
  totalOriginalBudgetCents: number;
  totalRevisedBudgetCents: number;
  totalSpentCents: number;
  totalCommittedCents: number;
  totalBalanceCents: number;
  globalConsumptionPct: number;
  itemsCount: number;
  warningCount: number;
  overBudgetCount: number;
  items: BudgetLineItem[];
}

const projectPath = (projectId: number, readOnly = false) =>
  `/api/v1/${readOnly ? 'finance' : 'admin'}/projects/${projectId}/budget-line-items`;

export function listLineItems(projectId: number, readOnly = false): Promise<BudgetLineItem[]> {
  return api(projectPath(projectId, readOnly));
}

export function getWbsSummary(projectId: number, readOnly = false): Promise<ProjectWbsSummary> {
  return api(`${projectPath(projectId, readOnly)}/summary`);
}

/** Shared, project-authorized endpoint containing no financial details. */
export function listLineItemOptions(projectId: number): Promise<LineItemOption[]> {
  return api(`/api/v1/projects/${projectId}/budget-line-items/options`);
}

export function createLineItem(projectId: number, data: CreateLineItemPayload): Promise<BudgetLineItem> {
  return api(projectPath(projectId), { method: 'POST', body: JSON.stringify(data) });
}

export function bulkImportLineItems(projectId: number, items: CreateLineItemPayload[]): Promise<BudgetLineItem[]> {
  return api(`${projectPath(projectId)}/bulk`, { method: 'POST', body: JSON.stringify({ items }) });
}

export function updateLineItem(id: number, data: UpdateLineItemPayload): Promise<BudgetLineItem> {
  return api(`/api/v1/admin/budget-line-items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteLineItem(id: number): Promise<void> {
  return api(`/api/v1/admin/budget-line-items/${id}`, { method: 'DELETE' });
}
