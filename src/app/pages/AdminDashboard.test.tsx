// BuildTrack — AdminDashboard navigation tests.
//
// Focused on the entry points into /admin/billing — the sidebar nav item
// and the user dropdown menu — without re-testing every internal section.
// The sub-pages and Radix primitives are stubbed so the test exercises
// AdminDashboard's own click handling, not the whole component tree.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getUsername: vi.fn(() => 'alice'),
  logout: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-router', () => ({
  useNavigate: () => mocks.navigate,
  // The dashboard reads `?quickbooks=` (the return from Intuit's consent
  // screen) from the location; nothing here arrives that way.
  useLocation: () => ({ pathname: '/admin/dashboard', search: '', hash: '', state: null, key: 'default' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  // The welcome dialog reaches lib/api (company name for its kicker), which
  // boots src/i18n on import — that needs this export to exist on the mock.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../services/auth', () => ({
  AuthService: {
    getUsername: mocks.getUsername,
    logout: mocks.logout,
  },
}));

// Stub heavy sub-components — we only care about navigation surfaces here.
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
vi.mock('../components/clients/ClientsSection', () => ({
  ClientsSection: () => <div data-testid="client-mgmt" />,
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

// Dropdown is rendered inline so its items are queryable without driving
// Radix's open/close + portal flow inside jsdom.
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
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button onClick={onClick} className={className} data-testid="dropdown-item">
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

import { AdminDashboard, migrateFavorites } from './AdminDashboard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderDashboard(root: Root) {
  await act(async () => {
    root.render(<AdminDashboard />);
  });
}

function buttonsWithText(container: HTMLElement, text: string): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button')).filter(
    btn => (btn.textContent ?? '').includes(text),
  ) as HTMLButtonElement[];
}

describe('AdminDashboard – billing entry points', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.navigate.mockReset();
    mocks.getUsername.mockReset();
    mocks.getUsername.mockReturnValue('alice');
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps settings separate from the six main work areas', async () => {
    await renderDashboard(root);
    expect(container.querySelectorAll('nav[aria-label="workspace.primaryNavigation"] button')).toHaveLength(6);
    expect(buttonsWithText(container, 'common:workspace.settings')).toHaveLength(1);
    expect(buttonsWithText(container, 'admin:nav.billing').filter(btn => btn.dataset.testid !== 'dropdown-item')).toHaveLength(0);
  });

  it('groups document issuance under collections and migrates legacy favorites', async () => {
    await renderDashboard(root);
    await act(async () => { buttonsWithText(container, 'common:workspace.finance')[0].click(); });
    expect(buttonsWithText(container, 'admin:nav.invoices')).toHaveLength(1);
    expect(buttonsWithText(container, 'admin:nav.accountsReceivable')).toHaveLength(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/cobros');
    expect(migrateFavorites(['invoices', 'accounts-receivable', 'budget-report', 'budgets'])).toEqual(['accounts-receivable', 'budgets']);
  });

  it('opens billing from the settings area while retaining the shell', async () => {
    await renderDashboard(root);
    await act(async () => { buttonsWithText(container, 'common:workspace.settings')[0].click(); });
    const billing = buttonsWithText(container, 'admin:nav.billing').find(btn => btn.dataset.testid !== 'dropdown-item');
    expect(billing).toBeDefined();
    await act(async () => { billing!.click(); });
    expect(mocks.navigate).toHaveBeenLastCalledWith('/admin/configuracion/suscripcion');
    expect(container.querySelector('[data-testid="billing-section"]')).not.toBeNull();
  });

  it('gives the team area its own recoverable route', async () => {
    await renderDashboard(root);
    await act(async () => { buttonsWithText(container, 'common:workspace.team')[0].click(); });
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/equipo');
    expect(container.querySelector('[data-testid="user-mgmt"]')).not.toBeNull();
  });

  it('exposes a billing entry in the user dropdown', async () => {
    await renderDashboard(root);
    const dropdownItems = Array.from(
      container.querySelectorAll('[data-testid="dropdown-item"]'),
    ) as HTMLButtonElement[];
    const billingDropdownItem = dropdownItems.find(
      btn => (btn.textContent ?? '').includes('admin:nav.billing'),
    );
    expect(billingDropdownItem).toBeTruthy();
  });

  it('opens the billing section in-shell from the dropdown item too', async () => {
    await renderDashboard(root);
    const dropdownItems = Array.from(
      container.querySelectorAll('[data-testid="dropdown-item"]'),
    ) as HTMLButtonElement[];
    const billingDropdownItem = dropdownItems.find(
      btn => (btn.textContent ?? '').includes('admin:nav.billing'),
    );
    expect(billingDropdownItem).toBeTruthy();

    await act(async () => {
      billingDropdownItem!.click();
    });

    // The dashboard retains its shell while the address reflects the section.
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/configuracion/suscripcion');
    expect(container.querySelector('[data-testid="billing-section"]')).not.toBeNull();
  });
});
