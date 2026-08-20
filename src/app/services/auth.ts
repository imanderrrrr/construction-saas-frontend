// OFJR Construction — Auth Service (real API)
// Canonical roles: ADMIN | SUPERVISOR | WORKER | FINANCE | WAREHOUSE
import { CanonicalRole, ROLE_DASHBOARD_ROUTES } from '../types';
import {
  api, ApiError,
  getStoredRole, getStoredUsername,
  isAuthenticated as checkAuthenticated,
  clearSessionCookie, getCsrfToken,
  getBaseUrl,
} from '../lib/api';
import { clearPasswordChangeState } from '../lib/passwordChangeState';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  role: CanonicalRole;
  username: string;
  /** Expiration in minutes */
  expiresInMinutes: number;
  /**
   * The account is still on the password an admin issued, and the backend
   * will reject everything except the change-password flow until it is
   * replaced. Already has the office-vs-field policy applied server-side —
   * do NOT re-derive it here, or the UI and the API will disagree about who
   * is blocked. Optional so a backend that predates the field is read as
   * "not blocked" rather than crashing the login.
   */
  passwordChangeRequired?: boolean;
}

/**
 * Public-tenant signup payload. Mirrors backend `SignupRequest` —
 * keep the field names in sync.
 */
export interface SignupPayload {
  companyName: string;
  tenantSlug: string;
  adminUsername: string;
  adminPassword: string;
  adminFullName: string;
  adminEmail: string;
}

export interface MeResponse {
  username: string;
  role: CanonicalRole;
  /** See {@link LoginResponse.passwordChangeRequired}. */
  passwordChangeRequired?: boolean;
}

/** Body of `POST /api/v1/auth/change-password`. */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export { ApiError };

export class AuthService {
  /**
   * Login. `tenantSlug` selects which tenant the credentials are validated
   * against; the backend defaults to "default" (legacy OFJR tenant) when
   * absent, so omit it for that pre-SaaS deployment. New SaaS customers
   * must pass their slug — same string the customer typed when signing up.
   */
  static async login(
    credentials: LoginCredentials,
    tenantSlug?: string,
  ): Promise<LoginResponse> {
    const headers: Record<string, string> = {};
    const trimmed = tenantSlug?.trim();
    if (trimmed) headers['X-Tenant-Slug'] = trimmed.toLowerCase();
    return api<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
      headers,
    });
  }

  /**
   * Public-tenant signup. The server creates a new tenant + admin user
   * atomically and sets the auth cookies on the response, so the caller
   * lands fully authenticated as the new admin.
   */
  static async signup(payload: SignupPayload): Promise<LoginResponse> {
    return api<LoginResponse>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Validate session — GET /api/v1/auth/me
  static async getMe(): Promise<MeResponse> {
    return api<MeResponse>('/api/v1/auth/me');
  }

  /**
   * Replace my own password. This is the only way out of the temporary-password
   * block, and the backend lifts it on the session already open — no re-login.
   */
  static async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await api<void>('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // No-op: cookies are set by the server, nothing to persist client-side
  static saveAuthData(_response: LoginResponse): void {
    // Intentionally empty — kept for call-site compatibility during migration
  }

  // Readers (delegate to cookie-based helpers)
  static getRole():     string | null { return getStoredRole();     }
  static getUsername(): string | null { return getStoredUsername(); }
  static isAuthenticated(): boolean   { return checkAuthenticated(); }

  // Get canonical role (typed)
  static getCanonicalRole(): CanonicalRole | null {
    const role = this.getRole();
    const canonical: CanonicalRole[] = ['ADMIN','SUPERVISOR','WORKER','FINANCE','WAREHOUSE','SUBCONTRACTOR'];
    return canonical.includes(role as CanonicalRole) ? role as CanonicalRole : null;
  }

  // Dashboard route after login (per canonical role)
  static getDashboardRoute(role: string): string {
    return ROLE_DASHBOARD_ROUTES[role as CanonicalRole] ?? '/';
  }

  // Logout — async: revokes session on server, then clears client cookie
  static async logout(): Promise<void> {
    try {
      await fetch(`${getBaseUrl()}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-XSRF-TOKEN': getCsrfToken() ?? '' },
      });
    } catch { /* best effort */ }
    clearSessionCookie();
    // Otherwise the next person to sign in on this browser inherits the
    // previous user's verdict until their own login overwrites it.
    clearPasswordChangeState();
  }
}
