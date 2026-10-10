import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const svc=vi.hoisted(() => ({list:vi.fn(),revoke:vi.fn()}));
vi.mock('../../services/invitations',() => ({InvitationsService:svc}));
vi.mock('react-i18next',() => ({useTranslation:() => ({t:(key:string) => key,i18n:{language:'es'}})}));
import {InvitationsManager} from './InvitationsManager';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement,root:Root;
beforeEach(() => {vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));svc.list.mockReset();svc.revoke.mockReset().mockResolvedValue(undefined);host=document.createElement('div');document.body.append(host);root=createRoot(host);});afterEach(() => {act(() => root.unmount());host.remove();vi.useRealTimers();});
it('lists ADMIN invitations, offers only unexpired pending revoke and confirms before revoking',async () => {
 svc.list.mockResolvedValue([{id:7,role:'ADMIN',status:'PENDING',expiresAt:'2026-10-10T12:00:00Z'},{id:8,role:'WORKER',status:'PENDING',expiresAt:'2026-10-01T12:00:00Z'},{id:9,role:'SUPERVISOR',status:'REVOKED',expiresAt:'2026-10-10T12:00:00Z'}]);
 await act(async () => root.render(<InvitationsManager revision={0} />));host.querySelector('details')!.open=true;
 expect(host.textContent).toContain('common:roles.ADMIN');expect(host.querySelectorAll('li button')).toHaveLength(1);
 await act(async () => host.querySelector<HTMLButtonElement>('li button')!.click());expect(svc.revoke).not.toHaveBeenCalled();
 await act(async () => host.querySelector<HTMLButtonElement>('[role="dialog"] button:last-child')!.click());expect(svc.revoke).not.toHaveBeenCalled();expect(host.querySelector('[role="dialog"]')).toBeNull();
 await act(async () => host.querySelector<HTMLButtonElement>('li button')!.click());await act(async () => host.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click());
 expect(svc.revoke).toHaveBeenCalledExactlyOnceWith(7);expect(svc.list).toHaveBeenCalledTimes(2);expect(host.querySelector('[role="dialog"]')).toBeNull();
});
