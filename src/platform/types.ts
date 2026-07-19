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
export type BillingProvider = 'MANUAL' | 'PADDLE';

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
  /**
   * How this customer pays (V86). PADDLE creates the tenant PENDING payment
   * and mints a card-checkout link at the negotiated price; MANUAL grants an
   * ACTIVE out-of-band account. The backend defaults to MANUAL when omitted
   * (wire-compat with the pre-V86 console) — this form always sends it.
   */
  billingProvider?: BillingProvider;
  /**
   * Negotiated USD cents — required (and only allowed) when billingProvider
   * is PADDLE; sending it with MANUAL is a 400. Backend bounds: $10.00 to
   * $50,000.00 per period.
   */
  customPriceUsdCents?: number;
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
  billingProvider: BillingProvider;
  /**
   * False → the workspace exists but the admin was never told. Surface it:
   * staff must fall back to "use forgot password on the login screen".
   */
  setupLinkSent: boolean;
  /** Negotiated USD cents (PADDLE accounts); null for MANUAL. */
  customPriceUsdCents: number | null;
  /** Hosted Paddle checkout URL for the first payment; null for MANUAL or when minting failed. */
  checkoutUrl: string | null;
  paddleTransactionId: string | null;
  /** True when the checkout link was emailed to the admin (PADDLE only; null for MANUAL). */
  checkoutLinkEmailSent: boolean | null;
  /**
   * Error code when the tenant was created but the Paddle checkout could not
   * be minted (e.g. BILLING_CHECKOUT_FAILED, BILLING_PRODUCT_NOT_CONFIGURED).
   * The tenant is PENDING with no live link — staff retry from its detail page
   * via POST /platform/tenants/{id}/billing/checkout-link.
   */
  checkoutError: string | null;
}

/** Why a tenant is SUSPENDED (V86): auto (never paid) vs a staff decision. */
export type SuspensionReason = 'PENDING_PAYMENT' | 'PLATFORM_MANUAL';

export interface TenantDetail {
  id: number;
  slug: string;
  name: string;
  status: TenantStatus;
  /** Set only while status is SUSPENDED; null otherwise. */
  suspensionReason: SuspensionReason | null;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  activeUserCount: number;
  projectCount: number;
  clientCount: number;
  /** Billing snapshot (V86); all null for a tenant with no billing account. */
  billingProvider: BillingProvider | null;
  billingStatus: string | null;
  /** Negotiated USD cents for console-created PADDLE accounts; null for MANUAL/legacy. */
  negotiatedPriceCents: number | null;
  /**
   * Hosted checkout URL of the latest still-live attempt, for staff to
   * re-copy while the tenant is pending. Null once the attempt completes,
   * fails, or is superseded.
   */
  pendingCheckoutUrl: string | null;
}

/**
 * POST /platform/tenants/{id}/billing/checkout-link — a freshly minted
 * Paddle checkout at the account's negotiated price, superseding any
 * previous link and re-arming the 7-day pending-suspension window.
 * OWNER / SUPPORT only.
 */
export interface PlatformCheckoutLinkResponse {
  tenantId: number;
  checkoutAttemptId: string;
  paddleTransactionId: string;
  checkoutUrl: string;
  /** USD cents this link charges — the account's negotiated price. */
  amountCents: number;
  planCode: PlanCode;
  billingInterval: BillingInterval;
  billingStatus: string;
  /** True when the link was also emailed to the tenant's admin. */
  emailSent: boolean;
}

// ── Manual payments (V85) ───────────────────────────────────────

/** One recorded out-of-band payment. `amountCents` is USD cents. */
export interface PlatformPaymentEntry {
  id: number;
  amountCents: number;
  paidAt: string;
  method: string;
  reference: string | null;
  coversUntil: string;
  recordedByPlatformUserId: number;
  recordedByEmail: string;
  createdAt: string;
}

/**
 * GET/POST /platform/tenants/{id}/payments — the tenant's billing summary
 * (status + "valid until") plus its manual payment history. Billing fields are
 * null for a tenant with no billing account. `billingProvider === 'PADDLE'`
 * means the period is Paddle-managed and manual recording is refused.
 */
export interface TenantPayments {
  tenantId: number;
  billingProvider: BillingProvider | null;
  billingStatus: string | null;
  planCode: PlanCode | null;
  billingInterval: BillingInterval | null;
  currentPeriodEndsAt: string | null;
  payments: PlatformPaymentEntry[];
}

/** POST body. `amountCents` is USD cents; `paidAt`/`coversUntil` are ISO instants. */
export interface RecordPaymentRequest {
  amountCents: number;
  paidAt: string;
  method: string;
  reference?: string;
  coversUntil: string;
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
