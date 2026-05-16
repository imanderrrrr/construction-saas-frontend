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
vi.mock('../components/UserManagement', () => ({
  UserManagement: () => <div data-testid="user-mgmt" />,
}));
vi.mock('../components/ProjectManagement', () => ({
  ProjectManagement: () => <div data-testid="project-mgmt" />,
}));
vi.mock('../components/AuditLog', () => ({
  AuditLog: () => <div data-testid="audit-log" />,
}));
vi.mock('../components/SupervisorApprovals', () => ({
  SupervisorApprovals: () => <div data-testid="supervisor-approvals" />,
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

import { AdminDashboard } from './AdminDashboard';

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

  it('renders the billing entry in the sidebar', async () => {
    await renderDashboard(root);
    const sidebarBilling = buttonsWithText(container, 'admin:nav.billing').filter(
      btn => btn.getAttribute('data-testid') !== 'dropdown-item',
    );
    expect(sidebarBilling).toHaveLength(1);
  });

  it('navigates to /admin/billing when the sidebar billing item is clicked', async () => {
    await renderDashboard(root);
    const sidebarBilling = buttonsWithText(container, 'admin:nav.billing').filter(
      btn => btn.getAttribute('data-testid') !== 'dropdown-item',
    );
    expect(sidebarBilling).toHaveLength(1);

    await act(async () => {
      sidebarBilling[0].click();
    });

    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/billing');
  });

  it('does not call navigate when clicking an internal section item (Users)', async () => {
    await renderDashboard(root);
    const usersBtns = buttonsWithText(container, 'admin:nav.users').filter(
      btn => btn.getAttribute('data-testid') !== 'dropdown-item',
    );
    expect(usersBtns.length).toBeGreaterThan(0);

    await act(async () => {
      usersBtns[0].click();
    });

    expect(mocks.navigate).not.toHaveBeenCalled();
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

  it('navigates to /admin/billing when the dropdown billing item is clicked', async () => {
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

    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/billing');
  });
});
