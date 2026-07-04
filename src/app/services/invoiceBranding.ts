// Per-tenant invoice template (issuer branding): the block printed in the
// header of every invoice / change-order PDF. Configured once from
// Configuración → Plantilla de factura; every PDF generation loads it via
// [loadInvoiceIssuer] (cached per session, invalidated on save).

import { api, apiMultipart, getBaseUrl } from '../lib/api';
import type { InvoiceIssuerPdf } from '../helpers/exportInvoicePdf';

const ENDPOINT = '/api/v1/settings/invoice-branding';

export interface InvoiceBranding {
  /** False until the tenant saves the template for the first time. */
  configured: boolean;
  companyName: string | null;
  contactName: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  hasLogo: boolean;
}

export interface UpdateInvoiceBrandingPayload {
  companyName?: string | null;
  contactName?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  /** True removes the stored logo. */
  removeLogo?: boolean;
}

export async function getInvoiceBranding(): Promise<InvoiceBranding> {
  return api<InvoiceBranding>(ENDPOINT);
}

export async function updateInvoiceBranding(
  payload: UpdateInvoiceBrandingPayload,
): Promise<InvoiceBranding> {
  return api<InvoiceBranding>(ENDPOINT, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/** Upload/replace the logo (PNG/JPEG ≤ 2 MB — mirrors the backend rules). */
export async function uploadInvoiceLogo(file: File): Promise<InvoiceBranding> {
  const formData = new FormData();
  formData.append('file', file);
  return apiMultipart<InvoiceBranding>(`${ENDPOINT}/logo`, 'PUT', formData);
}

/**
 * Authenticated logo bytes as a data URL — jsPDF embeds images from data
 * URLs, and the settings screen previews it the same way. Null when there is
 * no logo (404) or the fetch fails; callers fall back to no logo.
 */
export async function fetchInvoiceLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(`${getBaseUrl()}${ENDPOINT}/logo`, { credentials: 'include' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/* ─────────────── Cached issuer for PDF generation ─────────────── */

let issuerPromise: Promise<InvoiceIssuerPdf | undefined> | null = null;

/**
 * The issuer block for [generateInvoicePdf], loaded once per session and
 * shared by every PDF/preview call. `undefined` (template never configured
 * or request failed) keeps the helper's legacy hardcoded header, so invoice
 * generation NEVER blocks on this endpoint. A failed load is not cached —
 * the next call retries.
 */
export function loadInvoiceIssuer(): Promise<InvoiceIssuerPdf | undefined> {
  issuerPromise ??= (async () => {
    try {
      const branding = await getInvoiceBranding();
      if (!branding.configured) return undefined;
      const logoDataUrl = branding.hasLogo ? await fetchInvoiceLogoDataUrl() : null;
      return {
        name: branding.companyName,
        contact: branding.contactName,
        address: branding.address,
        phone: branding.phone,
        email: branding.email,
        logoDataUrl,
      };
    } catch {
      issuerPromise = null; // transient failure: retry on the next PDF
      return undefined;
    }
  })();
  return issuerPromise;
}

/** Call after saving the template so the next PDF picks up the changes. */
export function invalidateInvoiceIssuer(): void {
  issuerPromise = null;
}
