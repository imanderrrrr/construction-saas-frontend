import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ════════════════════════════════════════════════════════════════════════
// The drawer half of "the panel must read the stamp payroll pays on".
//
// A punch carries `capturedAtClient` (the phone's stamp, what PayableMinutes
// pays on) and `capturedAtServer` (when the upload arrived). The drawer used
// to render, sort and — worst — PRELOAD "fix time" from the server stamp.
// Since the backend's edit-time writes `event.capturedAtClient = newTime`,
// a supervisor "fixing" what they saw overwrote the real punch with the hour
// it happened to reach us. These pin that path shut.
//
// Companion: shared.clientStamp.test.ts covers the helpers the inbox shares.
// ════════════════════════════════════════════════════════════════════════

const mocks = vi.hoisted(() => ({
  getTimeRecord: vi.fn(),
  editEventTime: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('../../services/time', () => ({
  getTimeRecord: (...a: unknown[]) => mocks.getTimeRecord(...a),
  editEventTime: (...a: unknown[]) => mocks.editEventTime(...a),
  approveEvent: vi.fn(), approveRecord: vi.fn(), correctEvent: vi.fn(),
  correctRecord: vi.fn(), rejectRecord: vi.fn(), resolveTransitDispute: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), mocks.toast) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Keys verbatim, with the interpolation params appended, so assertions are
    // locale-proof but can still see WHICH time was rendered.
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

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Local wall-clock rendering AND the Date the edit path builds depend on the
// machine timezone (CI is typically UTC) — pin the business one.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/Guatemala'; }); // UTC-6, no DST
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

function ev(id: number, type: string, client: string | null, server: string) {
  return {
    id, type, capturedAtClient: client, capturedAtServer: server,
    lat: null, lng: null, locationStatus: null, distanceMeters: null,
    eventApprovalStatus: 'PENDING',
    eventReviewComment: null, eventReviewerUsername: null, eventReviewedAt: null,
    sourceProjectId: null, sourceProjectName: null,
    disputeStatus: null, disputeReason: null, awardedTransitMinutes: null,
    disputeResolvedBy: null, disputeResolvedAt: null,
    manualCreatorUsername: null,
  };
}

function record(events: ReturnType<typeof ev>[]) {
  return {
    id: 501, workerId: 9, workerUsername: 'maria', workerName: 'Maria',
    projectId: 1, projectName: 'Obra 1',
    projectLatitude: null, projectLongitude: null, geofenceRadiusMeters: 100,
    workDate: '2026-09-15',
    approvalStatus: 'PENDING', isLate: false,
    pendingEventCount: events.length,
    events, reviews: [],
    createdAt: '2026-09-15T12:00:00Z', updatedAt: '2026-09-15T20:00:00Z',
  };
}

// The measured defect, in local time (UTC-6): punched in at 06:00 with no
// signal, both marks uploaded at 14:00 when the phone got one.
//   punched  06:00 → 14:00 = 8.0 h  ← what payroll pays
//   uploaded 14:00 → 14:00 = 0.0 h  ← what the drawer used to show
const OFFLINE_DAY = record([
  ev(11, 'CHECK_IN',  '2026-09-15T12:00:00Z', '2026-09-15T20:00:00Z'),
  ev(12, 'CHECK_OUT', '2026-09-15T20:00:00Z', '2026-09-15T20:00:02Z'),
]);

describe('RecordDrawer — punch time vs upload time', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTimeRecord.mockResolvedValue(OFFLINE_DAY);
    mocks.editEventTime.mockResolvedValue(OFFLINE_DAY);
    // jsdom has no real prompt; "fix time" asks for a reason through it.
    window.prompt = vi.fn(() => 'llegó tarde el dato') as unknown as typeof window.prompt;
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => { root = createRoot(container); });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function open(rec: unknown = OFFLINE_DAY) {
    mocks.getTimeRecord.mockResolvedValue(rec);
    await act(async () => {
      root.render(<RecordDrawer recordId={501} onClose={() => {}} onChanged={() => {}} />);
    });
  }

  it('shows the hour the worker punched, not the hour it reached the server', async () => {
    await open();
    expect(container.textContent).toContain('06:00');
    // The old render was "14:00 → 14:00": the clock-in must no longer claim 14:00.
    const checkInBlock = container.querySelector('[data-testid="upload-lag-11"]')!.parentElement!;
    expect(checkInBlock.textContent).toContain('06:00');
  });

  it('totals the day on the punch stamps', async () => {
    await open();
    expect(container.textContent).toContain('8.0 h');
    expect(container.textContent).not.toContain('0.0 h');
  });

  it('shows the upload hour beside a mark that was uploaded late', async () => {
    await open();
    const lag = container.querySelector('[data-testid="upload-lag-11"]');
    expect(lag).toBeTruthy();
    expect(lag!.textContent).toBe('admin:apr.d.uploadedAt(time=14:00)');
  });

  it('says nothing beside an ordinary online punch', async () => {
    await open();
    expect(container.querySelector('[data-testid="upload-lag-12"]')).toBeNull();
  });

  it('marks the day offset when the upload landed after midnight', async () => {
    // Punched 23:50 local, uploaded 00:10 the next local day.
    await open(record([
      ev(21, 'CHECK_IN',  '2026-09-15T05:00:00Z', '2026-09-15T05:00:00Z'),
      ev(22, 'CHECK_OUT', '2026-09-15T05:50:00Z', '2026-09-15T06:10:00Z'),
    ]));
    const lag = container.querySelector('[data-testid="upload-lag-22"]');
    expect(lag!.textContent).toBe(
      'admin:apr.d.uploadedAt(time=00:10) admin:apr.d.uploadedDayOffset(days=+1)');
  });

  it('falls back to the upload stamp on rows with no punch stamp', async () => {
    await open(record([
      ev(31, 'CHECK_IN',  null, '2026-09-15T14:00:00Z'),
      ev(32, 'CHECK_OUT', null, '2026-09-15T22:00:00Z'),
    ]));
    expect(container.textContent).toContain('08:00');
    expect(container.textContent).toContain('16:00');
    expect(container.textContent).toContain('8.0 h');
    // Nothing to compare against, so no upload line is drawn.
    expect(container.querySelector('[data-testid="upload-lag-31"]')).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════
// "Fix time" — the path that can destroy a legitimate punch. The backend's
// editEventTime writes `event.capturedAtClient = newTime`, so whatever this
// sends REPLACES the hour payroll pays on.
// ════════════════════════════════════════════════════════════════════════
describe('RecordDrawer — "fix time" edits the hour that gets paid', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTimeRecord.mockResolvedValue(OFFLINE_DAY);
    mocks.editEventTime.mockResolvedValue(OFFLINE_DAY);
    window.prompt = vi.fn(() => 'llegó tarde el dato') as unknown as typeof window.prompt;
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

  const buttonWith = (text: string) =>
    [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text));

  async function openTimeEditor() {
    await act(async () => { buttonWith('admin:apr.d.fixTime')!.click(); });
    return container.querySelector('input[placeholder="HH:MM"]') as HTMLInputElement;
  }

  async function type(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async function save() {
    await act(async () => { buttonWith('common:buttons.save')!.click(); });
  }

  it('preloads the punch hour, so the supervisor edits the hour that is paid', async () => {
    await open();
    const input = await openTimeEditor();
    // It used to preload 14:00 — the upload hour — and saving that wrote it
    // straight over the 06:00 punch.
    expect(input.value).toBe('06:00');
  });

  it('sends an instant built on the PUNCH day, not the upload day', async () => {
    await open();
    const input = await openTimeEditor();
    await type(input, '06:30');
    await save();

    expect(mocks.editEventTime).toHaveBeenCalledTimes(1);
    const [recordId, eventId, newTime, reason] = mocks.editEventTime.mock.calls[0];
    expect(recordId).toBe(501);
    expect(eventId).toBe(11);
    // 06:30 on 2026-09-15 local (UTC-6) — the day the worker punched.
    expect(newTime).toBe('2026-09-15T12:30:00.000Z');
    expect(reason).toBe('llegó tarde el dato');
  });

  it('an untouched save writes the punch back unchanged, never the upload hour', async () => {
    await open();
    await openTimeEditor();
    await save();

    // The corruption in one line: this used to send 20:00:00Z (14:00 local,
    // the upload) and overwrite a perfectly good 06:00 punch.
    expect(mocks.editEventTime.mock.calls[0][2]).toBe('2026-09-15T12:00:00.000Z');
  });

  it('aims at the punch day even when the upload landed on the next one', async () => {
    mocks.getTimeRecord.mockResolvedValue(record([
      // Punched 23:50 local on the 14th; uploaded 00:10 local on the 15th.
      ev(41, 'CHECK_OUT', '2026-09-15T05:50:00Z', '2026-09-15T06:10:00Z'),
    ]));
    await open();
    const input = await openTimeEditor();
    expect(input.value).toBe('23:50');
    await type(input, '23:55');
    await save();

    // Built on the upload stamp this would have landed on the 15th and the
    // backend would have answered WRONG_DATE (it validates the edited instant
    // against record.workDate).
    expect(mocks.editEventTime.mock.calls[0][2]).toBe('2026-09-15T05:55:00.000Z');
  });

  it('refuses an out-of-range time instead of silently rolling into the next day', async () => {
    await open();
    const input = await openTimeEditor();
    await type(input, '25:70');
    await save();

    expect(mocks.editEventTime).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith('admin:apr.d.fixBadTime');
    // The editor stays open so the supervisor can correct the entry.
    expect(container.querySelector('input[placeholder="HH:MM"]')).toBeTruthy();
  });

  it('refuses unparseable input', async () => {
    await open();
    const input = await openTimeEditor();
    await type(input, 'mañana');
    await save();

    expect(mocks.editEventTime).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith('admin:apr.d.fixBadTime');
  });

  it('sends nothing when the reason prompt is dismissed', async () => {
    window.prompt = vi.fn(() => null) as unknown as typeof window.prompt;
    await open();
    const input = await openTimeEditor();
    await type(input, '06:30');
    await save();

    // Cancel has to mean cancel on a path that rewrites a paid timestamp.
    expect(mocks.editEventTime).not.toHaveBeenCalled();
  });

  it('falls back to the default reason when the prompt is left empty', async () => {
    window.prompt = vi.fn(() => '  ') as unknown as typeof window.prompt;
    await open();
    const input = await openTimeEditor();
    await type(input, '06:30');
    await save();

    expect(mocks.editEventTime.mock.calls[0][3]).toBe('admin:apr.d.fixDefaultReason');
  });
});
