// BuildTrack — the finance panel's own guided tours.
//
// A screen claims its tour (lib/tourScope), but only a mounted SectionTour
// shows it, and the panel mounted one — and offered its «?» — only where it
// had copy of its own: the home and T&M. The screens that now have finance
// copy get both; a screen without it still gets neither.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}));
vi.mock('../services/auth', () => ({
  AuthService: { getUsername: () => 'fin', logout: () => Promise.resolve() },
}));
vi.mock('../components/AppShell', () => ({
  AppShell: ({ children, topbarExtra }: { children: React.ReactNode; topbarExtra?: React.ReactNode }) => (
    <div data-testid="app-shell"><div data-testid="topbar">{topbarExtra}</div>{children}</div>
  ),
}));
vi.mock('../components/onboarding/SectionTour', () => ({
  SectionTour: ({ section }: { section: string }) => <div data-testid="section-tour" data-section={section} />,
}));
vi.mock('../components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('../components/finance/FinanceOverview', () => ({ FinanceOverview: () => null }));
vi.mock('../components/clients/ClientsSection', () => ({ ClientsSection: () => <div data-testid="section-clients" /> }));
vi.mock('../components/AccountsReceivable', () => ({ AccountsReceivable: () => null }));
vi.mock('../components/AccountsPayable', () => ({ AccountsPayable: () => <div data-testid="section-payables" /> }));
vi.mock('../components/labor/LaborCostScreen', () => ({ LaborCostScreen: () => <div data-testid="section-labor-cost" /> }));
vi.mock('../components/labor/LaborPayrollScreen', () => ({ LaborPayrollScreen: () => <div data-testid="section-labor-payroll" /> }));
vi.mock('../components/approvals/ApprovalsInbox', () => ({ ApprovalsInbox: () => <div data-testid="section-supervisor-hours" /> }));

import { FinanceDashboard } from './FinanceDashboard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('FinanceDashboard — the screens with a tour of their own', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function open(section: NonNullable<React.ComponentProps<typeof FinanceDashboard>>['initialSection']) {
    await act(async () => root.render(<FinanceDashboard initialSection={section} />));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  }
  const tour = () => container.querySelector('[data-testid="section-tour"]')?.getAttribute('data-section') ?? null;
  const help = () => container.querySelector('[data-testid="topbar"] button');

  it.each([
    ['clients', 'clients-finanzas'],
    ['labor-cost', 'labor-cost-finanzas'],
    ['labor-payroll', 'labor-payroll-finanzas'],
    ['supervisor-hours', 'supervisor-hours-finanzas'],
  ] as const)('%s mounts its finance tour (%s) and offers «?»', async (section, key) => {
    await open(section);
    expect(tour()).toBe(key);
    expect(help()).not.toBeNull();
  });

  it('a screen without finance copy still gets neither', async () => {
    await open('accounts-payable');
    expect(container.querySelector('[data-testid="section-payables"]')).not.toBeNull();
    expect(tour()).toBeNull();
    expect(help()).toBeNull();
  });
});
