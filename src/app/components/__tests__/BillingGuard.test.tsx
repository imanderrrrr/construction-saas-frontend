import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getAccess: vi.fn(), getRole: vi.fn() }));
vi.mock('../../services/billing', () => ({ BillingService: { getAccess: mocks.getAccess } }));
vi.mock('../../services/auth', () => ({ AuthService: { getRole: mocks.getRole } }));
vi.mock('react-router', () => ({ Link: ({ to, children }: {to: string; children: React.ReactNode}) => <a href={to}>{children}</a> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import { BillingGuard } from '../BillingGuard';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement, root: Root;
beforeEach(() => { mocks.getAccess.mockReset(); mocks.getRole.mockReturnValue('ADMIN'); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
async function render() { await act(async () => root.render(<BillingGuard><input defaultValue="unsaved form" /></BillingGuard>)); }
it.each(['ADMIN','SUPERVISOR','WORKER','FINANCE','WAREHOUSE','SUBCONTRACTOR'])('uses server FULL access for %s', async role => {
  mocks.getRole.mockReturnValue(role); mocks.getAccess.mockResolvedValue({ tier: 'FULL', enforced: false }); await render();
  expect(mocks.getAccess).toHaveBeenCalledTimes(1); expect(container.querySelector('input')?.value).toBe('unsaved form');
});
it('keeps the same form mounted during focus checks, read-only and network failure', async () => {
  mocks.getAccess.mockResolvedValue({ tier: 'FULL' }); await render(); const input = container.querySelector('input')!;
  input.value = 'draft survives'; mocks.getAccess.mockResolvedValue({tier:'READ_ONLY'});
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(container.querySelector('input')).toBe(input); expect(input.value).toBe('draft survives'); expect(container.textContent).toContain('billing.readOnly');
  mocks.getAccess.mockResolvedValue({tier:'BLOCKED'}); await act(async () => window.dispatchEvent(new Event('focus')));
  expect(container.querySelector('input')).toBe(input); expect(input.value).toBe('draft survives');
  mocks.getAccess.mockRejectedValue(new Error('offline')); await act(async () => window.dispatchEvent(new Event('focus')));
  expect(container.querySelector('input')).toBe(input); expect(container.textContent).toContain('billing.unavailable');
});
it('blocks only an authoritative BLOCKED answer and offers recovery to admin', async () => {
  mocks.getAccess.mockResolvedValue({tier:'BLOCKED'}); await render(); expect(container.querySelector('input')!.closest('[hidden]')).not.toBeNull(); expect(container.querySelector('a')?.href).toContain('/admin/billing');
});

it.each(['ADMIN','SUPERVISOR','WORKER','FINANCE','WAREHOUSE','SUBCONTRACTOR'])('retains content under authoritative READ_ONLY for %s',async role=>{
 mocks.getRole.mockReturnValue(role);mocks.getAccess.mockResolvedValue({tier:'READ_ONLY'});await render();
 expect(container.querySelector('input')!.closest('[hidden]')).toBeNull();expect(container.textContent).toContain('billing.readOnly');
 expect(container.querySelectorAll('a')).toHaveLength(role==='ADMIN'?1:0);
});
it.each(['SUPERVISOR','WORKER','FINANCE','WAREHOUSE','SUBCONTRACTOR'])('hides BLOCKED content without exposing ADMIN recovery to %s',async role=>{
 mocks.getRole.mockReturnValue(role);mocks.getAccess.mockResolvedValue({tier:'BLOCKED'});await render();
 expect(container.querySelector('input')!.closest('[hidden]')).not.toBeNull();expect(container.querySelector('a')).toBeNull();
});
it('keeps initial content mounted but hidden until the decision arrives',async()=>{
 let resolve!:(value:{tier:string})=>void;mocks.getAccess.mockReturnValue(new Promise(r=>{resolve=r;}));await render();
 const input=container.querySelector('input')!;expect(input.closest('[hidden]')).not.toBeNull();expect(container.textContent).toContain('labels.loading');
 await act(async()=>resolve({tier:'FULL'}));expect(container.querySelector('input')).toBe(input);expect(input.closest('[hidden]')).toBeNull();
});
it('initial network failure permits a retained form with a recovery notice',async()=>{
 mocks.getAccess.mockRejectedValue(new Error('offline'));await render();
 expect(container.querySelector('input')!.closest('[hidden]')).toBeNull();expect(container.textContent).toContain('billing.unavailable');
});
it('ignores a late decision after unmount without navigation or resurrecting a form',async()=>{
 let resolve!:(value:{tier:string})=>void;mocks.getAccess.mockReturnValue(new Promise(r=>{resolve=r;}));await render();
 await act(async()=>root.render(null));await act(async()=>resolve({tier:'BLOCKED'}));expect(container.textContent).toBe('');
});
