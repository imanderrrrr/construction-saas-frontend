import { api, getBaseUrl } from '../lib/api';

export interface ConsumptionAmounts {
  payrollCents: number;
  subcontractorCents: number;
  supplierCents: number;
  warehouseCents: number;
  expenseCents: number;
  totalConsumedCents: number;
}
export interface ProjectConsumptionRow extends ConsumptionAmounts {
  projectId: number;
  projectName: string;
}
export interface BudgetConsumptionResponse {
  computedAt: string;
  projects: ProjectConsumptionRow[];
  totals: ConsumptionAmounts;
}
export function getBudgetConsumption(readOnly = false): Promise<BudgetConsumptionResponse> {
  return api(`/api/v1/${readOnly ? 'finance' : 'admin'}/budgets/consumption-breakdown`);
}

export async function exportBudgetReport({ format, lang, readOnly, projectIds }: {
  format: 'pdf' | 'excel'; lang: string; readOnly: boolean; projectIds: number[];
}): Promise<void> {
  if (!projectIds.length) return;
  const query = new URLSearchParams({ format, lang, projectIds: projectIds.join(',') });
  const response = await fetch(`${getBaseUrl()}/api/v1/${readOnly ? 'finance' : 'admin'}/budgets/report/export?${query}`, {
    credentials: 'include', headers: { 'Accept-Language': lang },
  });
  if (!response.ok) throw new Error(`Budget export failed (${response.status})`);
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const quoted = /filename="([^"\r\n]+)"/i.exec(disposition)?.[1];
  let filename = quoted ?? `budget-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
  if (encoded) { try { filename = decodeURIComponent(encoded); } catch { /* keep fallback */ } }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
}
