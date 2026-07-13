// BuildTrack — "Paid this month" KPI card in Accounts Payable.
//
// The card shipped with the design mock's subtitle hardcoded to "Feb 2026",
// so on 2026-07-12 it still read "Feb 2026". These tests pin the subtitle to
// the current business month (via currentMonthLabel) and lock the aggregation
// invariant: the amount sums only CURRENT-MONTH payments that are NOT voided
// (the backend's paidCents likewise excludes voided payments).

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payable, PayablePayment } from '../services/finance';

const mocks = vi.hoisted(() => ({
  listPayables: vi.fn(),
}));

// Stable t/i18n references — AccountsPayable's fetchBills is a useCallback
// keyed on [t]; a fresh t per render would re-fetch in an endless loop.
vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  const i18n = { language: 'en-US' };
  return { useTranslation: () => ({ t, i18n }) };
});

vi.mock('../services/finance', () => ({
  listPayables: mocks.listPayables,
  listPayableVendors: vi.fn(() => Promise.resolve([])),
  createPayable: vi.fn(),
  recordPayablePayment: vi.fn(),
  updatePayableAmount: vi.fn(),
  markPayableUnpaid: vi.fn(),
  voidPayablePayment: vi.fn(),
  convertPayableToInvoice: vi.fn(),
  updatePayableDates: vi.fn(),
  updatePayableInfo: vi.fn(),
  deletePayable: vi.fn(),
  reassignPayableProject: vi.fn(),
  getPayable: vi.fn(),
}));
vi.mock('../services/projects', () => ({
  listProjects: vi.fn(() => Promise.resolve({ content: [] })),
}));
vi.mock('../services/auth', () => ({
  AuthService: { getCanonicalRole: () => 'ADMIN' },
}));
// The real module pulls in src/i18n (full i18next init) via api.ts.
vi.mock('../lib/api', () => ({
  ApiError: class ApiError extends Error {
    code?: string;
  },
}));
// Freeze the accounting month the component sees; the real formatting lives
// in helpers/dateTime.test.ts.
vi.mock('../helpers/dateTime', () => ({
  businessToday: () => '2026-07-12',
  currentMonth: () => '2026-07',
  currentMonthLabel: (locale?: string) => (locale === 'es' ? 'jul 2026' : 'Jul 2026'),
  fmtDate: (iso: string) => iso,
  daysOverdue: () => 0,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

// Heavy / portal-backed UI — stub so the test renders the component's own
// markup under jsdom. StatCard stays REAL: the subtitle under test renders
// through it.
vi.mock('./PayableDetailModal', () => ({ PayableDetailModal: () => null }));
vi.mock('./EmptyState', () => ({ EmptyState: () => null }));
vi.mock('./ui/skeleton', () => ({ Skeleton: () => null }));
vi.mock('./ui/button', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));
vi.mock('./ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));
vi.mock('./ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: React.ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { AccountsPayable } from './AccountsPayable';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── Fixtures ────────────────────────────────────────────────────────────────

function mkPayment(p: Partial<PayablePayment> & Pick<PayablePayment, 'id' | 'date' | 'amount'>): PayablePayment {
  return { method: 'Bank transfer', ...p };
}

function mkPayable(p: Partial<Payable> & Pick<Payable, 'id' | 'billNumber' | 'amount' | 'paidAmount' | 'payments'>): Payable {
  return {
    vendor: 'ACME Corp',
    category: 'materials',
    project: 'Site A',
    projectId: 1,
    description: null,
    documentType: 'BILL',
    invoiceNumber: null,
    receivedDate: '2026-06-20',
    dueDate: '2026-08-20',
    status: 'partial',
    notes: null,
    createdAt: '2026-06-20T10:00:00Z',
    updatedAt: '2026-07-09T10:00:00Z',
    ...p,
  };
}

// June + July payments on the same bill, plus a voided July payment on a
// second bill. Correct "paid this month" (July, business TZ) = 3,000 + 2,000.
const BILLS: Payable[] = [
  mkPayable({
    id: 1, billNumber: 'BILL-001', amount: 200_000, paidAmount: 103_000,
    payments: [
      mkPayment({ id: 11, date: '2026-06-25', amount: 100_000 }),
      mkPayment({ id: 12, date: '2026-07-03', amount: 3_000 }),
    ],
  }),
  mkPayable({
    id: 2, billNumber: 'BILL-002', amount: 70_000, paidAmount: 2_000,
    payments: [
      mkPayment({ id: 21, date: '2026-07-09', amount: 2_000 }),
      mkPayment({ id: 22, date: '2026-07-05', amount: 50_000, voided: true }),
    ],
  }),
];

async function renderPayables(root: Root) {
  await act(async () => {
    root.render(<AccountsPayable />);
  });
  // Drain the listPayables promise + the state update out of loading.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('AccountsPayable — "Paid this month" KPI card', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.listPayables.mockReset();
    mocks.listPayables.mockResolvedValue({ content: BILLS });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('subtitles the card with the current business month, not the mock\'s "Feb 2026"', async () => {
    await renderPayables(root);
    const text = container.textContent ?? '';

    expect(text).toContain('Jul 2026');
    expect(text).not.toContain('Feb 2026');
  });

  it('sums only current-month payments that are not voided', async () => {
    await renderPayables(root);
    const text = container.textContent ?? '';

    expect(text).toContain('$5,000.00');        // 3,000 (Jul 3) + 2,000 (Jul 9)
    expect(text).not.toContain('$105,000.00');  // would include the June payment
    expect(text).not.toContain('$55,000.00');   // would include the voided July payment
  });
});
