// BuildTrack — Cobros has its tour in the finance panel too.
//
// After issuing, «Ver cómo» asks the tour for its signature stop over the
// document just issued (requestTourStop). Only a mounted SectionTour answers,
// and the finance panel mounted one only where ONBOARDING_KEY maps the
// section: without Cobros there, the button did nothing for Finanzas, and the
// screen offered no «?» either.

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
vi.mock('../components/clients/ClientsSection', () => ({ ClientsSection: () => null }));
vi.mock('../components/AccountsReceivable', () => ({ AccountsReceivable: () => <div data-testid="section-receivables" /> }));
vi.mock('../components/AccountsPayable', () => ({ AccountsPayable: () => null }));
vi.mock('../components/labor/LaborCostScreen', () => ({ LaborCostScreen: () => null }));
vi.mock('../components/labor/LaborPayrollScreen', () => ({ LaborPayrollScreen: () => null }));
vi.mock('../components/approvals/ApprovalsInbox', () => ({ ApprovalsInbox: () => null }));

import { FinanceDashboard } from './FinanceDashboard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('FinanceDashboard — Cobros tour', () => {
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

  it('Cobros mounts its tour, the one «Ver cómo» opens at the signature stop, and offers «?»', async () => {
    await act(async () => root.render(<FinanceDashboard initialSection="accounts-receivable" />));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(container.querySelector('[data-testid="section-receivables"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="section-tour"]')?.getAttribute('data-section')).toBe('accounts-receivable');
    expect(container.querySelector('[data-testid="topbar"] button')).not.toBeNull();
  });
});
