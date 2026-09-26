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
