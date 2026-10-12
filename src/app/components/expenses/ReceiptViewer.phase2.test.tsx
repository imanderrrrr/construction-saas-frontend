import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ blob: vi.fn() }));
vi.mock('../../lib/api', () => ({ apiBlob: mocks.blob }));
vi.mock('../bt/windows', () => ({ BtModal: ({children}: {children: React.ReactNode}) => <div>{children}</div> }));
vi.mock('react-i18next', () => ({useTranslation: () => ({ t: (key:string) => key }), initReactI18next: { type:'3rdParty', init: () => {} } }));
import { ReceiptViewer } from './ReceiptViewer';
import type { ExpenseResponse } from '../../services/expenses';
const expense = {receiptUrl:'/receipt/current',receiptRevisions:['/receipt/previous'],workerUsername:'worker',amountCents:2500,expenseType:'MATERIALS'} as ExpenseResponse;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root:Root, container:HTMLDivElement;
beforeEach(() => { mocks.blob.mockReset(); vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:receipt'); vi.spyOn(URL,'revokeObjectURL').mockImplementation(() => {}); container=document.createElement('div');document.body.append(container);root=createRoot(container); });
afterEach(() => {act(() => root.unmount());container.remove();vi.restoreAllMocks();});
async function render(type:string) { mocks.blob.mockResolvedValue(new Blob(['bytes'],{type})); await act(async () => root.render(<ReceiptViewer expense={expense} onClose={() => {}} />)); }
it('shows PDFs in a PDF frame with download and fetches authorized previous revisions', async () => {
 await render('application/pdf'); expect(container.querySelector('iframe')?.getAttribute('src')).toBe('blob:receipt');expect(container.querySelector('img')).toBeNull();expect(container.querySelector('a[download]')).not.toBeNull();
 const select=container.querySelector('select')!; await act(async () => { select.value='0';select.dispatchEvent(new Event('change',{bubbles:true})); });
 expect(mocks.blob).toHaveBeenLastCalledWith('/receipt/previous');expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:receipt');
});
it('explains unsupported HEIC and offers the original file', async () => { await render('image/heic');expect(container.querySelector('img')).toBeNull();expect(container.textContent).toContain('expenses.receipt.unsupported');expect(container.querySelector('a[download]')).not.toBeNull(); });
it('replaces a corrupt image with an explanation and keeps its download', async () => { await render('image/png');await act(async () => container.querySelector('img')!.dispatchEvent(new Event('error')));expect(container.querySelector('img')).toBeNull();expect(container.textContent).toContain('expenses.receipt.unsupported');expect(container.querySelector('a[download]')).not.toBeNull(); });
