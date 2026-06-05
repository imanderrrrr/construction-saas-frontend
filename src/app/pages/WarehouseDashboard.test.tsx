// BuildTrack — WarehouseDashboard deep-link (initialSection) tests.
//
// The /warehouse/inventory route opens the warehouse dashboard on the
// tool-inventory section (the sidebar still exposes consumables + the rest).
// These tests verify the `initialSection` prop maps to the right section.
// Heavy children, the dropdown, and the dashboard service are stubbed.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../services/auth', () => ({
  AuthService: { getUsername: () => 'wh', logout: () => Promise.resolve() },
}));
vi.mock('../components/ui/button', () => ({
  Button: ({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...rest}>{children}</button>
  ),
}));
vi.mock('../components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <button>{children}</button>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));
vi.mock('../components/StatCard', () => ({ StatCard: () => <div data-testid="stat-card" /> }));
vi.mock('../components/ui/sonner', () => ({ Toaster: () => <span data-testid="toaster" /> }));
vi.mock('../components/LanguageSwitcher', () => ({ LanguageSwitcher: () => <span data-testid="lang" /> }));
vi.mock('../services/warehouse', () => ({
  getDashboard: () => Promise.resolve({
    recentActivity: [],
    lowStockAlerts: [],
    kpis: { totalTools: 0, availableTools: 0, assignedTools: 0, needsAttention: 0, consumableItems: 0, lowStockAlerts: 0 },
  }),
}));
vi.mock('../components/ToolInventory', () => ({
  ToolInventory: () => <div data-testid="section-tool-inventory">TOOLS</div>,
}));

import { WarehouseDashboard } from './WarehouseDashboard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('WarehouseDashboard – initialSection deep-linking', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it('opens the tool-inventory section when initialSection="tool-inventory"', async () => {
    await act(async () => {
      root.render(<WarehouseDashboard initialSection="tool-inventory" />);
    });
    await flush();

    expect(container.querySelector('[data-testid="section-tool-inventory"]')).toBeTruthy();
  });

  it('defaults to the dashboard home (no deep-linked section) when no prop is given', async () => {
    await act(async () => {
      root.render(<WarehouseDashboard />);
    });
    await flush();

    expect(container.querySelector('[data-testid="section-tool-inventory"]')).toBeNull();
    // DashboardView welcome header proves we landed on the dashboard home.
    expect(container.textContent).toContain('warehouse.welcome');
  });
});
