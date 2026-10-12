import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const svc = vi.hoisted(() => ({ listInvoices: vi.fn() }));
vi.mock('../../services/subcontractors', async original => ({ ...(await original<typeof import('../../services/subcontractors')>()), listInvoices: svc.listInvoices }));
vi.mock('./JobNotes', () => ({ JobNotes: () => null }));
vi.mock('./JobEvidence', () => ({ JobEvidence: () => null }));
vi.mock('./JobTimeline', () => ({ JobTimeline: () => null }));
vi.mock('../../lib/tourScope', () => ({ useTourScopeWhileMounted: () => {} }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: {language: 'en'} }), initReactI18next: { type: '3rdParty', init: () => {} } }));
import { JobFicha } from './JobFicha';
import { invoice, job, page } from './testing';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement, root: Root;
beforeEach(() => { svc.listInvoices.mockReset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
async function render(revision = 0) { await act(async () => root.render(<JobFicha job={job({id:418,title:'Job'})} invoiceRevision={revision} onBack={() => {}} onChangeStatus={() => {}} onJobChanged={() => {}} onOpenInvoice={() => {}} />)); }
const money = () => container.querySelector('[data-tour="sec.subcontractors-ficha.money"]')!.textContent;
it('counts partial payments, loads every page, excludes other jobs and refreshes after payment', async () => {
 svc.listInvoices.mockImplementation(({page: p}: {page:number}) => Promise.resolve(p === 0
  ? page([invoice({id:1,amountCents:1_000_000,status:'APPROVED',paidAmountCents:400_000,outstandingCents:600_000})],101,100,0)
  : page([invoice({id:2,amountCents:100_000,status:'PAID',paidAmountCents:100_000,outstandingCents:0}),invoice({id:3,jobId:999,amountCents:9_000_000,status:'PAID'})],101,100,1)));
 await render();
 expect(svc.listInvoices).toHaveBeenNthCalledWith(2,expect.objectContaining({page:1}));
 expect(money()).toContain('$5,000'); expect(money()).toContain('$6,000'); expect(money()).toContain('$11,000'); expect(money()).not.toContain('$90,000');
 svc.listInvoices.mockResolvedValue(page([invoice({id:1,amountCents:1_000_000,status:'PAID',paidAmountCents:1_000_000,outstandingCents:0})]));
 await render(1); expect(money()).toContain('$10,000'); expect(money()).toContain('$0'); expect(money()).not.toContain('$6,000');
});
it('shows an error instead of stale financial totals when refreshing fails', async () => {
 svc.listInvoices.mockResolvedValue(page([invoice({id:1,status:'PAID',paidAmountCents:840_000})])); await render(); expect(money()).toContain('$8,400');
 svc.listInvoices.mockRejectedValue(new Error('offline')); await render(1);
 expect(container.querySelector('[role="alert"]')).not.toBeNull(); expect(container.querySelector('[data-tour="sec.subcontractors-ficha.money"]')!.children[2].textContent).not.toContain('$8,400');
});
