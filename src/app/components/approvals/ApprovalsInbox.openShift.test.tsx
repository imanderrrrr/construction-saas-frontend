import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';

// ════════════════════════════════════════════════════════════════════════
// Bulk-approving with an OPEN shift in the selection (production defect).
//
// approveBulk() used to fire one approveRecord(id) per selected row through
// Promise.allSettled and DISCARD the rejections: an open shift (clock-in, no
// clock-out) was approved server-side, findActiveRecord stopped returning it,
// and the worker's clock-out hit NO_ACTIVE_SHIFT — the shift stranded at 0
// payable minutes, silently.
//
// The backend now refuses those with 409 SHIFT_STILL_OPEN. This test pins the
// frontend half: the bulk result must be REPORTED (how many approved, how many
// left pending and why), and the not-approved rows must stay selected so the
// admin sees exactly which ones the summary talks about.
// ════════════════════════════════════════════════════════════════════════

const mocks = vi.hoisted(() => ({
  getAllTimeRecords: vi.fn(),
  approveRecord: vi.fn(),
  toast: {
    success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(),
  },
}));

vi.mock('../../services/time', () => ({
  getAllTimeRecords: (...args: unknown[]) => mocks.getAllTimeRecords(...args),
  approveRecord: (...args: unknown[]) => mocks.approveRecord(...args),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), mocks.toast),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Render keys verbatim (with count) so assertions are locale-proof.
    t: (key: string, opts?: { count?: number }) =>
      opts && typeof opts.count === 'number' ? `${key}:${opts.count}` : key,
    i18n: { language: 'es' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// The drawer and the manual-day modal pull in half the app; neither is under
// test here.
vi.mock('./RecordDrawer', () => ({ RecordDrawer: () => null }));
vi.mock('../phase2/ModalCreateDay', () => ({ ModalCreateDay: () => null }));

import { ApprovalsInbox } from './ApprovalsInbox';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const todayIso = new Date().toISOString().slice(0, 10);

function ev(id: number, type: string, hourUtc: string) {
  return {
    id,
    type,
    capturedAtClient: `${todayIso}T${hourUtc}:00Z`,
    capturedAtServer: `${todayIso}T${hourUtc}:00Z`,
    lat: null, lng: null, locationStatus: null, distanceMeters: null,
    eventApprovalStatus: 'PENDING',
    eventReviewComment: null, eventReviewerUsername: null, eventReviewedAt: null,
    sourceProjectId: null, sourceProjectName: null,
    disputeStatus: null, disputeReason: null, awardedTransitMinutes: null,
    disputeResolvedBy: null, disputeResolvedAt: null,
    manualCreatorUsername: null,
  };
}

function record(id: number, worker: string, events: ReturnType<typeof ev>[]) {
  return {
    id,
    workerId: id * 10,
    workerUsername: worker,
    workerName: worker,
    projectId: 1,
    projectName: 'Obra 1',
    projectLatitude: null, projectLongitude: null, geofenceRadiusMeters: 100,
    workDate: todayIso,
    approvalStatus: 'PENDING',
    isLate: false,
    pendingEventCount: events.length,
    events,
    reviews: [],
    createdAt: `${todayIso}T08:00:00Z`,
    updatedAt: `${todayIso}T08:00:00Z`,
  };
}

// #1 CLOSED shift (in + out) — approvable. #2 OPEN shift (in only) — the
// backend refuses it with SHIFT_STILL_OPEN.
const closedShift = record(1, 'maria', [ev(11, 'CHECK_IN', '08:00'), ev(12, 'CHECK_OUT', '17:00')]);
const openShift = record(2, 'pedro', [ev(21, 'CHECK_IN', '08:05')]);

describe('ApprovalsInbox — bulk approve with an open shift selected', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllTimeRecords.mockResolvedValue([closedShift, openShift]);
    mocks.approveRecord.mockImplementation((id: number) =>
      id === openShift.id
        ? Promise.reject(new ApiError(409, 'Este turno todavía está abierto.', undefined, 'SHIFT_STILL_OPEN'))
        : Promise.resolve({ ...closedShift, approvalStatus: 'APPROVED' }));
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => { root = createRoot(container); });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderInbox(...expectedWorkers: string[]) {
    await act(async () => { root.render(<ApprovalsInbox mode="admin" />); });
    for (const w of expectedWorkers) expect(container.textContent).toContain(w);
  }

  /** The row checkbox is the first span child of each row (click target). */
  function rowCheckbox(workerName: string): HTMLElement {
    const rows = [...container.querySelectorAll('div')].filter(d =>
      d.textContent?.includes(workerName) && d.className.includes('cursor-pointer'));
    const row = rows[rows.length - 1];
    expect(row).toBeTruthy();
    return row!.querySelector('span')!;
  }

  async function selectBoth() {
    await act(async () => { rowCheckbox('maria').click(); });
    await act(async () => { rowCheckbox('pedro').click(); });
  }

  it('warns up front how many selected rows are open shifts', async () => {
    await renderInbox('maria', 'pedro');
    await selectBoth();
    const warning = container.querySelector('[data-testid="bulk-open-warning"]');
    expect(warning).toBeTruthy();
    expect(warning!.textContent).toContain('admin:apr.bulk.openWarning:1');
  });

  it('reports the bulk outcome — approved vs left-pending — instead of discarding rejections', async () => {
    await renderInbox('maria', 'pedro');
    await selectBoth();

    const bulkBtn = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('admin:apr.approveBulk'));
    expect(bulkBtn).toBeTruthy();
    await act(async () => { bulkBtn!.click(); });

    // Both were attempted (backend referees each one)…
    expect(mocks.approveRecord).toHaveBeenCalledTimes(2);
    expect(mocks.approveRecord).toHaveBeenCalledWith(closedShift.id);
    expect(mocks.approveRecord).toHaveBeenCalledWith(openShift.id);

    // …and the outcome is REPORTED: 1 approved · 1 open shift left pending.
    expect(mocks.toast.warning).toHaveBeenCalledTimes(1);
    const report = mocks.toast.warning.mock.calls[0][0] as string;
    expect(report).toContain('admin:apr.bulk.approved:1');
    expect(report).toContain('admin:apr.bulk.openSkipped:1');
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it('keeps the not-approved open shift selected so the admin sees which row stayed pending', async () => {
    await renderInbox('maria', 'pedro');
    await selectBoth();

    const bulkBtn = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('admin:apr.approveBulk'));
    await act(async () => { bulkBtn!.click(); });

    // The floating bar survives with exactly the open shift still selected.
    expect(container.textContent).toContain('admin:apr.selected');
    expect(container.textContent).toContain('admin:apr.approveBulk:1');
  });

  it('a fully clean bulk reports plain success', async () => {
    mocks.getAllTimeRecords.mockResolvedValue([closedShift]);
    await renderInbox('maria');
    await act(async () => { rowCheckbox('maria').click(); });

    const bulkBtn = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('admin:apr.approveBulk'));
    await act(async () => { bulkBtn!.click(); });

    expect(mocks.toast.success).toHaveBeenCalledWith('admin:apr.bulk.allApproved:1');
    expect(mocks.toast.warning).not.toHaveBeenCalled();
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it('a non-open-shift failure is reported as an error, not silence', async () => {
    mocks.approveRecord.mockImplementation((id: number) =>
      id === openShift.id
        ? Promise.reject(new ApiError(500, 'boom', undefined, 'INTERNAL_ERROR'))
        : Promise.resolve({ ...closedShift, approvalStatus: 'APPROVED' }));
    await renderInbox('maria', 'pedro');
    await selectBoth();

    const bulkBtn = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('admin:apr.approveBulk'));
    await act(async () => { bulkBtn!.click(); });

    expect(mocks.toast.error).toHaveBeenCalledTimes(1);
    const report = mocks.toast.error.mock.calls[0][0] as string;
    expect(report).toContain('admin:apr.bulk.approved:1');
    expect(report).toContain('admin:apr.bulk.failed:1');
  });
});
