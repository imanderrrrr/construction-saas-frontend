import { api } from '../lib/api';

/**
 * Aggregates for the redesigned admin dashboard (see backend
 * AdminDashboardController). Amounts are cents. `date` is the business
 * "today" the panel already computes with the workspace timezone.
 */

export interface MoneyBlock {
  receivablesOverdue: { amountCents: number; count: number; oldestDays: number };
  payablesDueSoon: { amountCents: number; count: number };
  expensesPending: { amountCents: number; count: number };
}

export interface TodayBlock {
  workersTotal: number;
  byProject: { projectId: number; projectName: string; workers: number }[];
  pendingApprovalRecords: number;
  idleActiveProjects: { id: number; name: string }[];
}

export interface BudgetRow {
  id: number;
  name: string;
  contractCents: number;
  consumedCents: number;
  remainingCents: number;
  consumedPct: number;
  critical: boolean;
}

export interface BudgetBlock {
  projects: BudgetRow[];
  recentChangeOrder: { projectName: string; amountCents: number; countLast30Days: number } | null;
}

export interface ProjectPulse {
  projectId: number;
  projectName: string;
  lastSiteLog: { workDate: string; notes: string | null } | null;
  openPunchItems: number;
  openRfis: number;
  oldestOpenRfiDays: number | null;
  financial: {
    contractCents: number | null;
    invoicedCents: number;
    collectedCents: number;
    budgetConsumedPct: number | null;
  };
  workersToday: string[];
}

const BASE = '/api/v1/admin/dashboard';

export function getMoneyBlock(date: string): Promise<MoneyBlock> {
  return api<MoneyBlock>(`${BASE}/money?date=${date}`);
}

export function getTodayBlock(date: string): Promise<TodayBlock> {
  return api<TodayBlock>(`${BASE}/today?date=${date}`);
}

export function getBudgetBlock(): Promise<BudgetBlock> {
  return api<BudgetBlock>(`${BASE}/budget`);
}

export function getProjectPulse(projectId: number, date: string): Promise<ProjectPulse> {
  return api<ProjectPulse>(`${BASE}/pulse/${projectId}?date=${date}`);
}
