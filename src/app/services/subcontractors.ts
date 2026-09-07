// BuildTrack — Subcontractor admin service.
// Every admin endpoint of the section: the directory, the jobs, their
// evidence and history, and the invoices.

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
  /** What was agreed for the job, in cents. The model and the endpoint have always taken it; the form never asked. */
  agreedAmountCents?: number | null;
  dueDate?: string | null;
}

export interface UpdateJobStatusPayload {
  status: string;
  comment?: string | null;
}

// Timeline

/**
 * The `i18n` payload a server-written history row carries (backend V99): one
 * key plus raw, unformatted params, so the sentence is composed in whatever
 * language the reader has selected right now.
 */
export interface SubcontractorI18n {
  msgKey?: string;
  params?: Record<string, unknown>;
}

export interface TimelineEntry {
  id: number;
  jobId: number;
  actorId: number;
  action: string;
  actorName: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  /**
   * Two different things, both of which must survive: the actor's own words
   * (a comment, a payment reference), shown verbatim in any language, and the
   * English fallback of a machine-written row, which [i18n] supersedes.
   *
   * The panel used to read `comment`, a field this response has never had, so
   * the comment written on a status change was never shown to anyone.
   */
  message: string | null;
  i18n: SubcontractorI18n | null;
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
  /** Composed description for the row the server creates from an invoice (V99). */
  i18n: SubcontractorI18n | null;
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

/**
 * What the admin may move a job to. The subcontractor walks a strict path
 * (ASSIGNED→IN_PROGRESS→IN_REVIEW→{OBSERVED|APPROVED}, OBSERVED→IN_PROGRESS,
 * APPROVED→CLOSED); the admin may jump anywhere, reopening a closed job
 * included — which is why the window that offers this spells out what each
 * jump does and paints the reopen in red.
 */
export const ADMIN_JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  ASSIGNED:    ['IN_PROGRESS', 'IN_REVIEW', 'OBSERVED', 'APPROVED', 'CLOSED'],
  IN_PROGRESS: ['ASSIGNED', 'IN_REVIEW', 'OBSERVED', 'APPROVED', 'CLOSED'],
  IN_REVIEW:   ['ASSIGNED', 'IN_PROGRESS', 'OBSERVED', 'APPROVED', 'CLOSED'],
  OBSERVED:    ['ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED', 'CLOSED'],
  APPROVED:    ['ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'OBSERVED', 'CLOSED'],
  CLOSED:      ['ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'OBSERVED', 'APPROVED'],
};

/**
 * The five invoice states the panel shows, in flow order.
 *
 * PENDING_PAYMENT is deliberately absent. Nothing in the backend writes it —
 * `reviewInvoice` only ever produces APPROVED or OBSERVED — so the state was
 * unreachable, while the panel hung "Registrar pago" off it alone: an approved
 * invoice could not be paid from the panel at all, and the "Revisar" it
 * offered instead came back 409. APPROVED is the state that waits for money,
 * and `APPROVED → PAID` is a transition the server already accepts.
 */
export const INVOICE_STATUS_FLOW: InvoiceStatus[] = ['SUBMITTED', 'IN_REVIEW', 'OBSERVED', 'APPROVED', 'PAID'];

/** An invoice waiting on a decision from the admin. */
export function isReviewable(status: InvoiceStatus): boolean {
  return status === 'SUBMITTED' || status === 'IN_REVIEW';
}

/**
 * An invoice waiting on money. PENDING_PAYMENT is accepted here even though
 * nothing writes it: were a row ever to land there, `PENDING_PAYMENT → PAID`
 * is legal on the server and the panel should not be the reason it is stuck.
 */
export function isPayable(status: InvoiceStatus): boolean {
  return status === 'APPROVED' || status === 'PENDING_PAYMENT';
}

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
  /** Title or subcontractor name, matched on the server across every page. */
  search?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<SubcontractorJobDTO>> {
  const q = buildQuery({
    subcontractorId: params.subcontractorId,
    projectId: params.projectId,
    status: params.status,
    search: params.search,
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

/**
 * Absolute so an `<img src>` / `<video src>` / `<iframe src>` reaches the API
 * and not the dev server: in production the base is empty and these stay
 * relative, which is what keeps the cookie same-origin behind the Vercel
 * proxy. Both are served `inline` with `nosniff`, so the PDF previews in place.
 */
export function getEvidenceFileUrl(evidenceId: number): string {
  return `${getBaseUrl()}/api/v1/subcontractor-evidence/${evidenceId}/file`;
}

export function getInvoiceFileUrl(invoiceId: number): string {
  return `${getBaseUrl()}/api/v1/admin/subcontractor-invoices/${invoiceId}/file`;
}

// ── Invoices API ───────────────────────────────────

export async function listInvoices(params: {
  subcontractorId?: number;
  status?: string;
  /** Invoice number, matched on the server. */
  search?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<SubcontractorInvoiceDTO>> {
  const q = buildQuery({
    subcontractorId: params.subcontractorId,
    status: params.status,
    search: params.search,
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

// ── Overview: the figures and the directory ────────

/**
 * The nine leading figures of the three tabs, counted over the whole tenant.
 *
 * They are a server call precisely because the panel used to add them up in
 * the browser over the twenty rows it already had: "Total Trabajos" could
 * never exceed the page size. When this call fails the panel writes an em
 * dash — it does not fall back to the page.
 */
export interface SubcontractorsSummary {
  activeSubcontractors: number;
  openJobs: number;
  balanceDueCents: number;
  totalJobs: number;
  jobsInReview: number;
  jobsOverdue: number;
  invoicesToReview: number;
  invoicesToPayCount: number;
  invoicesToPayCents: number;
  paidThisMonthCents: number;
}

/** One row of the directory tab: a subcontractor and where you stand with them. */
export interface SubcontractorDirectoryRow {
  subcontractorId: number;
  fullName: string | null;
  username: string;
  email: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING_DELETION';
  totalJobs: number;
  openJobs: number;
  overdueJobs: number;
  invoicesToPay: number;
  balanceCents: number;
}

export type DirectoryJobsFilter = 'WITH_OPEN' | 'NONE';
export type DirectoryBalanceFilter = 'WITH_BALANCE' | 'SETTLED';

const OVERVIEW = '/api/v1/admin/subcontractors';

export async function getSubcontractorsSummary(): Promise<SubcontractorsSummary> {
  return api<SubcontractorsSummary>(`${OVERVIEW}/summary`);
}

export async function listDirectory(params: {
  jobs?: DirectoryJobsFilter;
  balance?: DirectoryBalanceFilter;
  search?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<SubcontractorDirectoryRow>> {
  const q = buildQuery({
    jobs: params.jobs,
    balance: params.balance,
    search: params.search,
    page: params.page ?? 0,
    size: params.size ?? 20,
  });
  return api<PageResponse<SubcontractorDirectoryRow>>(`${OVERVIEW}/directory${q}`);
}
