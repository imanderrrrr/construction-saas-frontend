// The ficha's three states change the chrome, never the tabs: incompleta
// (orange notice + what is missing), cerrada (red notice, no actions, six tabs
// still navigable) and sin plan (padlocked tabs that explain why). Plus the
// tab counters and the tour scope the tab on screen claims.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  listPunchItems: vi.fn(),
  listRfis: vi.fn(),
  feature: { enabled: true, loading: false },
}));

vi.mock('../../services/punchItems', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/punchItems')>()),
  listPunchItems: svc.listPunchItems,
}));
vi.mock('../../services/rfis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/rfis')>()),
  listRfis: svc.listRfis,
}));
vi.mock('../../hooks/useSiteLogFeature', () => ({
  useSiteLogFeature: () => svc.feature,
}));
// The two lists and the map have their own suites; here they are landmarks.
vi.mock('../punchlist/PunchList', () => ({ PunchList: () => <div data-testid="punch-list" /> }));
vi.mock('../rfi/RfiList', () => ({ RfiList: () => <div data-testid="rfi-list" /> }));
vi.mock('./form/LocationMap', () => ({ LocationMap: (p: { stamp?: string }) => <div data-testid="map">{p.stamp}</div> }));
vi.mock('./ficha/PortalPanel', () => ({ PortalPanel: () => <div data-testid="portal-panel" /> }));

import i18n from '../../../i18n';
import { pushTourScope, resetTourScope, useTourScope } from '../../lib/tourScope';
import { ProjectFicha } from './ProjectFicha';
import type { Project, UserForAssign } from './types';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const USERS: UserForAssign[] = [
  { id: 1, username: 'pgarcia', fullName: 'Pedro García', role: 'SUPERVISOR', status: 'ACTIVE' },
  { id: 2, username: 'lcruz', fullName: 'Luis Cruz', role: 'WORKER', status: 'ACTIVE' },
  { id: 3, username: 'aixcot', fullName: 'Ana Ixcot', role: 'SUBCONTRACTOR', status: 'INACTIVE' },
];

const PROJECT: Project = {
  id: 12, name: 'Torre Vista Hermosa', status: 'ACTIVE', clientId: 7, clientName: 'Inmobiliaria Andes', costCode: 'GDL-TC-2026-001',
  originalContractCents: 42_000_000, changeOrdersTotalCents: 850_000, revisedContractCents: 42_850_000, contractAmountCents: 7_744_000,
  totalConsumedCents: 27_456_000, costBudgetCents: 35_200_000, budgetBaseCents: 35_200_000, remainingBudgetCents: 7_744_000,
  invoicedCents: 26_000_000, collectedCents: 19_500_000, outstandingCents: 6_500_000,
  address: 'Calz. Vista Hermosa 88, Zona 15', latitude: 14.6123, longitude: -90.5122, geofenceRadiusMeters: 200,
  createdAt: '2026-02-14T12:00:00Z', updatedAt: '2026-02-14T12:00:00Z', assignedUserIds: [1, 2, 3],
};

function ScopeProbe() {
  const scope = useTourScope();
  return <span data-testid="scope">{scope?.key ?? 'none'}</span>;
}

const noop = () => {};

async function flush() {
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}

describe('ProjectFicha', () => {
  let container: HTMLDivElement;
  let root: Root;

  // The assertions below quote the sheet's Spanish copy on purpose: the
  // kicker and the "Faltan …" sentence are composed in code, and this is the
  // one place that proves the composition reads like the design.
  beforeAll(() => i18n.changeLanguage('es'));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    svc.feature = { enabled: true, loading: false };
    svc.listPunchItems.mockReset().mockResolvedValue([
      { id: 1, status: 'READY_FOR_REVIEW' }, { id: 2, status: 'IN_PROGRESS' }, { id: 3, status: 'REOPENED' }, { id: 4, status: 'CLOSED' },
    ]);
    svc.listRfis.mockReset().mockResolvedValue([
      { id: 1, ballInCourt: 'COMPANY' }, { id: 2, ballInCourt: 'CLIENT' }, { id: 3, ballInCourt: 'NONE' },
    ]);
    resetTourScope();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    resetTourScope();
  });

  async function render(project: Project = PROJECT, extra: Partial<React.ComponentProps<typeof ProjectFicha>> = {}) {
    await act(async () => {
      root.render(
        <>
          <ScopeProbe />
          <ProjectFicha
            project={project} allUsers={USERS} usersLoading={false}
            onBack={noop} onAssign={noop} onToggleStatus={noop} onCloseProject={noop} onDelete={noop} onEdit={noop} onPlans={noop}
            {...extra}
          />
        </>,
      );
    });
    await flush();
  }

  const tabButton = (label: string) =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(b => b.textContent?.includes(label))!;

  it('opens on Resumen with the identity kicker, the read-only map and the tab counters', async () => {
    await render();
    expect(container.textContent).toContain('Proyecto · #12 · GDL-TC-2026-001 · Inmobiliaria Andes');
    expect(container.querySelector('[data-testid="map"]')!.textContent).toContain('Solo lectura · geocerca 200 m');
    // Equipo counts the crew; Pendientes counts what is not closed; Consultas counts our move.
    expect(tabButton(i18n.t('admin:projectFicha.tab.equipo')).textContent).toContain('3');
    expect(tabButton(i18n.t('admin:projectFicha.tab.pendientes')).textContent).toContain('3');
    expect(tabButton(i18n.t('admin:projectFicha.tab.consultas')).textContent).toContain('1');
    // The Resumen tab owns the tour.
    expect(container.querySelector('[data-testid="scope"]')!.textContent).toBe('projects-ficha-resumen');
    expect(container.querySelector('[data-tour="sec.projects-ficha-resumen.bar"]')).not.toBeNull();
  });

  it('switching tabs swaps the subventana and hands the tour to it', async () => {
    await render();
    await act(async () => tabButton(i18n.t('admin:projectFicha.tab.equipo')).click());
    expect(container.textContent).toContain('@pgarcia');
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.purpose.equipo'));
    expect(container.querySelector('[data-testid="scope"]')!.textContent).toBe('projects-ficha-equipo');

    await act(async () => tabButton(i18n.t('admin:projectFicha.tab.pendientes')).click());
    expect(container.querySelector('[data-testid="punch-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="scope"]')!.textContent).toBe('projects-ficha-pendientes');
  });

  it('an incomplete project says what is missing and offers to complete the record', async () => {
    await render({ ...PROJECT, clientId: null, clientName: null, costCode: null, originalContractCents: null, revisedContractCents: null });
    expect(container.textContent).toContain('Faltan cliente, código de costo y monto de contrato');
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.incomplete.body'));
    expect(container.textContent).toContain('Proyecto · #12 · sin código · sin cliente');
    // No client → nothing to share yet.
    expect(container.textContent).not.toContain(i18n.t('admin:projectFicha.share'));
  });

  it('a closed project is read-only: red notice, way back, no actions, six tabs still there', async () => {
    await render({ ...PROJECT, status: 'CLOSED', updatedAt: '2025-11-09T12:00:00Z' });
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.closed.body'));
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.backToList'));
    expect(container.textContent).not.toContain(i18n.t('admin:projectDetails.assignUsers'));
    expect(container.querySelectorAll('[role="tab"]').length).toBe(6);
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.closed.stamp'));

    await act(async () => tabButton(i18n.t('admin:projectFicha.tab.equipo')).click());
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.resumen.noClockIn'));
    expect(container.querySelector('[data-tour="sec.projects-ficha-equipo.assign"]')).toBeNull();
  });

  it('without the plan, the three portal tabs are padlocked and explain why', async () => {
    svc.feature = { enabled: false, loading: false };
    await render();
    const locked = Array.from(container.querySelectorAll('[role="tab"][aria-disabled="true"]'));
    expect(locked.map(b => b.textContent?.trim())).toEqual([
      i18n.t('admin:projectFicha.tab.pendientes'), i18n.t('admin:projectFicha.tab.consultas'), i18n.t('admin:projectFicha.tab.portal'),
    ]);
    await act(async () => tabButton(i18n.t('admin:projectFicha.tab.portal')).click());
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.locked.title'));
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.locked.body'));
    expect(container.querySelector('[data-testid="portal-panel"]')).toBeNull();
    // No plan → nothing was fetched for the counters.
    expect(svc.listPunchItems).not.toHaveBeenCalled();
  });

  it('a window opened on top keeps the tour until it closes', async () => {
    await render();
    let release: () => void = () => {};
    await act(async () => { release = pushTourScope({ key: 'projects-crear' }); });
    expect(container.querySelector('[data-testid="scope"]')!.textContent).toBe('projects-crear');
    await act(async () => release());
    expect(container.querySelector('[data-testid="scope"]')!.textContent).toBe('projects-ficha-resumen');
  });
});
