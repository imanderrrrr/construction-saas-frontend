// OFJR Construction — Time Tracking Service (real API)
// Worker time events + assigned‑projects endpoints.
import { api } from '../lib/api';
import type { WorkerProject, TimeEventType, LocationStatus, WorkerState, BudgetWarning } from '../types';

// Request / Response types

export interface TimeEventRequest {
  projectId: number;
  type: TimeEventType;
  capturedAtClient: string; // ISO 8601
  lat: number | null;
  lng: number | null;
  hasLocationPermission: boolean;
  /** For IN_TRANSIT events: the project the worker is departing from. */
  sourceProjectId?: number;
}

export interface TimeEventResponse {
  eventId: number;
  serverCapturedAt: string;
  locationStatus: string;
  recordId: number;
  nextExpectedType: TimeEventType | null;
}

export interface TimeRecordResponse {
  id: number;
  workerId: number;
  workerUsername: string;
  workerName: string | null;
  projectId: number;
  projectName: string;
  workDate: string; // YYYY-MM-DD
  approvalStatus: 'PENDING' | 'APPROVED' | 'OBSERVED' | 'REJECTED';
  /** True when the CHECK_IN was registered after 08:00. */
  isLate: boolean;
  /** Number of events in this record that still have PENDING review status. Authoritative from server. */
  pendingEventCount: number;
  events: {
    id: number;
    type: TimeEventType;
    capturedAtClient: string;
    capturedAtServer: string;
    lat: number | null;
    lng: number | null;
    locationStatus: string | null;
    eventApprovalStatus: 'PENDING' | 'APPROVED' | 'OBSERVED' | 'REJECTED';
    eventReviewComment: string | null;
    eventReviewerUsername: string | null;
    eventReviewedAt: string | null;
    /** For IN_TRANSIT events: ID of the project the worker departed from. */
    sourceProjectId?: number | null;
    /** For IN_TRANSIT events: name of the project the worker departed from. */
    sourceProjectName?: string | null;
    /** Dispute status: null | 'PENDING' | 'RESOLVED'. */
    disputeStatus?: string | null;
    /** Reason the worker gave when disputing transit time. */
    disputeReason?: string | null;
    /** Total minutes awarded by reviewer when resolving the dispute. */
    awardedTransitMinutes?: number | null;
    /** Username of the reviewer who resolved the dispute. */
    disputeResolvedBy?: string | null;
    /** ISO 8601 timestamp when the dispute was resolved. */
    disputeResolvedAt?: string | null;
  }[];
  reviews: {
    id: number;
    reviewerId: number;
    /** Full name or username of the supervisor who reviewed this record. */
    reviewerName: string | null;
    status: string;
    comment: string | null;
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkerSummaryResponse {
  hoursThisWeek: number;
  approvedHoursThisWeek: number;
  pendingApprovals: number;
  lateArrivalsThisWeek: number;
  daysWorkedThisWeek: number;
}

// API calls

/** Fetch projects assigned to the authenticated worker (includes geofence data). */
export function getMyProjects(): Promise<WorkerProject[]> {
  return api<WorkerProject[]>('/api/v1/worker/my-projects');
}

/** Register a time event (CHECK_IN, LUNCH_START, LUNCH_END, CHECK_OUT). */
export function createTimeEvent(req: TimeEventRequest): Promise<TimeEventResponse> {
  return api<TimeEventResponse>('/api/v1/worker/time-events', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/** Get worker's own time records with optional filters. */
export function getMyRecords(params?: {
  dateFrom?: string;
  dateTo?: string;
  projectId?: number;
}): Promise<TimeRecordResponse[]> {
  const qs = new URLSearchParams();
  if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params?.dateTo)   qs.set('dateTo', params.dateTo);
  if (params?.projectId) qs.set('projectId', String(params.projectId));
  const q = qs.toString();
  return api<TimeRecordResponse[]>(`/api/v1/worker/time-records${q ? `?${q}` : ''}`);
}

/** Get KPI summary for the authenticated worker's current calendar week. */
export function getMyWorkerSummary(): Promise<WorkerSummaryResponse> {
  return api<WorkerSummaryResponse>('/api/v1/worker/my-summary');
}

// Admin / Supervisor time-records

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** List all time records (admin / supervisor) with optional server-side filters. */
export function getTimeRecords(params?: {
  status?: string;
  projectId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<TimeRecordResponse>> {
  const qs = new URLSearchParams();
  if (params?.status)    qs.set('status',    params.status);
  if (params?.projectId) qs.set('projectId', String(params.projectId));
  if (params?.dateFrom)  qs.set('dateFrom',  params.dateFrom);
  if (params?.dateTo)    qs.set('dateTo',    params.dateTo);
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.size != null) qs.set('size', String(params.size));
  const q = qs.toString();
  return api<PageResponse<TimeRecordResponse>>(`/api/v1/time-records${q ? `?${q}` : ''}`);
}

/** Get full detail of a single time record. */
export function getTimeRecord(id: number): Promise<TimeRecordResponse> {
  return api<TimeRecordResponse>(`/api/v1/time-records/${id}`);
}

/** Approve a time record. */
export function approveRecord(id: number): Promise<TimeRecordResponse> {
  return api<TimeRecordResponse>(`/api/v1/time-records/${id}/approve`, { method: 'POST' });
}

/** Mark a time record as observed (corrected) with a mandatory comment. */
export function correctRecord(id: number, comment: string): Promise<TimeRecordResponse> {
  return api<TimeRecordResponse>(`/api/v1/time-records/${id}/correct`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

/** Reject a time record with a mandatory comment. */
export function rejectRecord(id: number, comment: string): Promise<TimeRecordResponse> {
  return api<TimeRecordResponse>(`/api/v1/time-records/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

/** Approve a single time event within a record. */
export function approveEvent(recordId: number, eventId: number): Promise<TimeRecordResponse> {
  return api<TimeRecordResponse>(`/api/v1/time-records/${recordId}/events/${eventId}/approve`, {
    method: 'POST',
  });
}

/** Mark a single time event as observed (correct) with mandatory comment. */
export function correctEvent(recordId: number, eventId: number, comment: string): Promise<TimeRecordResponse> {
  return api<TimeRecordResponse>(`/api/v1/time-records/${recordId}/events/${eventId}/correct`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

/** Reject a single time event with mandatory comment. */
export function rejectEvent(recordId: number, eventId: number, comment: string): Promise<TimeRecordResponse> {
  return api<TimeRecordResponse>(`/api/v1/time-records/${recordId}/events/${eventId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

/**
 * List time records scoped to the authenticated supervisor's assigned projects.
 * Uses GET /api/v1/time-records/supervisor (server filters by auth.name).
 */
export function getSupervisorTimeRecords(params?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<TimeRecordResponse>> {
  const qs = new URLSearchParams();
  if (params?.status)    qs.set('status',   params.status);
  if (params?.dateFrom)  qs.set('dateFrom', params.dateFrom);
  if (params?.dateTo)    qs.set('dateTo',   params.dateTo);
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.size != null) qs.set('size', String(params.size));
  const q = qs.toString();
  return api<PageResponse<TimeRecordResponse>>(`/api/v1/time-records/supervisor${q ? `?${q}` : ''}`);
}

// Out-of-range alerts (supervisor)

export interface OutOfRangeAlertResponse {
  workerId: number;
  workerUsername: string;
  workerName: string | null;
  projectId: number;
  projectName: string;
  recordId: number;
  /** ISO 8601 timestamp of the first OUT_OF_RANGE event today for this worker/project. */
  firstOccurredAt: string;
  /** Total number of OUT_OF_RANGE events today for this worker/project. */
  eventCount: number;
}

/**
 * Returns today's out-of-range alerts for all active projects assigned to
 * the authenticated supervisor.
 */
export function getSupervisorOutOfRangeAlerts(): Promise<OutOfRangeAlertResponse[]> {
  return api<OutOfRangeAlertResponse[]>('/api/v1/time-records/supervisor/out-of-range-alerts');
}

// Supervisor dashboard

export interface DashboardUser {
  id: number;
  fullName: string | null;
}

export interface DashboardProject {
  id: number;
  name: string;
  status: string;
  members: number;
  contractAmountCents: number | null;
  assignedUsers: DashboardUser[];
}

export interface SupervisorDashboardResponse {
  assignedProjects: number;
  activeProjects: number;
  closedProjects: number;
  pendingApprovals: number;
  pendingApprovalsToday: number;
  projects: DashboardProject[];
}

/** Fetch supervisor dashboard KPIs and assigned projects. */
export function getSupervisorDashboard(): Promise<SupervisorDashboardResponse> {
  return api<SupervisorDashboardResponse>('/api/v1/supervisor/dashboard');
}

// Supervisor projects detail

export interface SupervisorProjectDetail {
  id: number;
  name: string;
  status: string;
  contractAmountCents: number | null;
  hoursThisWeek: number;
  approvedRecordsThisWeek: number;
  pendingRecordsThisWeek: number;
  teamTotal: number;
  teamActiveToday: number;
  lastActivityAt: string | null;
  assignedUsers: DashboardUser[];
}

/** Fetch detailed project list for the supervisor's My Projects page. */
export function getSupervisorProjects(): Promise<SupervisorProjectDetail[]> {
  return api<SupervisorProjectDetail[]>('/api/v1/supervisor/dashboard/projects');
}

// Geofence helpers (client‑side)

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance in metres between two lat/lng points. */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// Worker state

export interface WorkerStateResponse {
  state: WorkerState;
}

/**
 * Get the authenticated worker's current global state.
 * The backend returns a per-project map (projectId → WorkerState).
 * We derive the global state with priority: IN_TRANSIT > WORKING > ON_LUNCH > OFF_DUTY.
 */
export async function getWorkerState(): Promise<WorkerStateResponse> {
  const map = await api<Record<string, WorkerState>>('/api/v1/worker/my-state');
  const states = Object.values(map);
  let state: WorkerState = 'OFF_DUTY';
  if (states.includes('IN_TRANSIT')) state = 'IN_TRANSIT';
  else if (states.includes('WORKING')) state = 'WORKING';
  else if (states.includes('ON_LUNCH')) state = 'ON_LUNCH';
  return { state };
}

/** Cancel an active IN_TRANSIT event. */
export function cancelTransit(reason: string): Promise<void> {
  return api<void>('/api/v1/worker/cancel-transit', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** Dispute an active IN_TRANSIT event. Stops the transit timer and notifies supervisors. */
export function disputeTransit(reason: string): Promise<void> {
  return api<void>('/api/v1/worker/dispute-transit', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** Supervisor/Admin resolves a transit dispute by setting the total minutes to pay. */
export function resolveTransitDispute(
  recordId: number,
  eventId: number,
  awardedMinutes: number,
  comment?: string,
): Promise<TimeRecordResponse> {
  return api<TimeRecordResponse>(
    `/api/v1/time-records/${recordId}/events/${eventId}/resolve-dispute`,
    {
      method: 'POST',
      body: JSON.stringify({ awardedMinutes, comment: comment || null }),
    },
  );
}

// Admin hours report

export interface DailyEntryDetail {
  date: string;
  projectId: number;
  projectName: string;
  clockIn: string | null;
  lunchMinutes: number | null;
  clockOut: string | null;
  totalHours: number | null;
  approvalStatus: string;
  reviewerName: string | null;
  /** Transit minutes from source project (null if no transit on this record). */
  transitMinutes?: number | null;
  /** Source project name for transit (null if no transit). */
  transitFromProject?: string | null;
  /** Cost for this entry = totalHours × hourlyRate (null if no rate). */
  entryCost?: number | null;
  /** True if this record has been paid. */
  paid?: boolean;
}

export interface WorkerHoursSummary {
  workerId: number;
  workerName: string | null;
  workerUsername: string;
  workerRole: string;
  hourlyRate: number | null;
  daysWorked: number;
  totalDays: number;
  totalApprovedHours: number;
  avgHoursPerDay: number;
  lateDays: number;
  absences: number;
  dailyEntries: DailyEntryDetail[];
  /** Projected cost = approved hours × hourly rate. Not yet deducted from budget. */
  projectedCost?: number | null;
  /** Date of last confirmed payment (ISO-8601), null if never paid. */
  lastPaymentDate?: string | null;
  /** Amount in cents of last confirmed payment. */
  lastPaymentAmountCents?: number | null;
  /** Total transit hours. */
  totalTransitHours?: number;
  /** Unpaid approved hours (resets to 0 after payment confirmation). */
  unpaidApprovedHours?: number;
}

export interface HoursReportKpis {
  totalApprovedHours: number;
  avgHoursPerDay: number;
  lateArrivals: number;
  absentDays: number;
  totalLaborCost: number;
  totalPendingHours: number;
}

export interface AdminHoursReportResponse {
  kpis: HoursReportKpis;
  workers: WorkerHoursSummary[];
}

/** Edit the captured timestamp of a single time event – reason required. */
export function editEventTime(
  recordId: number,
  eventId: number,
  newTime: string,  // ISO 8601
  reason: string,
): Promise<TimeRecordResponse> {
  return api<TimeRecordResponse>(
    `/api/v1/time-records/${recordId}/events/${eventId}/edit-time`,
    {
      method: 'PATCH',
      body: JSON.stringify({ newTime, reason }),
    },
  );
}

/** Fetch admin hours report with aggregated per-worker data. */
export function getAdminHoursReport(params: {
  dateFrom: string;
  dateTo: string;
  projectId?: number;
  workerId?: number;
}): Promise<AdminHoursReportResponse> {
  const qs = new URLSearchParams();
  qs.set('dateFrom', params.dateFrom);
  qs.set('dateTo', params.dateTo);
  if (params.projectId) qs.set('projectId', String(params.projectId));
  if (params.workerId) qs.set('workerId', String(params.workerId));
  return api<AdminHoursReportResponse>(`/api/v1/admin/hours-report?${qs.toString()}`);
}

// Payroll – confirm payment & history

export interface ConfirmPaymentRequest {
  workerId: number;
  periodFrom: string;
  periodTo: string;
  notes?: string | null;
}

export interface ConfirmPaymentResponse {
  payments: LaborPaymentResponse[];
  totalAmountCents: number;
  budgetWarnings?: BudgetWarning[];
}

export interface LaborPaymentResponse {
  id: number;
  workerId: number;
  workerName: string | null;
  workerUsername: string;
  projectId: number | null;
  projectName: string | null;
  periodFrom: string;
  periodTo: string;
  approvedHours: number;
  transitHours: number;
  hourlyRate: number;
  amountCents: number;
  confirmedBy: string;
  notes: string | null;
  createdAt: string;
}

/** Confirm payment for a worker's approved hours in a period. */
export function confirmPayment(request: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse> {
  return api<ConfirmPaymentResponse>('/api/v1/admin/payroll/confirm-payment', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/** Get payment history with optional filters. */
export async function getPaymentHistory(params?: {
  workerId?: number;
  projectId?: number;
}): Promise<LaborPaymentResponse[]> {
  const qs = new URLSearchParams();
  if (params?.workerId) qs.set('workerId', String(params.workerId));
  if (params?.projectId) qs.set('projectId', String(params.projectId));
  // Backend changed this endpoint from a bare list to a Spring
  // `Page<LaborPaymentResponse>` ({ content, totalElements, totalPages, … }).
  // The history modal shows the full (filtered) list with no page controls, so
  // request a single large page and unwrap `.content` to preserve the previous
  // "show all" behaviour — otherwise Spring's default page size (20) would
  // silently truncate the history. Mirrors the size-based "fetch all" idiom
  // already used elsewhere (e.g. SupervisorApprovals, users service).
  qs.set('size', '1000');
  const page = await api<PageResponse<LaborPaymentResponse>>(
    `/api/v1/admin/payroll/history?${qs.toString()}`,
  );
  return page.content;
}
