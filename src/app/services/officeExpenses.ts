// OFJR Construction — Office Expenses API Service

import { api } from '../lib/api';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface OfficeExpense {
  id: number;
  description: string;
  category: string;
  amount: number;
  purchaseDate: string;
  purchasedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function qs(params: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '' && v !== 'all') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

const BASE = '/api/v1/admin/office-expenses';

function toCents(dollars: number): number {
  const parts = dollars.toFixed(2).split('.');
  return Math.abs(parseInt(parts[0], 10)) * 100 + parseInt(parts[1], 10);
}

export function listOfficeExpenses(params?: {
  category?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<OfficeExpense>> {
  return api<PageResponse<OfficeExpense>>(`${BASE}${qs({ ...params })}`);
}

export function getOfficeExpense(id: number): Promise<OfficeExpense> {
  return api<OfficeExpense>(`${BASE}/${id}`);
}

export function createOfficeExpense(data: {
  description: string;
  category: string;
  amount: number;
  purchaseDate: string;
  purchasedBy?: string;
  notes?: string;
}): Promise<OfficeExpense> {
  const { amount, ...rest } = data;
  return api<OfficeExpense>(BASE, {
    method: 'POST',
    body: JSON.stringify({ ...rest, amountCents: toCents(amount) }),
  });
}

export function updateOfficeExpense(id: number, data: {
  description?: string;
  category?: string;
  amount?: number;
  purchaseDate?: string;
  purchasedBy?: string;
  notes?: string;
}): Promise<OfficeExpense> {
  const { amount, ...rest } = data;
  const body: Record<string, unknown> = { ...rest };
  if (amount != null) body.amountCents = toCents(amount);
  return api<OfficeExpense>(`${BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteOfficeExpense(id: number): Promise<void> {
  return api<void>(`${BASE}/${id}`, { method: 'DELETE' });
}
