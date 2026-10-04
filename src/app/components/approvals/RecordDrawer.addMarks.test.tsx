import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManualMarkInput } from '../../services/time';

// ════════════════════════════════════════════════════════════════════════
// «Agregar marcas faltantes» in the approvals drawer.
//
// ADMIN and FINANCE complete a day the worker could not punch in full. The
// button only appears where the backend would accept the marks (not for a
// supervisor, not on a day a reviewer rejected, not with a transit dispute
// still open), the drawer stays open and re-reads the day once they land, and
// Escape belongs to the window while it is open.
// ════════════════════════════════════════════════════════════════════════

const mocks = vi.hoisted(() => ({
  getTimeRecord: vi.fn(),
  addManualMarks: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('../../services/time', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/time')>()),
  getTimeRecord: (...args: unknown[]) => mocks.getTimeRecord(...args),
  addManualMarks: (...args: unknown[]) => mocks.addManualMarks(...args),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), mocks.toast) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// The window has its own suite. Like the real one, it closes itself once
// onSubmit resolves and stays open (keeping the error) when it rejects.
const MARK: ManualMarkInput = { type: 'CHECK_OUT', capturedAt: '2026-09-24T23:00:00.000Z' };
vi.mock('../phase2/ModalAddMark', () => ({
  ModalAddMark: (p: { missingTypes: string[]; onClose: () => void; onSubmit: (m: ManualMarkInput[]) => Promise<void> }) => (
    <div data-testid="add-mark-window" data-missing={p.missingTypes.join(',')}>
      <button onClick={() => { p.onSubmit([MARK]).then(p.onClose, () => {}); }}>stub-submit</button>
      <button onClick={p.onClose}>stub-close</button>
    </div>
  ),
}));

import { RecordDrawer } from './RecordDrawer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function ev(id: number, type: string, at: string, over: Record<string, unknown> = {}) {
  return {
    id, type, capturedAtClient: at, capturedAtServer: at,
    lat: null, lng: null, locationStatus: null, distanceMeters: null,
    eventApprovalStatus: 'PENDING', eventReviewComment: null, eventReviewerUsername: null, eventReviewedAt: null,
    sourceProjectId: null, sourceProjectName: null,
    disputeStatus: null, disputeReason: null, awardedTransitMinutes: null,
    disputeResolvedBy: null, disputeResolvedAt: null, manualCreatorUsername: null,
    ...over,
  };
}

/** A supervisor's day with the check-in only: lunch and check-out are missing. */
function day(over: Record<string, unknown> = {}) {
  return {
    id: 701, workerId: 31, workerUsername: 'sofia', workerName: 'Sofía Supervisora',
    projectId: 1, projectName: 'Obra 1', projectLatitude: null, projectLongitude: null, geofenceRadiusMeters: 100,
    workDate: '2026-09-24', approvalStatus: 'PENDING', isLate: false, pendingEventCount: 1,
    events: [ev(71, 'CHECK_IN', '2026-09-24T13:00:00Z')],
    reviews: [], createdAt: '2026-09-24T13:00:01Z', updatedAt: '2026-09-24T13:00:01Z',
    ...over,
  };
}

describe('RecordDrawer — «Agregar marcas faltantes»', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();
  const onChanged = vi.fn();
  const onUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTimeRecord.mockResolvedValue(day());
    mocks.addManualMarks.mockResolvedValue(day());
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => { root = createRoot(container); });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function open(mode?: 'admin' | 'finance' | 'supervisor') {
    await act(async () => {
      root.render(<RecordDrawer recordId={701} mode={mode} onClose={onClose} onChanged={onChanged} onUpdated={onUpdated} />);
    });
  }
  const addButton = () => container.querySelector<HTMLButtonElement>('[data-testid="add-marks-button"]');
  const windowEl = () => container.querySelector('[data-testid="add-mark-window"]');
  const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent === text);
  const escape = (handled = false) => act(async () => {
    const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    if (handled) e.preventDefault();
    window.dispatchEvent(e);
  });

  it.each(['admin', 'finance'] as const)('on the %s panel, adds the missing marks and stays on the day', async mode => {
    await open(mode);
    expect(addButton()?.textContent).toContain('time:manualMarks.addTitle');

    await act(async () => { addButton()!.click(); });
    expect(windowEl()?.getAttribute('data-missing')).toBe('LUNCH_START,LUNCH_END,CHECK_OUT');

    mocks.getTimeRecord.mockResolvedValue(day({ events: [ev(71, 'CHECK_IN', '2026-09-24T13:00:00Z'), ev(72, 'CHECK_OUT', MARK.capturedAt)] }));
    await act(async () => { button('stub-submit')!.click(); });

    expect(mocks.addManualMarks).toHaveBeenCalledWith(701, [MARK]);
    expect(mocks.toast.success).toHaveBeenCalledWith('admin:approvals.marksAdded');
    // The day is read again and the list behind catches up; nothing closes.
    expect(mocks.getTimeRecord).toHaveBeenCalledTimes(2);
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onChanged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(windowEl()).toBeNull();
    expect(container.textContent).toContain('admin:apr.ev.CHECK_OUT');
    // Lunch is still missing, so the button stays.
    expect(addButton()).not.toBeNull();
  });

  it('keeps the window open, and the drawer as it was, when the marks are refused', async () => {
    mocks.addManualMarks.mockRejectedValue(new Error('El registro ya tiene una marca de CHECK_OUT.'));
    await open('finance');
    await act(async () => { addButton()!.click(); });
    await act(async () => { button('stub-submit')!.click(); });
    expect(windowEl()).not.toBeNull();
    expect(mocks.getTimeRecord).toHaveBeenCalledTimes(1);
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('is not offered to a supervisor', async () => {
    await open('supervisor');
    expect(container.textContent).toContain('admin:apr.d.timeline');
    expect(addButton()).toBeNull();
  });

  it('is not offered on a day a reviewer rejected', async () => {
    mocks.getTimeRecord.mockResolvedValue(day({ approvalStatus: 'REJECTED' }));
    await open('admin');
    expect(container.textContent).toContain('admin:apr.d.timeline');
    expect(addButton()).toBeNull();
  });

  it('waits for a pending transit dispute, and comes back once it is resolved', async () => {
    const transit = (disputeStatus: string) => day({
      events: [ev(70, 'IN_TRANSIT', '2026-09-24T12:30:00Z', { disputeStatus }), ev(71, 'CHECK_IN', '2026-09-24T13:00:00Z')],
    });
    mocks.getTimeRecord.mockResolvedValue(transit('PENDING'));
    await open('finance');
    expect(container.textContent).toContain('admin:apr.d.dispute');
    expect(addButton()).toBeNull();

    act(() => root.unmount());
    act(() => { root = createRoot(container); });
    mocks.getTimeRecord.mockResolvedValue(transit('RESOLVED'));
    await open('finance');
    expect(addButton()).not.toBeNull();
  });

  it('is not offered on a complete day', async () => {
    mocks.getTimeRecord.mockResolvedValue(day({
      events: [
        ev(71, 'CHECK_IN', '2026-09-24T13:00:00Z'), ev(72, 'LUNCH_START', '2026-09-24T17:00:00Z'),
        ev(73, 'LUNCH_END', '2026-09-24T18:00:00Z'), ev(74, 'CHECK_OUT', '2026-09-24T22:00:00Z'),
      ],
    }));
    await open('admin');
    expect(container.textContent).toContain('admin:apr.d.timeline');
    expect(addButton()).toBeNull();
  });

  it('leaves Escape to the window while it is open', async () => {
    await open('finance');
    await act(async () => { addButton()!.click(); });
    await escape();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => { button('stub-close')!.click(); });
    // A key another layer already handled is not the drawer's either.
    await escape(true);
    expect(onClose).not.toHaveBeenCalled();
    await escape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says so when the day does not load, and retries', async () => {
    mocks.getTimeRecord.mockRejectedValueOnce(new Error('boom'));
    await open('finance');
    expect(container.querySelector('[data-testid="record-load-failed"]')?.textContent).toContain('admin:apr.d.loadError');

    await act(async () => { button('common:buttons.retry')!.click(); });
    expect(container.querySelector('[data-testid="record-load-failed"]')).toBeNull();
    expect(container.textContent).toContain('Sofía Supervisora');
  });
});
