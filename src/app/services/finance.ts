// OFJR Construction — Finance API Service (Payables & Receivables)

import { api, apiMultipart, getBaseUrl } from '../lib/api';
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
  voided?: boolean;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
}

export type PayableDocumentType = 'BILL' | 'INVOICE';

export interface Payable {
  id: number;
  billNumber: string;
  vendor: string;
  category: string;
  project: string;
  projectId: number;
  description: string | null;
  /** AP Block 2 — "BILL" (cuenta) or "INVOICE" (factura). */
  documentType: PayableDocumentType;
  /** AP Block 2 — supplier invoice number; null until promoted to an invoice. */
  invoiceNumber: string | null;
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
  /** AP Block 4 — server-side filter by project. */
  projectId?: number;
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

/** Correct the total amount of a bill. Cannot drop below what is already paid. */
export function updatePayableAmount(id: number, data: { amount: number; reason?: string }): Promise<Payable> {
  const { amount, ...rest } = data;
  return api<Payable>(`${PAYABLES}/${id}/amount`, {
    method: 'PATCH',
    body: JSON.stringify({ ...rest, amountCents: toCents(amount) }),
  });
}

/** Mark a bill as unpaid: voids all active payments (kept in history) and restores the project budget. */
export function markPayableUnpaid(id: number, reason?: string): Promise<Payable> {
  return api<Payable>(`${PAYABLES}/${id}/unpay`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** Void a single payment (kept in history) and restore the project budget. */
export function voidPayablePayment(id: number, paymentId: number, reason?: string): Promise<Payable> {
  return api<Payable>(`${PAYABLES}/${id}/payments/${paymentId}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** AP Block 2 — promote a bill (cuenta) to an invoice (factura) by assigning its invoice number. */
export function convertPayableToInvoice(id: number, invoiceNumber: string): Promise<Payable> {
  return api<Payable>(`${PAYABLES}/${id}/convert-to-invoice`, {
    method: 'PATCH',
    body: JSON.stringify({ invoiceNumber }),
  });
}

/** AP Block 2 — correct a bill's received / due dates (dueDate must be >= receivedDate). */
export function updatePayableDates(id: number, data: { receivedDate: string; dueDate: string }): Promise<Payable> {
  return api<Payable>(`${PAYABLES}/${id}/dates`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** AP Block 2 — soft-delete a bill / invoice. Blocked (409) while it has active payments. */
export function deletePayable(id: number): Promise<void> {
  return api<void>(`${PAYABLES}/${id}`, { method: 'DELETE' });
}

/**
 * AP Block 4 — reassign a bill / invoice to another project.
 * Blocked (409 PAYABLE_HAS_ACTIVE_PAYMENTS) while it has active payments:
 * void them first (the budget returns to the source project), then reassign.
 */
export function reassignPayableProject(id: number, projectId: number): Promise<Payable> {
  return api<Payable>(`${PAYABLES}/${id}/project`, {
    method: 'PATCH',
    body: JSON.stringify({ projectId }),
  });
}

// ── Payable photo attachments (bytes in object storage) ──

export interface PayableAttachmentResponse {
  id: number;
  payableId: number;
  contentType: string;
  originalName: string | null;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

export function listPayableAttachments(payableId: number): Promise<PayableAttachmentResponse[]> {
  return api<PayableAttachmentResponse[]>(`${PAYABLES}/${payableId}/attachments`);
}

export function uploadPayableAttachment(payableId: number, file: File): Promise<PayableAttachmentResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiMultipart<PayableAttachmentResponse>(`${PAYABLES}/${payableId}/attachments`, 'POST', form);
}

/** Authenticated download URL — consumed by AuthImage (blob fetch with the session cookie). */
export function payableAttachmentUrl(payableId: number, attachmentId: number): string {
  return `${getBaseUrl()}${PAYABLES}/${payableId}/attachments/${attachmentId}/file`;
}

export function deletePayableAttachment(payableId: number, attachmentId: number): Promise<void> {
  return api<void>(`${PAYABLES}/${payableId}/attachments/${attachmentId}`, { method: 'DELETE' });
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
