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
//
// Its sibling, the leg BEFORE the shift: while the worker is still on the road
// (their last punch of the day is an IN_TRANSIT), the backend refuses approve
// with 409 TRANSIT_IN_PROGRESS (backend PR #156), because a transit is paid up
// to the arrival check-in. That is a wait too, not an error, with its own words.
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
    disputeStatus: null as string | null, disputeReason: null, awardedTransitMinutes: null as number | null,
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
// #3 a transit STILL ON THE ROAD: an IN_TRANSIT with nothing after it — the
// backend refuses it with TRANSIT_IN_PROGRESS until the worker checks in.
const enRoute = record(3, 'juan', [ev(31, 'IN_TRANSIT', '12:10')]);
// #4 and #5 the backend would NOT hold: the transit already arrived (the
// check-in is in its record), or its dispute was resolved (the award pays with
// or without the arrival).
const arrived = record(4, 'rosa', [
  ev(41, 'IN_TRANSIT', '07:40'), ev(42, 'CHECK_IN', '08:05'), ev(43, 'CHECK_OUT', '17:00'),
]);
const resolvedDispute = record(5, 'luis', [
  { ...ev(51, 'IN_TRANSIT', '12:10'), disputeStatus: 'RESOLVED', awardedTransitMinutes: 20 },
]);

// The backend's own sentence (es) for TRANSIT_IN_PROGRESS.
const TRANSIT_SENTENCE = 'Este traslado sigue en curso: el trabajador todavía no ha registrado su '
  + 'entrada en la obra, y el traslado se paga hasta esa entrada. Podrá aprobarse o corregirse '
  + 'cuando llegue, o rechazarse ahora.';
const transitInProgress = () => new ApiError(409, TRANSIT_SENTENCE, undefined, 'TRANSIT_IN_PROGRESS');
const shiftStillOpen = () => new ApiError(409, 'Este turno todavía está abierto.', undefined, 'SHIFT_STILL_OPEN');

/** The backend refuses these ids with these errors and approves the rest. */
function approveRefusing(refusals: Record<number, Error>) {
  mocks.approveRecord.mockImplementation((id: number) =>
    refusals[id] ? Promise.reject(refusals[id]) : Promise.resolve({ id, approvalStatus: 'APPROVED' }));
}

describe('ApprovalsInbox — bulk approve with an open shift (or a transit on the road) selected', () => {
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

  describe('a transit still on the road (TRANSIT_IN_PROGRESS)', () => {
    beforeEach(() => {
      mocks.getAllTimeRecords.mockResolvedValue([closedShift, openShift, enRoute, arrived, resolvedDispute]);
      approveRefusing({ [openShift.id]: shiftStillOpen(), [enRoute.id]: transitInProgress() });
    });

    async function select(...workers: string[]) {
      for (const w of workers) await act(async () => { rowCheckbox(w).click(); });
    }

    async function approveSelected() {
      const bulkBtn = [...container.querySelectorAll('button')]
        .find(b => b.textContent?.includes('admin:apr.approveBulk'));
      expect(bulkBtn).toBeTruthy();
      await act(async () => { bulkBtn!.click(); });
    }

    /** A selected row's checkbox is filled with ink. */
    const isSelected = (worker: string) => rowCheckbox(worker).className.includes('bg-[#0A0A0A]');

    it('reports it as left pending with its own reason and hint: a warning, not an error', async () => {
      await renderInbox('maria', 'juan');
      await select('maria', 'juan');
      await approveSelected();

      expect(mocks.approveRecord).toHaveBeenCalledWith(closedShift.id);
      expect(mocks.approveRecord).toHaveBeenCalledWith(enRoute.id);
      expect(mocks.toast.warning).toHaveBeenCalledTimes(1);
      const report = mocks.toast.warning.mock.calls[0][0] as string;
      expect(report).toContain('admin:apr.bulk.approved:1');
      expect(report).toContain('admin:apr.bulk.transitSkipped:1');
      expect(report).toContain('admin:apr.bulk.transitHint');
      // Neither an error nor an open shift: "turno abierto (sin salida)" would be false.
      expect(report).not.toContain('admin:apr.bulk.failed');
      expect(report).not.toContain('admin:apr.bulk.openSkipped');
      expect(report).not.toContain('admin:apr.bulk.openHint');
      expect(mocks.toast.error).not.toHaveBeenCalled();
      expect(mocks.toast.success).not.toHaveBeenCalled();
    });

    it('keeps exactly the transit selected, so the admin sees which row is waiting', async () => {
      await renderInbox('maria', 'juan');
      await select('maria', 'juan');
      await approveSelected();

      expect(container.textContent).toContain('admin:apr.approveBulk:1');
      expect(isSelected('juan')).toBe(true);
      expect(isSelected('maria')).toBe(false);
    });

    it('next to an open shift: both left pending, each in its own words, still a warning', async () => {
      await renderInbox('maria', 'pedro', 'juan');
      await select('maria', 'pedro', 'juan');
      await approveSelected();

      expect(mocks.toast.warning).toHaveBeenCalledTimes(1);
      const report = mocks.toast.warning.mock.calls[0][0] as string;
      expect(report).toContain('admin:apr.bulk.approved:1');
      expect(report).toContain('admin:apr.bulk.openSkipped:1');
      expect(report).toContain('admin:apr.bulk.transitSkipped:1');
      expect(report).toContain('admin:apr.bulk.openHint');
      expect(report).toContain('admin:apr.bulk.transitHint');
      expect(mocks.toast.error).not.toHaveBeenCalled();
      expect(isSelected('pedro')).toBe(true);
      expect(isSelected('juan')).toBe(true);
      expect(isSelected('maria')).toBe(false);
    });

    it('next to a real failure it still counts as pending, not as one more error', async () => {
      approveRefusing({
        [openShift.id]: new ApiError(500, 'boom', undefined, 'INTERNAL_ERROR'),
        [enRoute.id]: transitInProgress(),
      });
      await renderInbox('maria', 'pedro', 'juan');
      await select('maria', 'pedro', 'juan');
      await approveSelected();

      expect(mocks.toast.error).toHaveBeenCalledTimes(1);
      const report = mocks.toast.error.mock.calls[0][0] as string;
      expect(report).toContain('admin:apr.bulk.approved:1');
      expect(report).toContain('admin:apr.bulk.transitSkipped:1');
      expect(report).toContain('admin:apr.bulk.failed:1');
      expect(mocks.toast.warning).not.toHaveBeenCalled();
    });

    it('warns up front that a transit with no arrival MAY stay pending', async () => {
      await renderInbox('maria', 'juan');
      await select('maria', 'juan');

      const warning = container.querySelector('[data-testid="bulk-transit-warning"]');
      expect(warning).toBeTruthy();
      expect(warning!.textContent).toContain('admin:apr.bulk.transitWarning:1');
      expect(container.querySelector('[data-testid="bulk-open-warning"]')).toBeNull();
    });

    it('does not warn for a transit that already arrived, nor for one whose dispute was resolved', async () => {
      await renderInbox('rosa', 'luis');
      await select('rosa', 'luis');

      expect(container.textContent).toContain('admin:apr.approveBulk:2');
      expect(container.querySelector('[data-testid="bulk-transit-warning"]')).toBeNull();
    });

    it.each(['the row button', 'the A key'])('approving it alone with %s toasts the sentence the backend wrote', async via => {
      mocks.getAllTimeRecords.mockResolvedValue([enRoute]);
      await renderInbox('juan');
      await act(async () => {
        if (via === 'the A key') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        else [...container.querySelectorAll('button')].find(b => b.textContent === 'admin:apr.approve')!.click();
      });

      expect(mocks.approveRecord).toHaveBeenCalledWith(enRoute.id);
      expect(mocks.toast.error).toHaveBeenCalledWith(TRANSIT_SENTENCE);
      expect(mocks.toast.warning).not.toHaveBeenCalled();
    });
  });
});
