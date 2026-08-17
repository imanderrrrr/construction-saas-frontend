// BuildTrack — Time & material tickets ("tiempo y material").
//
// The paper sheet the encargado hands the client's superintendent after doing
// unforeseen work, made countable. Two surfaces, two audiences, two role gates,
// and they are deliberately separate endpoints rather than one list with a
// query flag:
//
//  - FIELD  `/api/v1/supervisor/tm-tickets` — SUPERVISOR + ADMIN. Capture,
//    edit, ask for the signature, withdraw it.
//  - OFFICE `/api/v1/admin/tm-tickets` — ADMIN + FINANCE. Look at what is
//    waiting, and convert what is signed into a change order.
//
// ⚠️ Vocabulary, because it crosses here: the **encargado** is our employee who
// captures the work and holds the `SUPERVISOR` role. The **supervisor** who
// signs works for the client, has no account, and never authenticates — they
// sign through the public link token, exactly like the emailed signer does.
//
// There is no delete. A T&M is never removed: it is revoked while it waits, or
// declined by the signer, or converted. Anything that already moved money has
// to stay readable.

import { api } from '../lib/api';
import type { CreateSignatureRequestBody } from './signatures';

// ──────────────────────────── Types ────────────────────────────

/**
 * Where a ticket is.
 *
 * ```
 * DRAFT ──ask──> PENDING_SIGNATURE ──sign──> SIGNED ──office──> CONVERTED
 *   ^                  │                                        (terminal)
 *   └─────revoke───────┤
 *   ^                  └──refuse──> DECLINED ──edit──> DRAFT
 *   └──────────────────────────────────────────┘
 * ```
 *
 * `DECLINED` ("the super would not sign it") and `PENDING_SIGNATURE` ("he has
 * not signed it yet") are both unauthorised work, and the screens must not blur
 * them: only one of the two is still waiting for something.
 */
export type TmTicketStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'SIGNED'
  | 'DECLINED'
  | 'CONVERTED';

/** Every status, in the order the flow walks them. Drives filters and legends. */
export const TM_TICKET_STATUSES: readonly TmTicketStatus[] = [
  'DRAFT',
  'PENDING_SIGNATURE',
  'SIGNED',
  'DECLINED',
  'CONVERTED',
] as const;

/**
 * Bounds the capture form has to respect, mirrored from the backend DTO.
 *
 * These live here and not in `shared/fieldLimits.ts` because their backend
 * counterparts are literals on `CreateTmTicketRequest`, not entries in
 * `FieldLimits.kt` — that file mirrors `fieldLimits.ts` one-for-one, and adding
 * a value it does not contain would break the mirror it is there to keep.
 *
 * The money ceiling for `hourlyRate` and `material` is the exception: it *does*
 * live in `FieldLimits.kt`, so it comes from `FIELD_LIMITS.MONEY_AMOUNT`.
 *
 * None of these is a budget check. They bound what is arithmetically sane, and
 * nothing here consults what the project can afford.
 */
export const TM_LIMITS = {
  WORKER_COUNT_MIN: 1,
  WORKER_COUNT_MAX: 999,
  /** `@DecimalMax("99999.99")` + `@Digits(integer = 5, fraction = 2)`. */
  HOURS_MAX: '99999.99',
  HOURS_DECIMALS: 2,
} as const;

/**
 * A ticket as the panels see it.
 *
 * Money (`hours`, `hourlyRate`, `material`, `labor`, `total`) is `BigDecimal`
 * scale 2 on the server and arrives as a JSON number. **Print these; never do
 * arithmetic with them** — `helpers/tmMoney.ts` exists for the arithmetic and
 * works in integer cents.
 *
 * `convertible` and `editable` are decided by the server. The screens ask these
 * rather than re-deriving the rule from `status`, so a rule that changes on the
 * backend does not leave a button lit that the API will refuse.
 */
export interface TmTicket {
  id: number;
  /** `TM-000123`, derived from the id. */
  ticketNumber: string;
  projectId: number;
  projectName: string;
  description: string;
  notes: string | null;
  /** The day the work happened — NOT the day it was typed in. `YYYY-MM-DD`. */
  workDate: string;

  workerCount: number;
  hours: number;
  hourlyRate: number;
  material: number;
  /** `workerCount × hours × hourlyRate`, already rounded by the server. */
  labor: number;
  total: number;

  status: TmTicketStatus;
  /** The office may convert it right now. */
  convertible: boolean;
  /** The encargado may still change it. */
  editable: boolean;

  signatureRequestId: number | null;
  signatureRequestedAt: string | null;
  signedAt: string | null;
  signerName: string | null;
  signerTitle: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  /** SHA-256 of the document frozen when the signature was asked for. */
  documentHash: string | null;
  /** Link to sign — present only while the request is open. */
  signUrl: string | null;

  changeOrderId: number | null;
  convertedAt: string | null;
  convertedBy: string | null;

  createdBy: string;
  createdAt: string;
  /** Days since capture. The age the office watches. */
  ageDays: number;
}

/**
 * Work done and still unauthorised.
 *
 * `totalPending` is the number that exists nowhere else today: how much money
 * of already-executed work is waiting on a signature or on the office.
 */
export interface TmPendingSummary {
  ticketCount: number;
  totalPending: number;
  /** Age of the oldest, in days. 0 when there are none. */
  oldestAgeDays: number;
  tickets: TmTicket[];
}

export interface CreateTmTicketPayload {
  projectId: number;
  description: string;
  notes?: string | null;
  workDate: string;
  workerCount: number;
  /** Decimal strings, not numbers: the server parses them as `BigDecimal`. */
  hours: string;
  hourlyRate: string;
  material?: string;
}

/** Partial edit — an omitted field keeps its stored value. */
export type UpdateTmTicketPayload = Partial<Omit<CreateTmTicketPayload, 'projectId'>>;

export interface ConvertTmTicketPayload {
  /** The office's own change-order number, when it keeps one. */
  changeOrderNumber?: string;
}

export interface TmTicketFilters {
  projectId?: number;
  status?: TmTicketStatus;
}

// ──────────────────────────── Paths ────────────────────────────

const FIELD_BASE = '/api/v1/supervisor/tm-tickets';
const OFFICE_BASE = '/api/v1/admin/tm-tickets';

function query(filters: TmTicketFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.projectId != null) params.set('projectId', String(filters.projectId));
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ─────────────────── Field surface (SUPERVISOR + ADMIN) ───────────────────

/** Capture the work. Born DRAFT: editable, no signature asked for yet. */
export function createTmTicket(payload: CreateTmTicketPayload): Promise<TmTicket> {
  return api<TmTicket>(FIELD_BASE, { method: 'POST', body: JSON.stringify(payload) });
}

export function listFieldTmTickets(filters: TmTicketFilters = {}): Promise<TmTicket[]> {
  return api<TmTicket[]>(`${FIELD_BASE}${query(filters)}`);
}

export function getFieldTmPending(projectId?: number): Promise<TmPendingSummary> {
  return api<TmPendingSummary>(`${FIELD_BASE}/pending${query({ projectId })}`);
}

export function getFieldTmTicket(id: number): Promise<TmTicket> {
  return api<TmTicket>(`${FIELD_BASE}/${id}`);
}

/** Fix a typo. Only while the ticket is DRAFT or DECLINED. */
export function updateTmTicket(id: number, payload: UpdateTmTicketPayload): Promise<TmTicket> {
  return api<TmTicket>(`${FIELD_BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

/**
 * Ask for the signature: freezes the document, hashes it, and mints the link.
 *
 * The module has mail transport available and deliberately does not use it —
 * the signer is standing next to the person capturing the work, so the server
 * always answers `emailSent: false` and hands back a `signUrl` instead. Passing
 * a `recipientEmail` records who the link was meant for in the audit trail; it
 * does **not** send anything.
 */
export function requestTmSignature(
  id: number,
  body: CreateSignatureRequestBody = {},
): Promise<TmTicket> {
  return api<TmTicket>(`${FIELD_BASE}/${id}/signature-request`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Withdraw the request. Back to DRAFT, and the link stops working. */
export function revokeTmSignature(id: number): Promise<TmTicket> {
  return api<TmTicket>(`${FIELD_BASE}/${id}/signature-request`, { method: 'DELETE' });
}

// ─────────────────── Office surface (ADMIN + FINANCE) ───────────────────

export function listOfficeTmTickets(filters: TmTicketFilters = {}): Promise<TmTicket[]> {
  return api<TmTicket[]>(`${OFFICE_BASE}${query(filters)}`);
}

export function getOfficeTmPending(projectId?: number): Promise<TmPendingSummary> {
  return api<TmPendingSummary>(`${OFFICE_BASE}/pending${query({ projectId })}`);
}

export function getOfficeTmTicket(id: number): Promise<TmTicket> {
  return api<TmTicket>(`${OFFICE_BASE}/${id}`);
}

/**
 * Turn a signed ticket into a change order.
 *
 * **This is the moment money moves** — it raises the contract and writes the
 * contract-history entry. The signature does not do this on its own by design:
 * it leaves the ticket ready and someone in the office decides. Terminal; a
 * second call is refused with 409.
 */
export function convertTmTicket(
  id: number,
  payload: ConvertTmTicketPayload = {},
): Promise<TmTicket> {
  return api<TmTicket>(`${OFFICE_BASE}/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ──────────────────────────── Helpers ────────────────────────────

/**
 * The bare link token out of a `signUrl`.
 *
 * The server builds `<publicBaseUrl>/sign/<token>`, and `publicBaseUrl` is its
 * own configured address, which need not be the origin this browser is on. So
 * the on-site handoff opens the signing session from the **token** rather than
 * navigating to the URL — same session the emailed signer would get, without
 * betting that the configured host resolves from a phone on site wifi.
 *
 * Matches the backend's own `substringAfterLast("/sign/")`.
 */
export function signTokenFromUrl(signUrl: string | null | undefined): string | null {
  if (!signUrl) return null;
  const marker = '/sign/';
  const at = signUrl.lastIndexOf(marker);
  if (at === -1) return null;
  const token = signUrl.slice(at + marker.length).trim();
  return token || null;
}
