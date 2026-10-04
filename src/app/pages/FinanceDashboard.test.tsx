// BuildTrack — FinanceDashboard deep-link (initialSection) tests.
//
// The /finance/expenses and /finance/budgets routes render the finance
// dashboard pre-opened on a section (instead of the old ComingSoon stub),
// keeping the full shell. These tests verify the `initialSection` prop maps
// to the right section. Heavy section components + services are stubbed so we
// exercise FinanceDashboard's own section switching, not their data fetching.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ navigate: vi.fn() }));
const capturedNavigate = vi.hoisted(() => ({ current: null as null | ((section: string) => void) }));
vi.mock('react-router', () => ({ useNavigate: () => router.navigate }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('../services/auth', () => ({
  AuthService: { getUsername: () => 'fin', logout: () => Promise.resolve() },
}));
vi.mock('../components/AppShell', () => ({
  AppShell: ({ children, navItems, onNavigate }: { children: React.ReactNode; navItems: { key: string; label: string }[]; onNavigate: (section: string) => void }) => {
    capturedNavigate.current = onNavigate;
    return <div data-testid="app-shell"><nav>{navItems.map(item => <button key={item.key} data-section={item.key} onClick={() => onNavigate(item.key)}>{item.label}</button>)}</nav>{children}</div>;
  },
}));
vi.mock('../components/StatCard', () => ({ StatCard: () => <div data-testid="stat-card" /> }));
vi.mock('../components/ui/sonner', () => ({ Toaster: () => <span data-testid="toaster" /> }));
vi.mock('../services/expenses', () => ({
  getFinanceExpenses: () => Promise.resolve({ content: [] }),
  getFinanceExpenseReport: () => Promise.resolve({
    kpis: { totalApprovedCents: 0, avgPerWorkerCents: 0, expenseCount: 0, topCategory: null },
    byProject: [],
  }),
}));
// The two sections the new routes deep-link to — stubbed to identifiable nodes.
// Gastos aprobados ya no es una pantalla propia: es la bandeja unificada en
// modo solo lectura, la misma que monta el panel del administrador.
vi.mock('../components/expenses/ExpensesSection', () => ({
  ExpensesSection: (props: { readOnly?: boolean }) => (
    <div data-testid="section-expenses" data-readonly={String(!!props.readOnly)}>EXPENSES</div>
  ),
}));
// `/finance/budgets` now lands on the unified screen — the same component the
// admin panel mounts, read-only — with its own Obras | Reporte switcher.
vi.mock('../components/budgets/BudgetsSection', () => ({
  BudgetsSection: (props: { readOnly?: boolean }) => (
    <div data-testid="section-budgets" data-readonly={String(!!props.readOnly)}>BUDGETS</div>
  ),
}));

vi.mock('../components/finance/FinanceOverview', () => ({ FinanceOverview: () => <div data-testid="finance-overview" /> }));
const tour = vi.hoisted(() => ({ sections: [] as string[] }));
vi.mock('../components/onboarding/SectionTour', () => ({
  SectionTour: ({ section }: { section: string }) => { tour.sections.push(section); return <div data-testid="section-tour" data-section={section} />; },
}));
vi.mock('../components/clients/ClientsSection', () => ({ ClientsSection: (props: { readOnly?: boolean; projectSection?: string }) => <div data-testid="section-clients" data-readonly={String(props.readOnly)} data-projectsection={props.projectSection} /> }));
vi.mock('../components/AccountsReceivable', () => ({ AccountsReceivable: () => <div data-testid="section-receivables" /> }));
vi.mock('../components/AccountsPayable', () => ({ AccountsPayable: () => <div data-testid="section-payables" /> }));
vi.mock('../components/labor/LaborCostScreen', () => ({ LaborCostScreen: ({ mode }: { mode: string }) => <div data-testid="section-labor-cost" data-mode={mode} /> }));
vi.mock('../components/labor/LaborPayrollScreen', () => ({ LaborPayrollScreen: ({ mode }: { mode: string }) => <div data-testid="section-labor-payroll" data-mode={mode} /> }));
vi.mock('../components/approvals/ApprovalsInbox', () => ({ ApprovalsInbox: ({ mode }: { mode: string }) => <div data-testid="section-supervisor-hours" data-mode={mode} /> }));

import { FinanceDashboard } from './FinanceDashboard';
import { peekSectionIntent, resetSectionIntents } from '../lib/sectionIntent';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Let lazy()/Suspense + effect promises settle.
async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('FinanceDashboard – initialSection deep-linking', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    router.navigate.mockReset();
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

  it('opens the approved-expenses section when initialSection="approved-expenses"', async () => {
    await act(async () => {
      root.render(<FinanceDashboard initialSection="approved-expenses" />);
    });
    await flush();

    expect(container.querySelector('[data-testid="section-expenses"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="section-budgets"]')).toBeNull();
  });

  it('opens the budgets section when initialSection="budgets"', async () => {
    await act(async () => {
      root.render(<FinanceDashboard initialSection="budgets" />);
    });
    await flush();

    const section = container.querySelector('[data-testid="section-budgets"]');
    expect(section).toBeTruthy();
    // Finance sees the same numbers with nothing to write.
    expect(section?.getAttribute('data-readonly')).toBe('true');
    expect(container.querySelector('[data-testid="section-expenses"]')).toBeNull();
  });

  it('defaults to the dashboard home (no deep-linked section) when no prop is given', async () => {
    await act(async () => {
      root.render(<FinanceDashboard />);
    });
    await flush();

    expect(container.querySelector('[data-testid="app-shell"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="section-expenses"]')).toBeNull();
    expect(container.querySelector('[data-testid="section-budgets"]')).toBeNull();
  });
  it('includes Clients, client billing and payables in the finance navigation', async () => {
    await act(async () => root.render(<FinanceDashboard />));
    await flush();
    expect(container.querySelector('[data-section="clients"]')).toBeTruthy();
    expect(container.querySelector('[data-section="accounts-receivable"]')).toBeTruthy();
    expect(container.querySelector('[data-section="accounts-payable"]')).toBeTruthy();
    expect(container.querySelector('[data-section="invoices"]')).toBeNull();
    await act(async () => (container.querySelector('[data-section="clients"]') as HTMLButtonElement).click());
    expect(router.navigate).toHaveBeenCalledWith('/finance/clients');
    await act(async () => root.render(<FinanceDashboard initialSection="clients" />));
    await flush();
    expect(container.querySelector('[data-testid="section-clients"]')?.getAttribute('data-readonly')).toBe('true');
    expect(container.querySelector('[data-testid="section-clients"]')?.getAttribute('data-projectsection')).toBe('budgets');
  });

  it('sends a screen that still asks for Facturas to Cobros, with the issue window asked for', async () => {
    resetSectionIntents();
    await act(async () => root.render(<FinanceDashboard initialSection="budgets" />));
    await flush();
    const budgets = container.querySelector('[data-testid="section-budgets"]');
    // The budgets mock offers no "invoices" button; drive the panel's navigation the way a screen would.
    expect(budgets).toBeTruthy();
    await act(async () => { capturedNavigate.current!('invoices'); });
    expect(router.navigate).toHaveBeenCalledWith('/finance/receivables');
    expect(peekSectionIntent('accounts-receivable')).toEqual({ openIssue: true });
  });

  it('mounts the tour of every section it has copy for, including the new finance ones', async () => {
    for (const [section, key] of [
      ['dashboard', 'finance-dashboard'],
      ['clients', 'clients-finanzas'],
      ['accounts-receivable', 'accounts-receivable'],
      ['accounts-payable', 'accounts-payable'],
      ['budgets', 'budgets'],
      ['labor-cost', 'labor-cost-finanzas'],
      ['labor-payroll', 'labor-payroll-finanzas'],
      ['supervisor-hours', 'supervisor-hours-finanzas'],
    ] as const) {
      await act(async () => root.render(<FinanceDashboard initialSection={section === 'dashboard' ? undefined : section} />));
      await flush();
      expect(container.querySelector('[data-testid="section-tour"]')?.getAttribute('data-section'), section).toBe(key);
    }
  });

  it('updates the screen when the router changes the initial section', async () => {
    await act(async () => root.render(<FinanceDashboard initialSection="accounts-receivable" />));
    await flush();
    await act(async () => root.render(<FinanceDashboard initialSection="accounts-payable" />));
    await flush();
    expect(container.querySelector('[data-testid="section-payables"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="section-receivables"]')).toBeNull();
  });

  it.each([
    ['labor-cost', '/finance/labor-cost'],
    ['labor-payroll', '/finance/payroll'],
    ['supervisor-hours', '/finance/supervisor-hours'],
  ] as const)('opens the new %s screen in finance mode and keeps its own URL', async (section, path) => {
    await act(async () => root.render(<FinanceDashboard initialSection={section} />));
    await flush();
    expect(container.querySelector(`[data-testid="section-${section}"]`)?.getAttribute('data-mode')).toBe('finance');
    await act(async () => (container.querySelector(`[data-section="${section}"]`) as HTMLButtonElement).click());
    expect(router.navigate).toHaveBeenCalledWith(path);
  });
});
