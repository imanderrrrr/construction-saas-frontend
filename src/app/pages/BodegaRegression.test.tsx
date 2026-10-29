import '../lib/warehouseIntent.testing';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  getDashboard: vi.fn(), getAllDispatches: vi.fn(), listConsumables: vi.fn(), listWarehouseProjects: vi.fn(),
  getActiveAssignments: vi.fn(), getAssignmentLog: vi.fn(), getAssignmentSummary: vi.fn(), listTools: vi.fn(),
  getDispatchSummary: vi.fn(), dispatchConsumable: vi.fn(),
}));
vi.mock('../services/warehouse', async original => ({...await original<typeof import('../services/warehouse')>(), ...svc}));
vi.mock('../services/users', () => ({listActiveUsers: () => Promise.resolve([])}));
vi.mock('react-router', () => ({useNavigate: () => vi.fn()}));
vi.mock('../services/auth', () => ({AuthService: {getUsername: () => 'audit', logout: vi.fn()}}));
vi.mock('../components/AppShell', () => ({AppShell: ({children}: {children: React.ReactNode}) => <main>{children}</main>}));
vi.mock('../components/notifications/NotificationInbox', () => ({NotificationInbox: () => null}));
vi.mock('../components/ui/sonner', () => ({Toaster: () => null}));
vi.mock('sonner', () => ({toast: {error: vi.fn(), success: vi.fn()}}));
import i18n from '../../i18n';
import { WarehouseDashboard } from './WarehouseDashboard';
import { ConsumableDispatch } from '../components/ConsumableDispatch';
import { ToolAssignment } from '../components/ToolAssignment';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('es');
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => {act(() => root.unmount()); container.remove();});
async function mount(element: React.ReactNode) {
  await act(async () => {root.render(element); await new Promise(r => setTimeout(r, 20));});
}

it('a failed dashboard request stays unknown and offers retry', async () => {
  svc.getDashboard.mockRejectedValue(new Error('API unavailable'));
  await mount(<WarehouseDashboard />);
  expect(container.textContent).not.toContain(i18n.t('inventory:warehouse.allStockHealthy'));
  expect(container.querySelector('[role=alert]')?.textContent).toContain(i18n.t('inventory:warehouse.loadError'));
  expect(container.textContent).toContain(i18n.t('common:buttons.retry'));
  expect(container.textContent).not.toContain(i18n.t('inventory:warehouse.noRecentActivity'));
});

it.each([105, 250])('server dispatch total %i stays complete beyond the first page', async count => {
  svc.getAllDispatches.mockResolvedValue({content:[],page:0,size:8,totalPages:Math.ceil(count/8),totalElements:count});
  svc.getDispatchSummary.mockResolvedValue({totalDispatches:count,totalUnits:count*2,projectCount:7});
  svc.listConsumables.mockResolvedValue([]);
  svc.listWarehouseProjects.mockResolvedValue({content:[],totalPages:0,totalElements:0});
  await mount(<ConsumableDispatch />);
  expect(svc.getAllDispatches).toHaveBeenCalledWith({page:0,size:8});
  expect(svc.getDispatchSummary).toHaveBeenCalled();
  expect(container.textContent).toContain(String(count));
  const last = Array.from(container.querySelectorAll('button')).find(b=>b.textContent===String(Math.ceil(count/8)))!;
  await act(async () => {last.click();});
  expect(svc.getAllDispatches).toHaveBeenLastCalledWith({page:Math.ceil(count/8)-1,size:8});
});

it('real checkout has its own translated label rather than a return', async () => {
  svc.getActiveAssignments.mockResolvedValue([]);
  svc.getAssignmentLog.mockResolvedValue({content:[{id:1,date:'2026-10-26',toolCode:'AUD-01',toolName:'Taladro',action:'Acceptance Pending',worker:'Ana',project:'Obra',condition:'',notes:''}],page:0,size:8,totalElements:1,totalPages:1});
  svc.getAssignmentSummary.mockResolvedValue({activeAssignments:0,assignedToday:1,returnedToday:0});
  svc.listTools.mockResolvedValue({content:[]});
  await mount(<ToolAssignment />);
  const button = Array.from(container.querySelectorAll('button')).find(b=>b.textContent===i18n.t('inventory:assignment.assignmentLog'))!;
  expect(button).toBeTruthy();
  await act(async () => {button.click();});
  expect(container.textContent).toContain(i18n.t('tools:action.acceptancePending'));
  expect(Array.from(container.querySelectorAll('[data-testid=assignment-action]')).every(b => b.textContent === i18n.t('tools:action.acceptancePending'))).toBe(true);
  expect(container.textContent).not.toContain('Acceptance Pending');
});
