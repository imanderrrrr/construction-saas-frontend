// OFJR Construction — Finance API Service (Payables & Receivables)

import { api } from '../lib/api';
import type { BudgetWarning } from '../types';

// ── Shared ────���─────────────────────────────────────

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

function qs(params: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '' && v !== 'all') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ── Payables (Accounts Payable) ─────────────────────

export interface PayablePayment {
  id: number;
  date: string;
  amount: number;
  method: string;
  reference?: string;
  approvedBy?: string;
}

export interface Payable {
  id: number;
  billNumber: string;
  vendor: string;
  category: string;
  project: string;
  projectId: number;
  description: string | null;
  receivedDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: string;
  notes: string | null;
  payments: PayablePayment[];
  createdAt: string;
  updatedAt: string;
  budgetWarning?: BudgetWarning | null;
}

const PAYABLES = '/api/v1/finance/payables';

export function listPayables(params?: {
  vendor?: string;
  status?: string;
  category?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<Payable>> {
  return api<PageResponse<Payable>>(`${PAYABLES}${qs({ ...params })}`);
}

export function getPayable(id: number): Promise<Payable> {
  return api<Payable>(`${PAYABLES}/${id}`);
}

/** Convert a dollar amount to integer cents for the API. */
function toCents(dollars: number): number {
  const parts = dollars.toFixed(2).split('.');
  return Math.abs(parseInt(parts[0], 10)) * 100 + parseInt(parts[1], 10);
}

export function createPayable(data: {
  billNumber?: string;
  vendor: string;
  category: string;
  projectId: number;
  description?: string;
  receivedDate: string;
  dueDate: string;
  amount: number;
  notes?: string;
}): Promise<Payable> {
  const { amount, ...rest } = data;
  return api<Payable>(PAYABLES, {
    method: 'POST',
    body: JSON.stringify({ ...rest, amountCents: toCents(amount) }),
  });
}

export function recordPayablePayment(id: number, data: {
  amount: number;
  date: string;
  method: string;
  reference?: string;
  approvedBy?: string;
}): Promise<Payable> {
  const { amount, ...rest } = data;
  return api<Payable>(`${PAYABLES}/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify({ ...rest, amountCents: toCents(amount) }),
  });
}

export function listPayableVendors(): Promise<string[]> {
  return api<string[]>(`${PAYABLES}/vendors`);
}

// ── Receivables (Accounts Receivable) ───────────────

export interface ReceivablePayment {
  id: number;
  date: string;
  amount: number;
  method: string;
  reference?: string;
}

export interface ReceivableLineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type DocumentType = 'INVOICE' | 'CHANGE_ORDER_REQUEST';

export interface Receivable {
  id: number;
  documentType: DocumentType;
  invoiceNumber: string;
  client: string;
  project: string;
  projectId: number;
  description: string | null;
  issuedDate: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  amount: number;
  paidAmount: number;
  status: string;
  notes: string | null;
  /** Username of admin who approved a CHANGE_ORDER_REQUEST. Null otherwise. */
  approvedBy?: string | null;
  /** Timestamp the change order was approved. Null otherwise. */
  approvedAt?: string | null;
  lineItems: ReceivableLineItem[];
  payments: ReceivablePayment[];
  createdAt: string;
  updatedAt: string;
}

const RECEIVABLES = '/api/v1/finance/receivables';

export function listReceivables(params?: {
  projectId?: number;
  status?: string;
  documentType?: string;
  issuedFrom?: string;
  issuedTo?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<Receivable>> {
  return api<PageResponse<Receivable>>(`${RECEIVABLES}${qs({ ...params })}`);
}

export function getReceivable(id: number): Promise<Receivable> {
  return api<Receivable>(`${RECEIVABLES}/${id}`);
}

export function createReceivable(data: {
  documentType?: DocumentType;
  invoiceNumber?: string;
  client: string;
  projectId: number;
  description?: string;
  issuedDate: string;
  dueDate: string;
  amount?: number;
  lineItems?: { description: string; quantity: number; unitPrice: number }[];
  discount?: number;
  taxRate?: number;
  notes?: string;
}): Promise<Receivable> {
  return api<Receivable>(RECEIVABLES, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function recordReceivablePayment(id: number, data: {
  amount: number;
  date: string;
  method: string;
  reference?: string;
}): Promise<Receivable> {
  return api<Receivable>(`${RECEIVABLES}/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function listReceivableClients(): Promise<string[]> {
  return api<string[]>(`${RECEIVABLES}/clients`);
}

/**
 * Approve a change-order request. Transitions PENDING_APPROVAL → PENDING
 * server-side, stamping who approved and when.
 */
export function approveChangeOrder(id: number): Promise<Receivable> {
  return api<Receivable>(`${RECEIVABLES}/${id}/approve`, {
    method: 'POST',
  });
}
