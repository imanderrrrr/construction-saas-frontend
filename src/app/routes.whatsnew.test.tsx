// BuildTrack — where the what's-new modal is mounted, exercised through the
// REAL route table and the REAL guards (PasswordChangeGuard, BillingGuard).
//
// The requirement these tests pin: the modal announces features, so it must
// only ever render once every wall has let the user through. Concretely:
//   - a forced password change renders WITHOUT the modal on top
//   - while the billing check is still resolving, no modal floats over it
//   - /admin/billing (where a blocked admin lands) never mounts it
//   - the platform console (/platform/*) never mounts it
//   - and on a fully green path it DOES appear over the dashboard
//
// Pages are stubbed to identifiable nodes; the guards and the modal are real.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  auth: {
    ref: { role: 'ADMIN' as string, authed: true, username: 'ana' as string | null },
  },
}));

vi.mock('./services/auth', () => ({
  AuthService: {
    isAuthenticated: () => mocks.auth.ref.authed,
    getRole: () => mocks.auth.ref.role,
    getUsername: () => mocks.auth.ref.username,
    getDashboardRoute: () => '/admin/dashboard',
    getMe: () => Promise.resolve({ passwordChangeRequired: false }),
    logout: () => Promise.resolve(),
  },
}));
vi.mock('./services/billing', () => ({
  BillingService: { getStatus: () => mocks.getStatus() },
}));

vi.mock('./pages/AdminDashboard', () => ({
  AdminDashboard: () => <div data-testid="admin-dash">admin</div>,
}));
vi.mock('./pages/admin/BillingPage', () => ({
  BillingPage: () => <div data-testid="billing-page">billing</div>,
}));
vi.mock('./components/ForcedPasswordChange', () => ({
  ForcedPasswordChange: () => <div data-testid="change-screen">change</div>,
}));

// Platform console: its auth model is separate and out of scope here — stub
// the chrome so /platform/* mounts, and assert the modal is nowhere in it.
vi.mock('../platform/context/PlatformAuthContext', () => ({
  PlatformAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../platform/components/ProtectedPlatformRoute', () => ({
  ProtectedPlatformRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../platform/components/PlatformShell', () => ({
  PlatformShell: () => <div data-testid="platform-shell">platform</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { routes } from './routes';
import {
  setPasswordChangeRequired,
  clearPasswordChangeState,
} from './lib/passwordChangeState';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('routes – what\'s-new modal never paints over a guard', () => {
  let container: HTMLDivElement;
  let root: Root;

  const dialog = () => container.querySelector('[role="dialog"]');
  const has = (id: string) => !!container.querySelector(`[data-testid="${id}"]`);

  beforeEach(() => {
    mocks.auth.ref.role = 'ADMIN';
    mocks.auth.ref.authed = true;
    mocks.auth.ref.username = 'ana';
    mocks.getStatus.mockReset();
    clearPasswordChangeState();
    localStorage.clear(); // the modal is unseen in every scenario
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    clearPasswordChangeState();
  });

  async function renderPath(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    await act(async () => {
      root.render(<RouterProvider router={router} />);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }

  it('renders the forced password change WITHOUT the modal on top', async () => {
    setPasswordChangeRequired(true);
    mocks.getStatus.mockResolvedValue({ billingStatus: 'ACTIVE' });
    await renderPath('/admin/dashboard');

    expect(has('change-screen')).toBe(true);
    expect(has('admin-dash')).toBe(false);
    expect(dialog()).toBeNull();
  });

  it('keeps the modal out while the billing check is still resolving', async () => {
    setPasswordChangeRequired(false);
    mocks.getStatus.mockReturnValue(new Promise(() => {})); // never settles
    await renderPath('/admin/dashboard');

    // BillingGuard is showing its spinner; neither the page nor the modal
    // may render until it decides.
    expect(has('admin-dash')).toBe(false);
    expect(dialog()).toBeNull();
  });

  it('shows the modal over the dashboard once every guard is green', async () => {
    setPasswordChangeRequired(false);
    mocks.getStatus.mockResolvedValue({ billingStatus: 'ACTIVE' });
    await renderPath('/admin/dashboard');

    expect(has('admin-dash')).toBe(true);
    expect(dialog()).not.toBeNull();
  });

  it('never mounts on /admin/billing, where a blocked admin lands', async () => {
    // Even for an in-audience admin who has not seen this round: the billing
    // page must stay unobstructed — it is the wall itself.
    setPasswordChangeRequired(false);
    await renderPath('/admin/billing');

    expect(has('billing-page')).toBe(true);
    expect(dialog()).toBeNull();
  });

  it('never mounts in the platform console', async () => {
    await renderPath('/platform/overview');

    expect(has('platform-shell')).toBe(true);
    expect(dialog()).toBeNull();
  });
});
