import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('react-i18next',() => ({useTranslation:() => ({t:(key:string) => key})}));
vi.mock('../bt/windows',() => ({BtModal:({children,footer}: {children:React.ReactNode;footer:React.ReactNode}) => <div role="dialog">{children}{footer}</div>}));
import {VoidPaymentDialog} from './VoidPaymentDialog';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement,root:Root;
beforeEach(() => {host=document.createElement('div');document.body.append(host);root=createRoot(host);});afterEach(() => {act(() => root.unmount());host.remove();});
it('requires the confirmation click, retains the reason on failure and closes only after success',async () => {
 const confirm=vi.fn().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValue(undefined),close=vi.fn();
 await act(async () => root.render(<VoidPaymentDialog onConfirm={confirm} onClose={close} />));
 expect(confirm).not.toHaveBeenCalled();expect(host.textContent).toContain('finance:void.explanation');
 const textarea=host.querySelector('textarea')!;await act(async () => {Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'  Duplicate entry  ');textarea.dispatchEvent(new Event('input',{bubbles:true}));});
 const button=[...host.querySelectorAll('button')].find(b => b.textContent==='finance:void.confirm')!;
 await act(async () => button.click());expect(confirm).toHaveBeenCalledWith('Duplicate entry');expect(close).not.toHaveBeenCalled();expect(host.querySelector('[role="alert"]')?.textContent).toBe('connection lost');expect(textarea.value).toBe('  Duplicate entry  ');
 await act(async () => button.click());expect(confirm).toHaveBeenCalledTimes(2);expect(close).toHaveBeenCalledTimes(1);
});
it('cancel closes without calling the mutation',async () => {const confirm=vi.fn(),close=vi.fn();await act(async () => root.render(<VoidPaymentDialog onConfirm={confirm} onClose={close} />));await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent==='common:buttons.cancel')!.click());expect(confirm).not.toHaveBeenCalled();expect(close).toHaveBeenCalledTimes(1);});
