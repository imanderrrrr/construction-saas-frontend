import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManualMarkInput } from '../../services/time';

// ════════════════════════════════════════════════════════════════════════
// The approvals drawer, when the day does not load and when marks are added.
//
// A day that fails to load says so, with «Reintentar», instead of spinning
// for ever. «Agregar marcas faltantes» keeps the drawer on the day: it is
// read again once the marks land and the list behind catches up. And while
// the marks window is open, Escape is the window's, not the drawer's.
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
  ModalAddMark: (p: { onClose: () => void; onSubmit: (m: ManualMarkInput[]) => Promise<void> }) => (
    <div data-testid="add-mark-window">
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

describe('RecordDrawer — loading and missing marks', () => {
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

  async function open(mode: 'admin' | 'finance' = 'admin') {
    await act(async () => {
      root.render(<RecordDrawer recordId={701} mode={mode} onClose={onClose} onChanged={onChanged} onUpdated={onUpdated} />);
    });
  }
  const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text));
  const windowEl = () => container.querySelector('[data-testid="add-mark-window"]');
  const escape = (handled = false) => act(async () => {
    const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    if (handled) e.preventDefault();
    window.dispatchEvent(e);
  });

  it('a workday that fails to load says so with «Reintentar»', async () => {
    mocks.getTimeRecord.mockRejectedValueOnce(new Error('boom'));
    await open();
    expect(container.querySelector('[data-testid="record-load-failed"]')?.textContent).toContain('admin:apr.d.loadError');

    await act(async () => { button('common:buttons.retry')!.click(); });
    expect(mocks.getTimeRecord).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="record-load-failed"]')).toBeNull();
    expect(container.textContent).toContain('Sofía Supervisora');
  });

  it('adding missing marks keeps the drawer open and refreshes the list', async () => {
    await open('finance');
    await act(async () => { button('time:manualMarks.addTitle')!.click(); });
    expect(windowEl()).not.toBeNull();

    mocks.getTimeRecord.mockResolvedValue(day({ events: [ev(71, 'CHECK_IN', '2026-09-24T13:00:00Z'), ev(72, 'CHECK_OUT', MARK.capturedAt)] }));
    await act(async () => { button('stub-submit')!.click(); });

    expect(mocks.addManualMarks).toHaveBeenCalledWith(701, [MARK]);
    // The day is read again and the list behind catches up; nothing closes.
    expect(mocks.getTimeRecord).toHaveBeenCalledTimes(2);
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onChanged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(windowEl()).toBeNull();
    expect(container.textContent).toContain('admin:apr.ev.CHECK_OUT');
  });

  it('keeps the window open, and the drawer as it was, when the marks are refused', async () => {
    mocks.addManualMarks.mockRejectedValue(new Error('El registro ya tiene una marca de CHECK_OUT.'));
    await open('finance');
    await act(async () => { button('time:manualMarks.addTitle')!.click(); });
    await act(async () => { button('stub-submit')!.click(); });
    expect(windowEl()).not.toBeNull();
    expect(mocks.getTimeRecord).toHaveBeenCalledTimes(1);
    expect(onUpdated).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('Escape closes the marks window, not the drawer', async () => {
    await open('finance');
    await act(async () => { button('time:manualMarks.addTitle')!.click(); });
    await escape();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => { button('stub-close')!.click(); });
    // A key another layer already handled is not the drawer's either.
    await escape(true);
    expect(onClose).not.toHaveBeenCalled();
    await escape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
