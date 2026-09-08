import { api } from '../lib/api';

/** Company identity for white-labeling (same endpoint the mobile app uses). */
export interface BrandingInfo {
  organizationName: string | null;
  hasLogo: boolean;
}

export function getBranding(): Promise<BrandingInfo> {
  return api<BrandingInfo>('/api/v1/branding');
}

/* ─────────── The tenant's own name, for the documents it exports ─────────── */

let namePromise: Promise<string> | null = null;

/**
 * The company name to print on an exported report, resolved once per session.
 *
 * Seven export functions across five files carried
 * `companyName = 'OFJR Construction'` as a default, and no screen passed the
 * parameter — so every tenant signed its expense reports, its payroll and its
 * audit log with the pilot client's name. PR #102 removed the same hardcoded
 * issuer from the invoice PDF; these are the rest of them, and the reason the
 * parameter is required now rather than defaulted: a default is what let this
 * go unnoticed.
 *
 * `GET /api/v1/branding` is the right source and needs no new endpoint: it is
 * open to any authenticated user (FINANCE exports too, and the invoice
 * template's PUT is ADMIN-only), and the server already falls back from the
 * admin-configured commercial name to the tenant's registered one.
 *
 * An empty string when neither exists or the call fails — the banner then
 * prints nothing, which is the honest outcome. Never a constant: that is
 * exactly what put another company's name on these documents.
 */
export function tenantCompanyName(): Promise<string> {
  namePromise ??= getBranding()
    .then(b => b.organizationName?.trim() ?? '')
    .catch(() => {
      namePromise = null; // transient failure: the next export retries
      return '';
    });
  return namePromise;
}

/** Call after the invoice template is saved, so the next export picks it up. */
export function invalidateTenantCompanyName(): void {
  namePromise = null;
}
