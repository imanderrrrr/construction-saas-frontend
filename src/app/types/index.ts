// OFJR Construction Admin — Data Contracts (UI layer, Phase 1 + 2)
// Source of truth for all frontend data shapes.

// Canonical Roles
// IMPORTANT: These are the ONLY valid role values in the system (uppercase).
// Any reference to "admin/manager/user" is incorrect and must be replaced.
// Backend field: LoginResponse.role, UserEntity.role
export type CanonicalRole = 'ADMIN' | 'SUPERVISOR' | 'WORKER' | 'FINANCE' | 'WAREHOUSE' | 'SUBCONTRACTOR';

// Entity Status
export type EntityStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';

// Phase 1: Users & Projects

/** Minimal user reference for display contexts. */
export interface UserRef {
  id: number;
  username: string;
  fullName: string | null;
  role: CanonicalRole;
  status: EntityStatus;
}

/** Minimal project reference for display contexts. */
export interface ProjectRef {
  id: number;
  name: string;
  status: EntityStatus;
}

/** Full project response from /worker/my-projects (includes geofence data). */
export interface WorkerProject {
  id: number;
  name: string;
  status: EntityStatus;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
}

// Phase 2: Time Tracking

/**
 * TimeEventType — Four canonical time punch events per day, in strict order.
 * Backend field: TimeEventEntity.type
 */
export type TimeEventType = 'CHECK_IN' | 'LUNCH_START' | 'LUNCH_END' | 'CHECK_OUT' | 'IN_TRANSIT';

/** The ordered sequence of valid punch types within a workday. */
export const TIME_EVENT_SEQUENCE: TimeEventType[] = [
  'CHECK_IN', 'LUNCH_START', 'LUNCH_END', 'CHECK_OUT',
];

// Worker state (returned by GET /api/v1/worker/my-state)
export type WorkerState = 'OFF_DUTY' | 'WORKING' | 'ON_LUNCH' | 'IN_TRANSIT';

/**
 * ApprovalStatus — Review lifecycle state for a daily time record or individual event.
 * Backend fields: TimeRecordEntity.approvalStatus / TimeEventEntity.eventApprovalStatus
 *
 * PENDING   → Awaiting supervisor review (initial state after worker submits)
 * APPROVED  → Supervisor accepted the record/event as-is
 * OBSERVED  → Supervisor flagged an issue; comment required; worker may need to clarify
 * REJECTED  → Supervisor rejected the record/event; comment required
 * PARTIAL   → Frontend-derived only (never sent by backend). At least one event has been
 *             reviewed but others remain PENDING within the same record.
 */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'OBSERVED' | 'REJECTED' | 'AUTO_REJECTED' | 'PARTIAL';

/**
 * LocationStatus — Geofence/GPS check result captured at punch time.
 * Backend field: TimeEventEntity.locationStatus
 *
 * OK            → Within allowed area
 * NO_PERMISSION → Worker denied location permission
 * UNAVAILABLE   → GPS signal could not be obtained at punch time
 * OUT_OF_RANGE  → Captured but outside the allowed project radius
 * NO_GEOFENCE   → Project has no coordinates configured; geofence cannot be evaluated
 */
export type LocationStatus = 'OK' | 'NO_PERMISSION' | 'UNAVAILABLE' | 'OUT_OF_RANGE' | 'NO_GEOFENCE';

/** A single time punch event. */
export interface TimeEvent {
  id: number;
  type: TimeEventType;
  capturedAt: string;       // ISO 8601 datetime
  locationStatus: LocationStatus;
  /** Punch coordinates as captured by the device; null when GPS was unavailable. */
  lat?: number | null;
  lng?: number | null;
  /** Distance from the project center in meters; null when either side lacks coordinates. */
  distanceMeters?: number | null;
  /** Per-event approval status (independent from the record's overall status) */
  approvalStatus: ApprovalStatus;
  reviewComment?: string | null;
  reviewerUsername?: string | null;
  reviewedAt?: string | null;
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
}

/** Review metadata attached once a record has been reviewed. */
export interface Review {
  reviewerName: string;     // Username of reviewer
  reviewedAt: string;       // ISO 8601 datetime
  comment: string | null;   // Required for OBSERVED and REJECTED; null for APPROVED
}

/**
 * TimeRecord — Main entity for Phase 2 time approvals UI.
 * One worker's full event set for a single calendar day on a project.
 *
 * UI reads: GET /time-records (list) | GET /time-records/:id (detail)
 * UI writes:
 *   POST /time-records/:id/approve
 *   POST /time-records/:id/correct  { comment: string }
 *   POST /time-records/:id/reject   { comment: string }
 */
export interface TimeRecord {
  id: number;
  worker: UserRef;
  project: ProjectRef;
  date: string;             // YYYY-MM-DD
  events: TimeEvent[];
  approvalStatus: ApprovalStatus;
  /** Number of events still PENDING review. Authoritative value coming from the backend DTO. */
  pendingEventCount: number;
  review: Review | null;
}

// Budget Warnings (projected labour cost)

export interface PendingWorkerCost {
  workerId: number;
  workerName: string | null;
  unpaidHours: number;
  projectedCostCents: number;
}

export interface BudgetWarning {
  message: string;
  projectedLaborCostCents: number;
  remainingBudgetCents: number;
  effectiveRemainingCents: number;
  pendingWorkers: PendingWorkerCost[];
}

// Route Map (canonical)
// These routes are the single source of truth for navigation.
// Auth service + router MUST use these values.
export const ROLE_DASHBOARD_ROUTES: Record<CanonicalRole, string> = {
  ADMIN:      '/admin/dashboard',
  SUPERVISOR: '/supervisor/dashboard',
  WORKER:     '/worker/dashboard',
  FINANCE:    '/finance/dashboard',
  WAREHOUSE:  '/warehouse/dashboard',
  // No web workspace for SUBCONTRACTOR — they use the mobile app. The
  // /subcontractor/info page tells them so and provides a contact link.
  SUBCONTRACTOR: '/subcontractor/info',
};

// Navigation Map (per role, Phase 1 + 2)
// sectionKey must match the activeSection used in each role dashboard.
export interface NavItemSpec {
  key: string;
  label: string;
  route: string;
  phase: 1 | 2;
  comingSoon?: boolean;
}

export const ROLE_NAV_MAP: Record<CanonicalRole, NavItemSpec[]> = {
  ADMIN: [
    { key: 'dashboard',      label: 'Dashboard',       route: '/admin/dashboard',       phase: 1 },
    { key: 'users',          label: 'Users',           route: '/admin/users',           phase: 1 },
    { key: 'projects',       label: 'Projects',        route: '/admin/projects',        phase: 1 },
    { key: 'audit',          label: 'Audit logs',      route: '/admin/audit',           phase: 1 },
    { key: 'time-approvals', label: 'Time approvals',  route: '/admin/time-approvals',  phase: 2 },
  ],
  SUPERVISOR: [
    { key: 'approvals',  label: 'Time approvals', route: '/supervisor/time-approvals', phase: 2 },
    { key: 'projects',   label: 'Projects',       route: '/supervisor/projects',       phase: 1, comingSoon: true },
    { key: 'dashboard',  label: 'Dashboard',      route: '/supervisor/dashboard',      phase: 1, comingSoon: true },
  ],
  WORKER: [
    { key: 'time',      label: 'Time tracking',  route: '/worker/time',      phase: 2 },
    { key: 'dashboard', label: 'Dashboard',      route: '/worker/dashboard', phase: 1, comingSoon: true },
  ],
  FINANCE: [
    { key: 'dashboard', label: 'Dashboard',  route: '/finance/dashboard', phase: 1, comingSoon: true },
    { key: 'expenses',  label: 'Expenses',   route: '/finance/expenses',  phase: 2 },
    { key: 'budgets',   label: 'Budgets',    route: '/finance/budgets',   phase: 2 },
  ],
  WAREHOUSE: [
    { key: 'dashboard',  label: 'Dashboard',  route: '/warehouse/dashboard',  phase: 1, comingSoon: true },
    { key: 'inventory',  label: 'Inventory',  route: '/warehouse/inventory',  phase: 2 },
  ],
  // No web workspace for SUBCONTRACTOR — they use the mobile app (see ROLE_DASHBOARD_ROUTES).
  SUBCONTRACTOR: [],
};