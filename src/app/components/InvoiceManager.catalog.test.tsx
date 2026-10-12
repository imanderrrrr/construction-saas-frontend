// AUD-055 (FE-FIN-06) — the project filter of «Facturas» read one page of
// 100 projects, newest first, and took it for all of them: with 230 projects
// the oldest could not be filtered. Every project, closed ones included (they
// keep their history), must be offered.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => {
  const t = (key: string, opts?: Record<string, unknown>) =>
    opts && typeof opts === 'object' && !Array.isArray(opts)
      ? `${key}|${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')}`
      : key;
  const i18n = { language: 'es' };
  return {
    useTranslation: () => ({ t, i18n }),
    Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    initReactI18next: { type: '3rdParty', init: () => {} },
  };
});
vi.mock('../helpers/exportInvoicePdf', () => ({
  downloadInvoicePdf: vi.fn(),
  invoicePdfPreviewUrl: () => 'blob:preview',
}));
vi.mock('./invoices/InvoiceWindow', () => ({ InvoiceWindow: () => <div data-testid="invoice-window" /> }));
vi.mock('../services/invoiceBranding', () => ({ loadInvoiceIssuer: () => Promise.resolve(undefined) }));
vi.mock('../services/signatures', () => ({ loadSignatureForPdf: () => Promise.resolve(undefined) }));

const listReceivables = vi.fn();
vi.mock('../services/finance', () => ({ listReceivables: (...a: unknown[]) => listReceivables(...a) }));
const listProjects = vi.fn();
vi.mock('../services/projects', () => ({ listProjects: (...a: unknown[]) => listProjects(...a) }));

import { InvoiceManager } from './InvoiceManager';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const N = 230;
// Newest first, as the server orders them: the oldest (id 1) is the last row;
// a closed project still carries history.
const PROJECTS = [
  { id: 900, name: 'Obra cerrada', status: 'CLOSED' },
  ...Array.from({ length: N }, (_, i) => ({ id: N - i, name: `Obra ${String(N - i).padStart(3, '0')}`, status: 'ACTIVE' })),
];
function servePage(q: { page?: number; size?: number } = {}) {
  const size = Math.min(q.size ?? 20, 100);
  const page = q.page ?? 0;
  return { content: PROJECTS.slice(page * size, page * size + size), page, size, totalElements: PROJECTS.length, totalPages: Math.ceil(PROJECTS.length / size) };
}
const projectValues = (select: HTMLSelectElement | null | undefined) => Array.from(select?.options ?? []).map(o => o.value).filter(v => v && v !== 'all');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  listProjects.mockImplementation(async (q?: { page?: number; size?: number }) => servePage(q));
  listReceivables.mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it('offers the oldest project and the closed one in the filter of «Facturas»', async () => {
  await act(async () => { root.render(<InvoiceManager />); });
  for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  const values = projectValues(container.querySelector<HTMLSelectElement>('select[aria-label="finance:invoice.filter.project"]'));
  expect(values).toContain('1');
  expect(values).toContain('900');
  expect(values.length).toBe(N + 1);
});
