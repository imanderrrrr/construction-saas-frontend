// BuildTrack — QuickBooks Online: each constructora's link to its own company.
//
// The panel never talks to Intuit: it asks the backend for the consent URL and
// sends the browser there; Intuit sends it back to the backend's callback,
// which redirects to /admin/dashboard?quickbooks=<OUTCOME>. Tokens never reach
// the browser, and the tenant is whatever the session says — there is no
// tenant parameter anywhere in this API.

import { api } from '../lib/api';

export type QuickBooksState = 'NOT_CONNECTED' | 'ACTIVE' | 'NEEDS_RECONNECT';

export interface QuickBooksStatus {
  /** False until the server has the Intuit app keys — the panel then explains instead of offering a button. */
  configured: boolean;
  environment: 'SANDBOX' | 'PRODUCTION';
  state: QuickBooksState;
  companyName: string | null;
  realmId: string | null;
  connectedAt: string | null;
  connectedBy: string | null;
  lastRefreshedAt: string | null;
  refreshTokenExpiresAt: string | null;
  /** Intuit's 5-year ceiling: after it, only a new consent works. */
  refreshTokenHardExpiresAt: string | null;
  /** REFRESH_REJECTED | COMPANY_INFO_FAILED | ENVIRONMENT_CHANGED | null */
  lastError: string | null;
}

/** How a trip through Intuit's consent screen ended (QuickBooksConnectOutcome on the server). */
export const QUICKBOOKS_OUTCOMES = [
  'CONNECTED',
  'RECONNECTED',
  'CANCELLED',
  'AUTHORIZATION_FAILED',
  'STATE_INVALID',
  'MISSING_PARAMS',
  'NOT_CONFIGURED',
  'REALM_MISMATCH',
  'REALM_IN_USE',
  'EXCHANGE_FAILED',
  'SAVE_FAILED',
] as const;
export type QuickBooksOutcome = (typeof QUICKBOOKS_OUTCOMES)[number];

export const QUICKBOOKS_SUCCESS_OUTCOMES: ReadonlySet<QuickBooksOutcome> = new Set(['CONNECTED', 'RECONNECTED']);

/** Reads `?quickbooks=<OUTCOME>` from a location search string; anything unknown is ignored. */
export function parseQuickBooksOutcome(search: string): QuickBooksOutcome | null {
  const value = new URLSearchParams(search).get('quickbooks');
  return value && (QUICKBOOKS_OUTCOMES as readonly string[]).includes(value) ? (value as QuickBooksOutcome) : null;
}

const BASE = '/api/v1/admin/integrations/quickbooks';

export function getQuickBooksStatus(): Promise<QuickBooksStatus> {
  return api<QuickBooksStatus>(BASE);
}

export function startQuickBooksConnect(): Promise<{ authorizationUrl: string }> {
  return api<{ authorizationUrl: string }>(`${BASE}/connect`, { method: 'POST' });
}

export function testQuickBooksConnection(): Promise<QuickBooksStatus> {
  return api<QuickBooksStatus>(`${BASE}/test`, { method: 'POST' });
}

export function disconnectQuickBooks(): Promise<QuickBooksStatus> {
  return api<QuickBooksStatus>(`${BASE}/disconnect`, { method: 'POST' });
}

/** Leaves the panel for Intuit's consent screen (a full navigation, not a popup). */
export function openIntuitConsent(authorizationUrl: string): void {
  window.location.assign(authorizationUrl);
}

// ── Phase 2: the company profile and the links ───────────────────────────────
//
// Only refreshing the company and creating a record reach QuickBooks. Reads are
// metered by Intuit per developer workspace — one meter for every constructora
// on BuildTrack — so the refresh is throttled per company (429
// QUICKBOOKS_REFRESH_COOLDOWN with a Retry-After) and everything else reads the
// server's local copy.

export type QuickBooksLinkType = 'CLIENT' | 'PROJECT' | 'VENDOR' | 'PAYABLE_CATEGORY' | 'INVOICE_ITEM';

/** The types whose missing QuickBooks record can be created from the panel. */
export const QUICKBOOKS_CREATABLE: ReadonlySet<QuickBooksLinkType> = new Set(['CLIENT', 'PROJECT', 'VENDOR']);

/** The backend code of a refresh refused by the per-company brake. */
export const QUICKBOOKS_REFRESH_COOLDOWN_CODE = 'QUICKBOOKS_REFRESH_COOLDOWN';

export interface QuickBooksCompany {
  connected: boolean;
  realmId: string | null;
  companyName: string | null;
  /** SOLOPRENEUR | SIMPLE_START | ESSENTIALS | PLUS | ADVANCED | ENTERPRISE | OTHER, null until read. */
  plan: string | null;
  offeringSku: string | null;
  country: string | null;
  homeCurrency: string | null;
  projectsEnabled: boolean | null;
  classTracking: boolean | null;
  locationTracking: boolean | null;
  /** Whether an obra can be put on each line of a bill (Plus and Advanced only). */
  expensesByCustomer: boolean | null;
  /** How obras live in QuickBooks: PROJECTS or SUB_CUSTOMERS. */
  jobTracking: 'PROJECTS' | 'SUB_CUSTOMERS' | null;
  profileReadAt: string | null;
  directoryRefreshedAt: string | null;
  directoryCounts: Record<string, number>;
}

export interface QuickBooksOption {
  qboId: string;
  name: string;
  fullName: string | null;
  kind: string;
  isProject: boolean;
  isSubCustomer: boolean;
  accountType: string | null;
  active: boolean;
}

export interface QuickBooksLinkView {
  qboId: string;
  qboName: string | null;
  createdInQbo: boolean;
  linkedBy: string;
  stillActive: boolean;
}

export interface QuickBooksMappingRow {
  type: QuickBooksLinkType;
  localKey: string;
  localLabel: string;
  detail: string | null;
  link: QuickBooksLinkView | null;
  suggestion: QuickBooksOption | null;
  billCount: number | null;
  billTotalCents: number | null;
}

export interface QuickBooksMappingOverview {
  company: QuickBooksCompany;
  clients: QuickBooksMappingRow[];
  projects: QuickBooksMappingRow[];
  vendors: QuickBooksMappingRow[];
  categories: QuickBooksMappingRow[];
  invoiceItem: QuickBooksMappingRow[];
}

export function getQuickBooksCompany(): Promise<QuickBooksCompany> {
  return api<QuickBooksCompany>(`${BASE}/company`);
}

export function refreshQuickBooksCompany(): Promise<QuickBooksCompany> {
  return api<QuickBooksCompany>(`${BASE}/company/refresh`, { method: 'POST' });
}

export function getQuickBooksMappings(): Promise<QuickBooksMappingOverview> {
  return api<QuickBooksMappingOverview>(`${BASE}/mappings`);
}

export function searchQuickBooksOptions(type: QuickBooksLinkType, q: string): Promise<QuickBooksOption[]> {
  const params = new URLSearchParams({ type, q, limit: '30' });
  return api<QuickBooksOption[]>(`${BASE}/mappings/options?${params.toString()}`);
}

export function linkQuickBooks(type: QuickBooksLinkType, localKey: string, qboId: string): Promise<QuickBooksMappingOverview> {
  return api<QuickBooksMappingOverview>(`${BASE}/mappings/link`, {
    method: 'POST',
    body: JSON.stringify({ type, localKey, qboId }),
  });
}

export function unlinkQuickBooks(type: QuickBooksLinkType, localKey: string): Promise<QuickBooksMappingOverview> {
  return api<QuickBooksMappingOverview>(`${BASE}/mappings/unlink`, {
    method: 'POST',
    body: JSON.stringify({ type, localKey }),
  });
}

export function createInQuickBooks(type: QuickBooksLinkType, localKey: string): Promise<QuickBooksMappingOverview> {
  return api<QuickBooksMappingOverview>(`${BASE}/mappings/create`, {
    method: 'POST',
    body: JSON.stringify({ type, localKey }),
  });
}

export function acceptQuickBooksSuggestions(type?: QuickBooksLinkType): Promise<{ linked: number; overview: QuickBooksMappingOverview }> {
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  return api<{ linked: number; overview: QuickBooksMappingOverview }>(`${BASE}/mappings/accept-suggestions${query}`, { method: 'POST' });
}

// ── Phase 3: sending invoices and bills ──────────────────────────────────────
//
// The list is computed by the server from the tenant's own data (never live
// from QuickBooks). The send buttons reach Intuit: creates and updates are
// free, a void or delete costs one metered read (the server looks for
// payments first) — counted on the company's share of the shared meter.

export type QuickBooksSyncType = 'INVOICE' | 'BILL';

export type QuickBooksSyncState =
  | 'READY' | 'BLOCKED' | 'FAILED' | 'SENT' | 'CHANGED' | 'SKIPPED' | 'SENDING' | 'VOIDED' | 'DELETED';

/** Every code the server may put in `reasons` — each one has a sentence in the `quickbooks` namespace (sync.reason.*). */
export const QUICKBOOKS_SYNC_REASONS = [
  'PROJECT_NOT_LINKED', 'INVOICE_ITEM_NOT_LINKED', 'VENDOR_NOT_LINKED', 'CATEGORY_NOT_LINKED',
  'HAS_SALES_TAX', 'DISCOUNT_DISABLED', 'TOTAL_BELOW_PAID', 'PLAN_NO_BILLS', 'DUPLICATE_DOC_NUMBER', 'QBO_HAS_PAYMENTS',
  'QBO_DELETED', 'FEATURE_NOT_SUPPORTED', 'QUICKBOOKS_UNAVAILABLE', 'RATE_LIMITED', 'QUICKBOOKS_AUTH_REJECTED',
  'QBO_TEMPORARY_ERROR', 'STALE_OBJECT', 'QBO_REJECTED', 'TOTAL_MISMATCH',
] as const;

/**
 * Blocks worked out from our own data (links, sales tax, discounts): they
 * clear by themselves once fixed. Any other reason is QuickBooks' answer and
 * takes a "Reintentar".
 */
export const QUICKBOOKS_SYNC_COMPUTED_REASONS: ReadonlySet<string> = new Set([
  'PROJECT_NOT_LINKED', 'INVOICE_ITEM_NOT_LINKED', 'VENDOR_NOT_LINKED', 'CATEGORY_NOT_LINKED', 'HAS_SALES_TAX', 'DISCOUNT_DISABLED',
  'TOTAL_BELOW_PAID',
]);

/** The "Vincular" tabs a missing link sends the admin to (QuickBooksMapping's own tab keys). */
export type QuickBooksMappingTab = 'clients' | 'projects' | 'vendors' | 'categories' | 'invoiceItem';

export interface QuickBooksSyncRow {
  type: QuickBooksSyncType;
  docId: number;
  /** INVOICE | CHANGE_ORDER_REQUEST for invoices; BILL | INVOICE for payables. */
  documentType: string;
  number: string;
  vendorInvoiceNumber: string | null;
  /** Client or vendor, as typed in the system. */
  party: string | null;
  projectName: string | null;
  date: string | null;
  amountCents: number | null;
  state: QuickBooksSyncState;
  reasons: string[];
  linkTabs: QuickBooksMappingTab[];
  /** QuickBooks' own words about the last failure. */
  errorMessage: string | null;
  /** ATTACHMENT_FAILED */
  warning: string | null;
  deletedHere: boolean;
  qboId: string | null;
  qboDocNumber: string | null;
  qboUrl: string | null;
  sentAt: string | null;
  sentBy: string | null;
  syncedAt: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  skippedBy: string | null;
  attachmentsTotal: number | null;
  attachmentsSent: number | null;
  /**
   * Phase 4, with payments read from QuickBooks: payments recorded in
   * BuildTrack on this sent document. They no longer count until someone
   * records them in QuickBooks.
   */
  localPaymentsCount?: number;
  localPaymentsCents?: number;
}

export interface QuickBooksSyncSettings {
  connected: boolean;
  environment: 'SANDBOX' | 'PRODUCTION';
  realmId: string | null;
  companyName: string | null;
  /** yyyy-MM-dd */
  cutoverDate: string | null;
  autoSend: boolean;
  autoSendChangedBy: string | null;
  autoSendChangedAt: string | null;
  autoSendIntervalMinutes: number;
  lastRunAt: string | null;
  lastRunSummary: string | null;
  plan: string | null;
  expensesByCustomer: boolean | null;
  customTxnNumbers: boolean | null;
  allowDiscount: boolean | null;
  usingSalesTax: boolean | null;
  preferencesRead: boolean;
  /** Phase 4: payments of the tenant's sent documents come from its QuickBooks. */
  paymentsFromQbo?: boolean;
}

export interface QuickBooksSyncSummary {
  ready: number;
  blocked: number;
  failed: number;
  sent: number;
  changed: number;
  skipped: number;
  closed: number;
  /** Phase 4: sent documents that still carry payments recorded in BuildTrack. */
  localPayments?: number;
}

export interface QuickBooksSyncOverview {
  settings: QuickBooksSyncSettings;
  summary: QuickBooksSyncSummary;
  rows: QuickBooksSyncRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface QuickBooksSyncRunResult {
  processed: number;
  created: number;
  updated: number;
  voided: number;
  deleted: number;
  failed: number;
  blocked: number;
  attachmentsSent: number;
  attachmentsFailed: number;
  remaining: number;
  stoppedBy: string | null;
}

/** 'ALL', a state, or 'CLOSED' (voided or deleted). */
export type QuickBooksSyncStateFilter = 'ALL' | QuickBooksSyncState | 'CLOSED';

export function getQuickBooksSync(
  filter: { type?: QuickBooksSyncType | 'ALL'; state?: QuickBooksSyncStateFilter; page?: number; size?: number } = {},
): Promise<QuickBooksSyncOverview> {
  const params = new URLSearchParams();
  if (filter.type && filter.type !== 'ALL') params.set('type', filter.type);
  if (filter.state && filter.state !== 'ALL') params.set('state', filter.state);
  params.set('page', String(filter.page ?? 0));
  params.set('size', String(filter.size ?? 25));
  return api<QuickBooksSyncOverview>(`${BASE}/sync?${params.toString()}`);
}

export function updateQuickBooksSyncSettings(cutoverDate: string | null, autoSend: boolean): Promise<QuickBooksSyncSettings> {
  return api<QuickBooksSyncSettings>(`${BASE}/sync/settings`, {
    method: 'PUT',
    body: JSON.stringify({ cutoverDate, autoSend }),
  });
}

export function sendQuickBooksDocument(type: QuickBooksSyncType, id: number): Promise<QuickBooksSyncRow> {
  return api<QuickBooksSyncRow>(`${BASE}/sync/${type}/${id}/send`, { method: 'POST' });
}

export function sendReadyToQuickBooks(): Promise<QuickBooksSyncRunResult> {
  return api<QuickBooksSyncRunResult>(`${BASE}/sync/send-ready`, { method: 'POST' });
}

export function skipQuickBooksDocument(type: QuickBooksSyncType, id: number): Promise<QuickBooksSyncRow> {
  return api<QuickBooksSyncRow>(`${BASE}/sync/${type}/${id}/skip`, { method: 'POST' });
}

export function unskipQuickBooksDocument(type: QuickBooksSyncType, id: number): Promise<QuickBooksSyncRow> {
  return api<QuickBooksSyncRow>(`${BASE}/sync/${type}/${id}/unskip`, { method: 'POST' });
}

// ── Phase 4: payments read from QuickBooks ─────────────────────────────────
//
// Once the tenant's switch is on, the payments of every document it sent to
// QuickBooks are recorded THERE (it is tied to the bank) and read back here:
// what each document and each jobsite shows as paid comes from QuickBooks. The
// status call never reaches QuickBooks; "Actualizar pagos" spends one read.

export interface QuickBooksWebhookStatus {
  /** Whether BuildTrack's server has Intuit's verifier token (set once, for every company). */
  configured: boolean;
  /** The address registered in the Intuit portal, when the server can work it out. */
  url: string | null;
  /** Last signed notice for THIS tenant's company. */
  lastEventAt: string | null;
  /** This tenant's notices received and not yet followed by a read. */
  pendingEvents: number;
}

export interface QuickBooksPaymentRead {
  type: QuickBooksSyncType;
  docId: number;
  number: string;
  /** Client or vendor. */
  party: string | null;
  amountCents: number;
  /** yyyy-MM-dd */
  date: string;
  method: string;
  reference: string | null;
  qboPaymentId: string;
  /** Deleted, voided or unapplied in QuickBooks: kept as history. */
  voided: boolean;
  readAt: string;
}

export interface QuickBooksPaymentsStatus {
  connected: boolean;
  enabled: boolean;
  changedBy: string | null;
  changedAt: string | null;
  intervalMinutes: number;
  readAt: string | null;
  /** Where the next read starts; null = the next read is a full one. */
  cursor: string | null;
  /** QUICKBOOKS_UNAVAILABLE | RATE_LIMITED | QUICKBOOKS_NEEDS_RECONNECT | PAYMENTS_APPLY_FAILED… */
  lastError: string | null;
  /** A read of this tenant is running right now. */
  running: boolean;
  webhook: QuickBooksWebhookStatus;
  localPaymentsDocuments: number;
  localPaymentsCents: number;
  recent: QuickBooksPaymentRead[];
}

export interface QuickBooksPaymentsRunResult {
  /** CDC (changes since the last read, one call) | FULL (every sent document) */
  mode: 'CDC' | 'FULL';
  /** Metered calls spent. */
  reads: number;
  paymentsRead: number;
  documentsChecked: number;
  documentsUpdated: number;
  failed: number;
  stoppedBy: string | null;
}

export function getQuickBooksPayments(): Promise<QuickBooksPaymentsStatus> {
  return api<QuickBooksPaymentsStatus>(`${BASE}/payments`);
}

export function updateQuickBooksPaymentsSettings(enabled: boolean): Promise<QuickBooksPaymentsStatus> {
  return api<QuickBooksPaymentsStatus>(`${BASE}/payments/settings`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export function refreshQuickBooksPayments(full = false): Promise<{ result: QuickBooksPaymentsRunResult; status: QuickBooksPaymentsStatus }> {
  return api<{ result: QuickBooksPaymentsRunResult; status: QuickBooksPaymentsStatus }>(
    `${BASE}/payments/refresh${full ? '?full=true' : ''}`,
    { method: 'POST' },
  );
}
