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
  click(submit()); await flush();
  expect(onDispatch.mock.calls[1][10]).toBe(key);
});
