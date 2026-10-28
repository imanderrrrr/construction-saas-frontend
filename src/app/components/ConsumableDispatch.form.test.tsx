import '../lib/warehouseIntent.testing';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest';
vi.mock('./ui/select', () => ({
  Select: ({value, onValueChange, children}: {value: string; onValueChange: (v: string) => void; children: React.ReactNode}) => <select value={value} onChange={e=>onValueChange(e.target.value)}><option value="" />{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({children}: {children: React.ReactNode}) => <>{children}</>,
  SelectItem: ({value, children}: {value: string; children: React.ReactNode}) => <option value={value}>{children}</option>,
}));
vi.mock('./ui/dialog', () => {
  const Wrapper = ({children}: {children: React.ReactNode}) => <div>{children}</div>;
  return {Dialog: Wrapper, DialogContent: Wrapper, DialogHeader: Wrapper, DialogTitle: Wrapper, DialogDescription: Wrapper, DialogFooter: Wrapper};
});
vi.mock('./budgets/wbs/BudgetLineItemSelector', () => ({BudgetLineItemSelector: () => null}));
import i18n from '../../i18n';
import { ApiError, clearSessionCookie } from '../lib/api';
import { beginWarehouseSession } from '../lib/warehouseSession';
import { DispatchModal } from './ConsumableDispatch';
import { buttonByText, click, consumable, flush, select, type } from './tools/testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
let onDispatch: Mock<React.ComponentProps<typeof DispatchModal>['onDispatch']>;
beforeEach(async () => {
  await i18n.changeLanguage('es');
  host=document.createElement('div'); document.body.appendChild(host); root=createRoot(host);
  onDispatch=vi.fn().mockResolvedValue(undefined);
  await act(async () => root.render(<DispatchModal open onClose={vi.fn()} onDispatch={onDispatch}
    consumables={[consumable({id:1, code:'CS', name:'Cemento', currentStock:10})]}
    projects={{items:[{id:7,name:'Obra',status:'ACTIVE'}],total:1,truncated:false}}
    workers={[{id:2,username:'ana',fullName:'Ana',role:'WORKER',status:'ACTIVE',updatedAt:''}]} />));
  const fields=host.querySelectorAll('select');
  select(fields[0], '1'); select(fields[1], '7'); select(fields[2], '2');
  type(host.querySelector('input[type=number]')!, '2');
});
afterEach(()=>{act(()=>root.unmount());host.remove();});
const submit=()=>buttonByText(host,i18n.t('inventory:dispatch.dialog.submit'))!;
it('rejects fractions and notes beyond 50 while allowing the exact boundary', () => {
  type(host.querySelector('input[type=number]')!, '1.9');
  expect(submit().disabled).toBe(true);
  type(host.querySelector('input[type=number]')!, '2');
  const notes=host.querySelector('textarea')!;
  expect(notes.maxLength).toBe(50);
  type(notes, 'a'.repeat(50)); expect(submit().disabled).toBe(false);
  type(notes, 'a'.repeat(51)); expect(submit().disabled).toBe(true);
});
it('preserves the form and intention after a lost response and prevents duplicate submits while pending', async () => {
  type(host.querySelector('textarea')!, 'Conservar nota');
  let reject!: (e: Error)=>void;
  onDispatch.mockImplementationOnce(()=>new Promise((_,r)=>{reject=r;}));
  click(submit()); await flush();
  expect(submit().disabled).toBe(true);
  await act(async ()=>reject(new Error('Respuesta perdida')));
  expect(host.querySelector('textarea')?.value).toBe('Conservar nota');
  expect(host.querySelector('input')?.value).toBe('2');
  expect(host.querySelector('[role=alert]')?.textContent).toBe('Respuesta perdida');
  const key=onDispatch.mock.calls[0][10];
  click(buttonByText(host,i18n.t('inventory:consumables.intent.reconcile'))!); await flush();
  expect(onDispatch.mock.calls[1][10]).toBe(key);
});

it('recovers the exact dispatch after unmount and allows a separate later dispatch with equal quantities', async () => {
  onDispatch.mockRejectedValueOnce(new Error('lost after commit'));
  type(host.querySelector('textarea')!, 'Entrega física');
  click(submit()); await flush();
  const original = onDispatch.mock.calls[0];
  act(() => root.unmount()); root = createRoot(host);
  await act(async () => root.render(<DispatchModal open onClose={vi.fn()} onDispatch={onDispatch}
    consumables={[consumable({id:1, code:'CS', name:'Cemento', currentStock:8})]}
    projects={{items:[{id:7,name:'Obra',status:'ACTIVE'}],total:1,truncated:false}}
    workers={[{id:2,username:'ana',fullName:'Ana',role:'WORKER',status:'ACTIVE',updatedAt:''}]} />));
  expect(host.querySelector('input')?.value).toBe('2');
  expect(host.querySelector('textarea')?.value).toBe('Entrega física');
  click(buttonByText(host,i18n.t('inventory:consumables.intent.reconcile'))!); await flush();
  expect(onDispatch.mock.calls[1]).toEqual(original);
  click(buttonByText(host,i18n.t('inventory:consumables.intent.newDispatch'))!); await flush();
  type(host.querySelector('input')!, '2'); click(submit()); await flush();
  expect(onDispatch.mock.calls[2][10]).not.toBe(original[10]);
  expect(onDispatch.mock.calls[2].slice(0,10)).toEqual(original.slice(0,10));
});

const remount = async () => {
  act(() => root.unmount()); root = createRoot(host);
  await act(async () => root.render(<DispatchModal open onClose={vi.fn()} onDispatch={onDispatch}
    consumables={[consumable({id:1, code:'CS', name:'Cemento', currentStock:10})]}
    projects={{items:[{id:7,name:'Obra',status:'ACTIVE'}],total:1,truncated:false}}
    workers={[{id:2,username:'ana',fullName:'Ana',role:'WORKER',status:'ACTIVE',updatedAt:''}]} />));
};

// B1 (audit 2026-10-28): after a logout the dialog came back blank and the same
// delivery was recorded twice, charging the project twice.
it('shows the unresolved dispatch again after logout and a new login of the same account', async () => {
  onDispatch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  click(submit()); await flush();
  const original = onDispatch.mock.calls[0];
  clearSessionCookie();
  document.cookie = `ofjr_session=${encodeURIComponent(JSON.stringify({ role: 'WAREHOUSE', username: 'keeper' }))}; Path=/`;
  beginWarehouseSession('test-a', 'keeper');
  await remount();
  expect(host.textContent).toContain(original[10]);
  expect(buttonByText(host, i18n.t('inventory:dispatch.dialog.submit'))).toBeFalsy();
  click(buttonByText(host,i18n.t('inventory:consumables.intent.reconcile'))!); await flush();
  expect(onDispatch).toHaveBeenCalledTimes(2);
  expect(onDispatch.mock.calls[1]).toEqual(original);
});

// B2 (audit 2026-10-28): a retry refused for lack of stock left the dialog
// locked on "pending" for every supply until the user logged out.
it('frees the dialog when the retry of an unknown dispatch is refused for lack of stock', async () => {
  onDispatch
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockRejectedValueOnce(new ApiError(409, 'No hay existencias suficientes para este movimiento.', undefined, 'INSUFFICIENT_STOCK'));
  click(submit()); await flush();
  click(buttonByText(host,i18n.t('inventory:consumables.intent.reconcile'))!); await flush();
  expect(host.textContent).toContain(i18n.t('inventory:consumables.intent.refused'));
  click(buttonByText(host,i18n.t('inventory:consumables.intent.newDispatch'))!); await flush();
  type(host.querySelector('input[type=number]')!, '1'); click(submit()); await flush();
  expect(onDispatch).toHaveBeenCalledTimes(3);
  expect(onDispatch.mock.calls[2][3]).toBe(1);
  expect(onDispatch.mock.calls[2][10]).not.toBe(onDispatch.mock.calls[0][10]);
});
