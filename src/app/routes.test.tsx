// BuildTrack — route wiring tests for the three formerly-"ComingSoon" routes.
//
// Mounts the real `routes` table with a memory router at each target path and
// asserts: (1) an authorized role lands on the real module (the dashboard,
// deep-linked to the right section) rather than a placeholder, and (2) an
// unauthorized role is redirected by ProtectedRoute to its own dashboard.
//
// The three dashboards are stubbed to identifiable nodes so the test exercises
// route + guard wiring, not the dashboards' data fetching. (Their own section
// switching is covered in FinanceDashboard/WarehouseDashboard tests.)

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

const auth = vi.hoisted(() => {
  const ref = { role: 'FINANCE' as string, authed: true };
  return {
    ref,
    AuthService: {
      isAuthenticated: () => ref.authed,
      getRole: () => ref.role,
      // A blocked role is redirected here; WorkerDashboard is stubbed below.
      getDashboardRoute: () => '/worker/dashboard',
      getUsername: () => 'u',
      logout: () => Promise.resolve(),
    },
  };
});

vi.mock('./services/auth', () => ({ AuthService: auth.AuthService }));
// Pass-through so the (admin-only) billing fetch never runs in the test.
vi.mock('./components/BillingGuard', () => ({
  BillingGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./pages/FinanceDashboard', () => ({
  FinanceDashboard: ({ initialSection }: { initialSection?: string }) => (
    <div data-testid="finance-dash">finance:{String(initialSection)}</div>
  ),
}));
vi.mock('./pages/WarehouseDashboard', () => ({
  WarehouseDashboard: ({ initialSection }: { initialSection?: string }) => (
    <div data-testid="warehouse-dash">warehouse:{String(initialSection)}</div>
  ),
}));
vi.mock('./pages/WorkerDashboard', () => ({
  WorkerDashboard: () => <div data-testid="worker-dash">worker</div>,
}));

import { routes } from './routes';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderPath(root: Root, path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  await act(async () => {
    root.render(<RouterProvider router={router} />);
  });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('routes – formerly ComingSoon, now real modules', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    auth.ref.role = 'FINANCE';
    auth.ref.authed = true;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('/finance/expenses opens the finance module on the expenses section for FINANCE', async () => {
    auth.ref.role = 'FINANCE';
    await renderPath(root, '/finance/expenses');

    const dash = container.querySelector('[data-testid="finance-dash"]');
    expect(dash).toBeTruthy();
    expect(dash!.textContent).toContain('approved-expenses');
  });

  it('/finance/budgets opens the finance module on the budgets section for FINANCE', async () => {
    auth.ref.role = 'FINANCE';
    await renderPath(root, '/finance/budgets');

    const dash = container.querySelector('[data-testid="finance-dash"]');
    expect(dash).toBeTruthy();
    expect(dash!.textContent).toContain('budgets');
  });

  it('/warehouse/inventory opens the warehouse module on the tool-inventory section for WAREHOUSE', async () => {
    auth.ref.role = 'WAREHOUSE';
    await renderPath(root, '/warehouse/inventory');

    const dash = container.querySelector('[data-testid="warehouse-dash"]');
    expect(dash).toBeTruthy();
    expect(dash!.textContent).toContain('tool-inventory');
  });

  it('blocks a non-FINANCE role from /finance/expenses and redirects to its dashboard', async () => {
    auth.ref.role = 'WORKER';
    await renderPath(root, '/finance/expenses');

    expect(container.querySelector('[data-testid="finance-dash"]')).toBeNull();
    expect(container.querySelector('[data-testid="worker-dash"]')).toBeTruthy();
  });

  it('blocks a non-WAREHOUSE role from /warehouse/inventory and redirects to its dashboard', async () => {
    auth.ref.role = 'WORKER';
    await renderPath(root, '/warehouse/inventory');

    expect(container.querySelector('[data-testid="warehouse-dash"]')).toBeNull();
    expect(container.querySelector('[data-testid="worker-dash"]')).toBeTruthy();
  });
});
