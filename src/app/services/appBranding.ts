// Per-tenant APP identity: the name and logo the product wears in its own
// chrome (mobile splash/home/login, the web dashboard kicker). Edited from
// Configuración → Identidad de la app.
//
// Separate from `invoiceBranding.ts`, which is the issuer block printed on
// invoice PDFs. Until the backend's V97 those were ONE record, so configuring
// an invoice template silently rebranded the whole app. `linkedToInvoice` is
// the checkbox that keeps that behaviour available for tenants who want it.

import { api, apiMultipart, getBaseUrl } from '../lib/api';

const ENDPOINT = '/api/v1/settings/app-branding';

export interface AppBrandingSettings {
  /** True (the default) means the app identity mirrors the invoice template. */
  linkedToInvoice: boolean;
  /** The app's OWN name, kept even while linked. Null when never set. */
  displayName: string | null;
  /** Whether the app has its OWN logo, kept even while linked. */
  hasLogo: boolean;
  /** What the app actually shows right now (the invoice name while linked). */
  effectiveName: string | null;
  /** Whether the app actually shows a logo right now. */
  effectiveHasLogo: boolean;
}

export interface UpdateAppBrandingPayload {
  linkedToInvoice: boolean;
  displayName?: string | null;
  /**
   * True removes the app's OWN logo. Linking to the invoice does NOT remove
   * it — the checkbox is a view switch, so unticking restores the logo.
   */
  removeLogo?: boolean;
}

export async function getAppBranding(): Promise<AppBrandingSettings> {
  return api<AppBrandingSettings>(ENDPOINT);
}

export async function updateAppBranding(
  payload: UpdateAppBrandingPayload,
): Promise<AppBrandingSettings> {
  return api<AppBrandingSettings>(ENDPOINT, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/** Upload/replace the app logo (PNG/JPEG ≤ 2 MB — mirrors the backend rules). */
export async function uploadAppLogo(file: File): Promise<AppBrandingSettings> {
  const formData = new FormData();
  formData.append('file', file);
  return apiMultipart<AppBrandingSettings>(`${ENDPOINT}/logo`, 'PUT', formData);
}

/**
 * The app's OWN logo bytes as a data URL, for the settings preview. Reads the
 * settings tree, NOT `/api/v1/branding/logo` — that one follows the link flag,
 * so while linked it would return the invoice logo and the screen could never
 * show what unticking the checkbox would restore. Null when there is no logo
 * (404) or the fetch fails.
 */
export async function fetchAppLogoDataUrl(): Promise<string | null> {
  return fetchLogoDataUrl(`${getBaseUrl()}${ENDPOINT}/logo`);
}

/**
 * The logo the app is CURRENTLY showing, following the link flag — the same
 * bytes the mobile app and the dashboard kicker get. Used for the "this is
 * live" preview.
 */
export async function fetchEffectiveLogoDataUrl(): Promise<string | null> {
  return fetchLogoDataUrl(`${getBaseUrl()}/api/v1/branding/logo`);
}

async function fetchLogoDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: 'include' });
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
