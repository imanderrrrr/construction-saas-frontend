import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ════════════════════════════════════════════════════════════════════════
// Second warehouse audit (2026-10-28), web side of "the clients adapt to the
// server". Observing or rejecting a day, observing a mark and the reason for
// a time fix all reach ReviewRequest.comment (10–50) or
// EditEventTimeRequest.reason (≤ 50). The drawer let any length through —
// two of them through window.prompt — and the server answered 400.
// ════════════════════════════════════════════════════════════════════════

const mocks = vi.hoisted(() => ({
  getTimeRecord: vi.fn(),
  editEventTime: vi.fn(),
  correctEvent: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('../../services/time', () => ({
  getTimeRecord: (...a: unknown[]) => mocks.getTimeRecord(...a),
  editEventTime: (...a: unknown[]) => mocks.editEventTime(...a),
  correctEvent: (...a: unknown[]) => mocks.correctEvent(...a),
  approveEvent: vi.fn(), approveRecord: vi.fn(),
  correctRecord: vi.fn(), rejectRecord: vi.fn(), resolveTransitDispute: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), mocks.toast) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const { defaultValue: _d, ...params } = opts ?? {};
      const kv = Object.entries(params).map(([k, v]) => `${k}=${v}`);
      return kv.length ? `${key}(${kv.join(',')})` : key;
    },
    i18n: { language: 'es' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { RecordDrawer } from './RecordDrawer';
import { resetBusinessTz, setBusinessTz } from '../../helpers/dateTime';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/Guatemala'; setBusinessTz('America/Guatemala'); });
afterAll(() => {
  resetBusinessTz();
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

const DAY = {
  id: 501, workerId: 9, workerUsername: 'maria', workerName: 'Maria',
  projectId: 1, projectName: 'Obra 1',
  projectLatitude: null, projectLongitude: null, geofenceRadiusMeters: 100,
  workDate: '2026-09-15',
  approvalStatus: 'PENDING', isLate: false,
  pendingEventCount: 1,
  events: [{
    id: 11, type: 'CHECK_IN', capturedAtClient: '2026-09-15T12:00:00Z', capturedAtServer: '2026-09-15T12:00:00Z',
    lat: null, lng: null, locationStatus: null, distanceMeters: null,
    eventApprovalStatus: 'PENDING',
    eventReviewComment: null, eventReviewerUsername: null, eventReviewedAt: null,
    sourceProjectId: null, sourceProjectName: null,
    disputeStatus: null, disputeReason: null, awardedTransitMinutes: null,
    disputeResolvedBy: null, disputeResolvedAt: null,
    manualCreatorUsername: null,
  }],
  reviews: [],
  createdAt: '2026-09-15T12:00:00Z', updatedAt: '2026-09-15T20:00:00Z',
};

describe('RecordDrawer — comments and reasons stay within what the server takes', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTimeRecord.mockResolvedValue(DAY);
    mocks.editEventTime.mockResolvedValue(DAY);
    mocks.correctEvent.mockResolvedValue(DAY);
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => { root = createRoot(container); });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function open() {
    await act(async () => {
      root.render(<RecordDrawer recordId={501} onClose={() => {}} onChanged={() => {}} />);
    });
  }

  const buttons = (text: string) =>
    [...container.querySelectorAll('button')].filter(b => b.textContent === text);

  const prompting = (answer: string | null) => {
    window.prompt = vi.fn(() => answer) as unknown as typeof window.prompt;
  };

  it('a mark is not observed with a comment over 50', async () => {
    prompting('x'.repeat(51));
    await open();
    await act(async () => { buttons('admin:apr.observe')[0].click(); });

    expect(mocks.correctEvent).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith('common:validation.maxLength(max=50)');
  });

  it('a mark is not observed with a comment under 10', async () => {
    prompting('corto');
    await open();
    await act(async () => { buttons('admin:apr.observe')[0].click(); });

    expect(mocks.correctEvent).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith('common:validation.minLength(min=10)');
  });

  it('a mark is observed with a comment of 10 to 50', async () => {
    prompting('  La entrada no coincide con la obra  ');
    await open();
    await act(async () => { buttons('admin:apr.observe')[0].click(); });

    expect(mocks.correctEvent).toHaveBeenCalledWith(501, 11, 'La entrada no coincide con la obra');
  });

  it('a time fix is not sent with a reason over 50', async () => {
    prompting('r'.repeat(51));
    await open();
    await act(async () => { buttons('admin:apr.d.fixTime')[0].click(); });
    await act(async () => { buttons('common:buttons.save')[0].click(); });

    expect(mocks.editEventTime).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith('common:validation.maxLength(max=50)');
  });

  it('the day comment stops at 50 and asks for 10 before it can be sent', async () => {
    await open();
    const observeDay = buttons('admin:apr.observe');
    await act(async () => { observeDay[observeDay.length - 1].click(); });
    const textarea = container.querySelector('textarea')!;

    expect(textarea.maxLength).toBe(50);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(textarea, 'corto');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const observeButtons = buttons('admin:apr.observe');
    const send = observeButtons[observeButtons.length - 1];
    expect(send.disabled).toBe(true);
    expect(container.textContent).toContain('common:validation.minLength(min=10)');
  });
});
