import { api } from '../lib/api';

/** Company identity for white-labeling (same endpoint the mobile app uses). */
export interface BrandingInfo {
  organizationName: string | null;
  hasLogo: boolean;
}

export function getBranding(): Promise<BrandingInfo> {
  return api<BrandingInfo>('/api/v1/branding');
}
