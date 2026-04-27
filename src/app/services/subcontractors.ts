// OFJR Construction — Subcontractor Admin Service
// All admin API endpoints for subcontractor job & invoice management

import { api, getBaseUrl } from '../lib/api';

// ── Types ────────────────────────────────────────────

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// Jobs

export type JobStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'OBSERVED' | 'APPROVED' | 'CLOSED';

export interface SubcontractorJobDTO {
  id: number;
  subcontractorId: number;
  subcontractorName: string | null;
  projectId: number;
  projectName: string;
  title: string;
  description: string | null;
  status: JobStatus;
  agreedAmountCents: number | null;
  dueDate: string | null;
  assignedAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidenceCount: number | null;
  observationCount: number | null;
  isOverdue: boolean | null;
}

export interface CreateJobPayload {
  subcontractorId: number;
  projectId: number;
  title: string;
  description?: string | null;
  dueDate?: string | null;
}

export interface UpdateJobStatusPayload {
  status: string;
  comment?: string | null;
}

// Timeline

export interface TimelineEntry {
  id: number;
  action: string;
  actorName: string | null;
  comment: string | null;
  createdAt: string;
}

// Evidence

export type EvidenceType = 'PROGRESS_PHOTO' | 'FINAL_EVIDENCE' | 'DOCUMENT' | 'INVOICE';

export interface EvidenceEntry {
  id: number;
  jobId: number;
  uploaderId: number;
  uploaderName: string | null;
  evidenceType: EvidenceType;
  contentType: string;
  originalName: string | null;
  description: string | null;
  createdAt: string;
}

// Observations

export interface ObservationEntry {
  id: number;
  authorId: number;
  authorName: string | null;
  authorRole: string;
  message: string;
  createdAt: string;
}

export interface CreateObservationPayload {
  message: string;
}

// Invoices

export type InvoiceStatus = 'SUBMITTED' | 'IN_REVIEW' | 'OBSERVED' | 'APPROVED' | 'PENDING_PAYMENT' | 'PAID';

export interface SubcontractorInvoiceDTO {
  id: number;
  jobId: number;
  jobTitle: string;
  projectName: string | null;
  subcontractorId: number;
  subcontractorName: string | null;
  amountCents: number;
  invoiceNumber: string | null;
  description: string | null;
  status: InvoiceStatus;
  hasFile: boolean;
  fileContentType: string | null;
  reviewerId: number | null;
  reviewerName: string | null;
  reviewerComment: string | null;
  reviewedAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewInvoicePayload {
  action: 'APPROVE' | 'OBSERVE';
  comment?: string | null;
}

export interface RegisterPaymentPayload {
  paymentReference?: string | null;
}

// Status transitions

/** Subcontractor-side strict transitions. */
export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  ASSIGNED:    ['IN_PROGRESS'],
  IN_PROGRESS: ['IN_REVIEW'],
  IN_REVIEW:   ['OBSERVED', 'APPROVED'],
  OBSERVED:    ['IN_PROGRESS'],
  APPROVED:    ['CLOSED'],
  CLOSED:      [],
};

/** Admin can move a job to any status (except the current one). */
export const ADMIN_JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  ASSIGNED:    ['IN_PROGRESS', 'IN_REVIEW', 'OBSERVED', 'APPROVED', 'CLOSED'],
  IN_PROGRESS: ['ASSIGNED', 'IN_REVIEW', 'OBSERVED', 'APPROVED', 'CLOSED'],
  IN_REVIEW:   ['ASSIGNED', 'IN_PROGRESS', 'OBSERVED', 'APPROVED', 'CLOSED'],
  OBSERVED:    ['ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED', 'CLOSED'],
  APPROVED:    ['ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'OBSERVED', 'CLOSED'],
  CLOSED:      ['ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'OBSERVED', 'APPROVED'],
};

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  SUBMITTED:       ['IN_REVIEW'],
  IN_REVIEW:       ['OBSERVED', 'APPROVED'],
  OBSERVED:        ['IN_REVIEW'],
  APPROVED:        ['PENDING_PAYMENT'],
  PENDING_PAYMENT: ['PAID'],
  PAID:            [],
};

// ── Helper ─────────────────────────────────────────

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ── Jobs API ───────────────────────────────────────

export async function listJobs(params: {
  subcontractorId?: number;
  projectId?: number;
  status?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<SubcontractorJobDTO>> {
  const q = buildQuery({
    subcontractorId: params.subcontractorId,
    projectId: params.projectId,
    status: params.status,
    page: params.page ?? 0,
    size: params.size ?? 20,
  });
  return api<PageResponse<SubcontractorJobDTO>>(`/api/v1/admin/subcontractor-jobs${q}`);
}

export async function getJob(id: number): Promise<SubcontractorJobDTO> {
  return api<SubcontractorJobDTO>(`/api/v1/admin/subcontractor-jobs/${id}`);
}

export async function createJob(payload: CreateJobPayload): Promise<SubcontractorJobDTO> {
  return api<SubcontractorJobDTO>('/api/v1/admin/subcontractor-jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateJobStatus(id: number, payload: UpdateJobStatusPayload): Promise<SubcontractorJobDTO> {
  return api<SubcontractorJobDTO>(`/api/v1/admin/subcontractor-jobs/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getJobTimeline(id: number): Promise<TimelineEntry[]> {
  return api<TimelineEntry[]>(`/api/v1/admin/subcontractor-jobs/${id}/timeline`);
}

export async function getJobEvidence(id: number, type?: string): Promise<EvidenceEntry[]> {
  const q = type ? `?type=${type}` : '';
  return api<EvidenceEntry[]>(`/api/v1/admin/subcontractor-jobs/${id}/evidence${q}`);
}

export async function getJobObservations(id: number): Promise<ObservationEntry[]> {
  return api<ObservationEntry[]>(`/api/v1/admin/subcontractor-jobs/${id}/observations`);
}

export async function addJobObservation(id: number, payload: CreateObservationPayload): Promise<ObservationEntry> {
  return api<ObservationEntry>(`/api/v1/admin/subcontractor-jobs/${id}/observations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Evidence helpers ──────────────────────────────

export function getEvidenceFileUrl(evidenceId: number): string {
  return `/api/v1/subcontractor-evidence/${evidenceId}/file`;
}

export function getInvoiceFileUrl(invoiceId: number): string {
  return `/api/v1/admin/subcontractor-invoices/${invoiceId}/file`;
}

// ── Invoices API ───────────────────────────────────

export async function listInvoices(params: {
  subcontractorId?: number;
  status?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<SubcontractorInvoiceDTO>> {
  const q = buildQuery({
    subcontractorId: params.subcontractorId,
    status: params.status,
    page: params.page ?? 0,
    size: params.size ?? 20,
  });
  return api<PageResponse<SubcontractorInvoiceDTO>>(`/api/v1/admin/subcontractor-invoices${q}`);
}

export async function reviewInvoice(id: number, payload: ReviewInvoicePayload): Promise<SubcontractorInvoiceDTO> {
  return api<SubcontractorInvoiceDTO>(`/api/v1/admin/subcontractor-invoices/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function registerPayment(id: number, payload: RegisterPaymentPayload): Promise<SubcontractorInvoiceDTO> {
  return api<SubcontractorInvoiceDTO>(`/api/v1/admin/subcontractor-invoices/${id}/payment`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
