// BuildTrack — Document signatures API service.
//
// Two surfaces in one file, on purpose — they are two halves of one flow:
//  - The PANEL side (session-authenticated): ask for a signature on a
//    receivable, read its state, revoke it.
//  - The PUBLIC side, consumed by /sign/:token: no user session at all. The
//    link token is exchanged for a short-lived session token that travels in
//    the Authorization header, exactly like the client portal.

import { api, getBaseUrl } from '../lib/api';

// ──────────────────────────── Types ────────────────────────────

export type SignatureStatus = 'PENDING' | 'SIGNED' | 'DECLINED' | 'REVOKED';

/** What the panel sees about a document's signature. */
export interface SignatureRequestState {
  id: number;
  status: SignatureStatus;
  version: number;
  signToken: string | null;
  signUrl: string | null;
  expiresAt: string;
  documentHash: string;
  recipientEmail: string | null;
  recipientName: string | null;
  requestedBy: string;
  requestedAt: string;
  emailSent: boolean;
  signerName: string | null;
  signerTitle: string | null;
  signedAt: string | null;
  signerIp: string | null;
  hasSignatureImage: boolean;
  declinedAt: string | null;
  declineReason: string | null;
  revokedAt: string | null;
  /**
   * The live invoice no longer matches the version that was frozen and sent.
   * Informational only — the link still works and the signature is still
   * valid evidence of what was shown. The panel warns so the divergence is
   * not invisible on our side too.
   */
  documentChanged: boolean;
}

export interface CreateSignatureRequestBody {
  recipientEmail?: string;
  recipientName?: string;
  expiresInDays?: number;
}

export interface SignatureLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}

/** The frozen document as the signer sees it. */
export interface SignatureDocument {
  documentKind: string;
  documentNumber: string;
  companyName: string;
  clientName: string;
  projectName: string;
  description: string | null;
  issuedDate: string;
  dueDate: string;
  lineItems: SignatureLineItem[];
  subtotalCents: number;
  discountCents: number;
  taxRate: string;
  taxCents: number;
  totalCents: number;
  currency: string;
  notes: string | null;
  documentHash: string;
  expiresAt: string;
}

export interface SignatureSession {
  sessionToken: string;
  expiresInMinutes: number;
  document: SignatureDocument;
}

export interface SignatureOutcome {
  status: SignatureStatus;
  signedAt: string | null;
  signerName: string | null;
  signerTitle: string | null;
  documentHash: string;
}

// ─────────────────────── Panel (authenticated) ───────────────────────

/** Ask the client to sign this receivable. Supersedes any live request. */
export function requestSignature(
  receivableId: number,
  body: CreateSignatureRequestBody = {},
): Promise<SignatureRequestState> {
  return api<SignatureRequestState>(`/api/v1/receivables/${receivableId}/signature-request`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Current signature state, or null when none was ever asked for (the backend
 * answers 204, which `api` surfaces as an empty body).
 */
export async function getSignatureRequest(
  receivableId: number,
): Promise<SignatureRequestState | null> {
  const result = await api<SignatureRequestState | null>(
    `/api/v1/receivables/${receivableId}/signature-request`,
  );
  return result ?? null;
}

/** Withdraw the live request; every link already sent stops working. */
export function revokeSignatureRequest(receivableId: number): Promise<SignatureRequestState> {
  return api<SignatureRequestState>(`/api/v1/receivables/${receivableId}/signature-request`, {
    method: 'DELETE',
  });
}

/** Full URL of the captured stroke (feed to AuthImage — it needs the session). */
export function signatureImageUrl(signatureRequestId: number): string {
  return `${getBaseUrl()}/api/v1/signature-requests/${signatureRequestId}/image`;
}

/**
 * The signature block for the invoice PDF, or undefined when the document is
 * not signed (or the stored image cannot be read). Resolves to undefined on
 * ANY failure on purpose: a signature we cannot fetch must degrade to the
 * blank ruled line the PDF always printed, never block the download.
 */
export async function loadSignatureForPdf(receivableId: number): Promise<
  | { imageDataUrl: string; signerName: string; signerTitle: string; signedAt: string; documentHash: string }
  | undefined
> {
  try {
    const state = await getSignatureRequest(receivableId);
    if (!state || state.status !== 'SIGNED' || !state.hasSignatureImage || !state.signedAt) {
      return undefined;
    }
    const res = await fetch(signatureImageUrl(state.id), {
      credentials: 'include' as RequestCredentials,
    });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return {
      imageDataUrl,
      signerName: state.signerName ?? '',
      signerTitle: state.signerTitle ?? '',
      signedAt: state.signedAt,
      documentHash: state.documentHash,
    };
  } catch {
    return undefined;
  }
}

// ─────────────────────── Public (the signer) ───────────────────────

/** Exchange the emailed link token for a short-lived signing session. */
export function openSignatureSession(token: string): Promise<SignatureSession> {
  return api<SignatureSession>('/api/v1/sign/session', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

/** Sign: name + title + PNG stroke. Terminal — the link dies here. */
export function submitSignature(
  sessionToken: string,
  body: { signerName: string; signerTitle: string; signatureImage: string },
): Promise<SignatureOutcome> {
  return api<SignatureOutcome>('/api/v1/sign/submit', {
    method: 'POST',
    headers: signAuthHeaders(sessionToken),
    body: JSON.stringify(body),
  });
}

/** Refuse to sign, with an optional reason. Also terminal. */
export function declineSignature(
  sessionToken: string,
  reason?: string,
): Promise<SignatureOutcome> {
  return api<SignatureOutcome>('/api/v1/sign/decline', {
    method: 'POST',
    headers: signAuthHeaders(sessionToken),
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

/** Authorization header carrying the signing session token. */
export function signAuthHeaders(sessionToken: string): Record<string, string> {
  return { Authorization: `Bearer ${sessionToken}` };
}
