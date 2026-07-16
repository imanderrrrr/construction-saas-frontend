// Platform-side (super-admin) DTOs. Mirrors the backend contracts in
// `backend-construction-ofjr/src/main/kotlin/com/ofjr/construction_api/platformusers/`.

export type PlatformRole = 'OWNER' | 'SUPPORT' | 'ENGINEERING' | 'BILLING';

export type LoginStatus = 'ENROLLMENT_REQUIRED' | 'MFA_REQUIRED' | 'SUCCESS';

export interface PlatformLoginResponse {
  status: LoginStatus;
  // ENROLLMENT_REQUIRED + MFA_REQUIRED both ship a 5-min challenge token.
  challengeToken?: string;
  // ENROLLMENT_REQUIRED only — render `otpAuthUri` as a QR; `secret`
  // is the manual-entry fallback for the authenticator app.
  secret?: string;
  otpAuthUri?: string;
  // SUCCESS only — the full session.
  accessToken?: string;
  refreshToken?: string;
  role?: PlatformRole;
  email?: string;
  fullName?: string;
  expiresInMinutes?: number;
}

export interface PlatformMe {
  platformUserId: number;
  email: string;
  fullName: string;
  role: PlatformRole;
}

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface FleetOverview {
  tenants: {
    total: number;
    active: number;
    suspended: number;
    deleted: number;
  };
  totalTenantUsers: number;
  signupsLast7Days: number;
  tenantsAtRisk: number;
  totalPlatformUsers: number;
}

export interface TenantSummary {
  id: number;
  slug: string;
  name: string;
  status: TenantStatus;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export type PlanCode = 'PRO' | 'BUSINESS';
export type BillingInterval = 'MONTHLY' | 'ANNUAL';

/**
 * POST /platform/tenants. No password field, by design: staff provision the
 * workspace and the customer sets their own password from an emailed link —
 * nobody on this side ever knows it.
 */
export interface CreateTenantRequest {
  companyName: string;
  tenantSlug: string;
  adminUsername: string;
  adminFullName: string;
  adminEmail: string;
  /** Backend defaults to PRO when omitted. */
  planCode?: PlanCode;
  /** Backend defaults to MONTHLY when omitted. */
  billingInterval?: BillingInterval;
}

export interface CreateTenantResponse {
  tenantId: number;
  tenantSlug: string;
  companyName: string;
  adminUserId: number;
  adminUsername: string;
  adminEmail: string;
  planCode: PlanCode;
  billingInterval: BillingInterval;
  billingStatus: string;
  billingProvider: 'MANUAL' | 'PADDLE';
  /**
   * False → the workspace exists but the admin was never told. Surface it:
   * staff must fall back to "use forgot password on the login screen".
   */
  setupLinkSent: boolean;
}

export interface TenantDetail {
  id: number;
  slug: string;
  name: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  activeUserCount: number;
  projectCount: number;
  clientCount: number;
}

export interface TenantUserSummary {
  id: number;
  username: string;
  fullName: string | null;
  role: string;
  status: string;
  email: string | null;
  createdAt: string;
}

export interface PlatformAuditEntry {
  id: number;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetTenantId: number | null;
  targetTenantSlug: string | null;
  outcome: 'SUCCESS' | 'FAILURE';
  message: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// Spring Data Page<T> envelope.
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // page index, 0-based
  size: number;
}

/** Locally-stored super-admin session. Lives in sessionStorage only. */
export interface PlatformSession {
  accessToken: string;
  /**
   * Optional today: backend emits a 7-day platform refresh token but no
   * `/platform/auth/refresh` endpoint exists yet to redeem it (audit
   * Camino A hallazgo H4). Stored if present so the future refresh flow
   * can pick it up without a session-shape migration.
   */
  refreshToken?: string;
  role: PlatformRole;
  email: string;
  fullName: string;
  expiresAt: number; // epoch ms
}
