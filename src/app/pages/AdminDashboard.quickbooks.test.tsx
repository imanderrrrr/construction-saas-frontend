// The return from Intuit's consent screen lands on
// /admin/dashboard?quickbooks=<OUTCOME> (QuickBooksCallbackController). The
// dashboard must open the QuickBooks section on that outcome — the admin is
// looking for "did it work?" — and drop the parameter from the address bar,
// so a reload does not replay "connected" (or an old error) as news.
//
// Mock inventory mirrors AdminDashboard.suspense.test.tsx.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getUsername: vi.fn(() => 'alice'),
  logout: vi.fn(() => Promise.resolve()),
  search: '?quickbooks=CONNECTED',
  sectionOutcomes: [] as (string | null)[],
}));

vi.mock('react-router', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ pathname: '/admin/dashboard', search: mocks.search, hash: '', state: null, key: 'default' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../services/auth', () => ({
  AuthService: {
    getUsername: mocks.getUsername,
    logout: mocks.logout,
  },
}));

vi.mock('../components/LanguageSwitcher', () => ({ LanguageSwitcher: () => <span /> }));
vi.mock('../components/TimezoneSwitcher', () => ({ TimezoneSwitcher: () => <span /> }));
vi.mock('../components/DashboardContent', () => ({ DashboardContent: () => <div data-testid="dashboard-content" /> }));
vi.mock('../components/users/UsersRoster', () => ({ UsersRoster: () => <div /> }));
vi.mock('../components/ProjectManagement', () => ({ ProjectManagement: () => <div /> }));
vi.mock('../components/AuditLog', () => ({ AuditLog: () => <div /> }));
vi.mock('../components/BillingSection', () => ({ BillingSection: () => <div /> }));
vi.mock('../components/approvals/ApprovalsInbox', () => ({ ApprovalsInbox: () => <div /> }));
vi.mock('../components/clients/ClientsSection', () => ({ ClientsSection: () => <div /> }));
vi.mock('../components/ui/sonner', () => ({ Toaster: () => <span /> }));
vi.mock('../components/ui/button', () => ({
  Button: ({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...rest}>{children}</button>
  ),
}));
vi.mock('../components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    (asChild ? <>{children}</> : <button>{children}</button>),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

// The section body is stubbed; what matters is that the dashboard mounts it
// with the outcome it read from the address bar.
vi.mock('../components/quickbooks/QuickBooksSection', () => ({
  QuickBooksSection: ({ outcome }: { outcome: string | null }) => {
    mocks.sectionOutcomes.push(outcome);
    return <div data-testid="quickbooks-section">{outcome ?? 'none'}</div>;
  },
}));

import { AdminDashboard } from './AdminDashboard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('AdminDashboard — coming back from Intuit', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    mocks.navigate.mockClear();
    mocks.sectionOutcomes.length = 0;
    mocks.search = '?quickbooks=CONNECTED';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  const render = async () => {
    await act(async () => { root.render(<AdminDashboard />); });
    // The section is lazy: let its chunk resolve.
    await act(async () => { await Promise.resolve(); });
  };

  it('opens the QuickBooks section with the outcome and strips it from the address bar', async () => {
    await render();

    const section = container.querySelector('[data-testid="quickbooks-section"]');
    expect(section).not.toBeNull();
    expect(section!.textContent).toBe('CONNECTED');
    expect(container.querySelector('[data-testid="dashboard-content"]')).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledWith({ pathname: '/admin/dashboard', search: '' }, { replace: true });
  });

  it('ignores a value that is not an outcome, and stays on the dashboard', async () => {
    mocks.search = '?quickbooks=<script>';
    await render();

    expect(container.querySelector('[data-testid="quickbooks-section"]')).toBeNull();
    expect(container.querySelector('[data-testid="dashboard-content"]')).not.toBeNull();
  });

  it('forgets the outcome once the admin moves to another section', async () => {
    await render();
    const users = Array.from(container.querySelectorAll('button')).find(b => (b.textContent ?? '').includes('admin:nav.users'))!;
    await act(async () => { users.click(); });
    const back = Array.from(container.querySelectorAll('button')).find(b => (b.textContent ?? '').includes('admin:nav.quickbooks'))!;
    await act(async () => { back.click(); });
    await act(async () => { await Promise.resolve(); });

    expect(container.querySelector('[data-testid="quickbooks-section"]')!.textContent).toBe('none');
  });
});
