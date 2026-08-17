// Regression test for the T&M sections crashing the admin panel (React #426).
//
// AdminTmField / AdminTmOffice are lazy components; they used to be rendered
// WITHOUT a <Suspense> wrapper, unlike every other lazy section in this file.
// Clicking the menu item made the component suspend during a synchronous
// update with no boundary to catch it → React 18 error #426 ("A component
// suspended while responding to synchronous input") → the router's error
// boundary replaced the app with "Unexpected Application Error!".
//
// The existing T&M tests mounted the section components directly, so they
// never exercised the dashboard wiring. This test mounts the DASHBOARD and
// navigates via the menu — the path that was broken.
//
// Mock inventory mirrors AdminDashboard.test.tsx (billing entry points).

import React, { act, Component, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getUsername: vi.fn(() => 'alice'),
  logout: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../services/auth', () => ({
  AuthService: {
    getUsername: mocks.getUsername,
    logout: mocks.logout,
  },
}));

// Stub heavy sub-components — this test cares about the lazy-section wiring.
vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <span data-testid="lang-switcher" />,
}));
vi.mock('../components/TimezoneSwitcher', () => ({
  TimezoneSwitcher: () => <span data-testid="tz-switcher" />,
}));
vi.mock('../components/DashboardContent', () => ({
  DashboardContent: () => <div data-testid="dashboard-content" />,
}));
vi.mock('../components/users/UsersRoster', () => ({
  UsersRoster: () => <div data-testid="user-mgmt" />,
}));
vi.mock('../components/ProjectManagement', () => ({
  ProjectManagement: () => <div data-testid="project-mgmt" />,
}));
vi.mock('../components/AuditLog', () => ({
  AuditLog: () => <div data-testid="audit-log" />,
}));
vi.mock('../components/BillingSection', () => ({
  BillingSection: () => <div data-testid="billing-section" />,
}));
vi.mock('../components/approvals/ApprovalsInbox', () => ({
  ApprovalsInbox: () => <div data-testid="supervisor-approvals" />,
}));
vi.mock('../components/ClientManagement', () => ({
  ClientManagement: () => <div data-testid="client-mgmt" />,
}));
vi.mock('../components/ui/sonner', () => ({
  Toaster: () => <span data-testid="toaster" />,
}));

vi.mock('../components/ui/button', () => ({
  Button: ({
    children,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...rest}>{children}</button>
  ),
}));

vi.mock('../components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => (asChild ? <>{children}</> : <button>{children}</button>),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

// The T&M section bodies are stubbed, but the module is still loaded through
// the dashboard's real lazyWithRetry(import(...)) — React.lazy still suspends
// on first render, which is exactly the mechanics that crashed the panel.
vi.mock('../components/tm/TmFieldSection', () => ({
  TmFieldSection: () => <div data-testid="tm-field-section" />,
}));
vi.mock('../components/tm/TmOfficeSection', () => ({
  TmOfficeSection: () => <div data-testid="tm-office-section" />,
}));

import { AdminDashboard } from './AdminDashboard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Stand-in for react-router's errorElement: records what escapes the tree. */
class CrashProbe extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) return <div data-testid="crash">{this.state.error.message}</div>;
    return this.props.children;
  }
}

describe('AdminDashboard T&M navigation (regression: lazy without Suspense)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  /** The sidebar nav button for a section, found by its (mocked) label key. */
  const navButton = (labelKey: string) => {
    const btn = Array.from(container.querySelectorAll('button'))
      .find(b => (b.textContent ?? '').includes(labelKey));
    expect(btn, `nav button ${labelKey} should exist`).toBeDefined();
    return btn as HTMLButtonElement;
  };

  it.each([
    { label: 'tm:nav.field', testId: 'tm-field-section' },
    { label: 'tm:nav.office', testId: 'tm-office-section' },
  ])('clicking $label loads the section instead of crashing', async ({ label, testId }) => {
    await act(async () => {
      root.render(
        <CrashProbe>
          <AdminDashboard />
        </CrashProbe>,
      );
    });
    expect(container.querySelector('[data-testid="crash"]')).toBeNull();

    // Real click on the menu item — a discrete (synchronous-priority) update,
    // the input that triggered #426.
    await act(async () => { navButton(label).click(); });

    // Nothing escaped to the error boundary…
    const crash = container.querySelector('[data-testid="crash"]');
    expect(crash?.textContent ?? '').toBe('');
    expect(crash).toBeNull();

    // …and once the lazy chunk resolves, the section is on screen.
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
  });
});
