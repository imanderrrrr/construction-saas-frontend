// BuildTrack — WorkerTime: which of today's records the punch panel works on.
//
// Since V10 a project can hold several records on one day: a transit a
// supervisor settles before the worker arrives stays a transit-only record and
// the arrival CHECK_IN opens another one (TimeServiceImpl.resolveTransitDispute),
// and a second shift on the same project opens a second record. GET
// /worker/time-records hands a day's records over by their FIRST punch
// (Hibernate appends the events' @OrderBy to the query), so the oldest comes
// first — and the panel used to take the project's first record. Measured
// 2026-09-24, the three days it got wrong:
//   1. transit settled before arrival: after arriving, the panel still showed
//      the transit record — the in-transit block, and CHECK_IN next;
//   2. transit approved en route, worker already on shift: the panel offered
//      CHECK_IN, which the server refuses (INVALID_EVENT_SEQUENCE), so the day
//      could not be closed from the web;
//   3. two shifts on one project: the morning one, "day complete", and no
//      buttons for the afternoon.
// The in-transit block and the worker's state follow the server's rule too:
// the day's last punch, whatever project it landed on. And the block offers
// cancel and dispute only while no supervisor has ruled on the transit
// (TimeServiceImpl.assertTransitNotReviewed): once it is reviewed en route, the
// arrival is what is left — and a server without that guard deletes the
// transit's record on a cancel, review and all.
//
// Every day runs twice — in the server's order and reversed — because the
// choice must not depend on the order of the array.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeEventType, WorkerProject, WorkerState } from '../types';
import type { TimeRecordResponse } from '../services/time';

vi.mock('react-i18next', () => ({
  // Keys verbatim, interpolation values appended, so assertions can see WHICH
  // project a line names without depending on the locale files.
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      if (!opts || typeof opts !== 'object') return key;
      const { ns: _ns, ...vars } = opts as Record<string, unknown>;
      const shown = Object.values(vars);
      return shown.length > 0 ? `${key}[${shown.join('|')}]` : key;
    },
    i18n: { language: 'en' },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
  }),
}));
// The backend is faked one level down, at the HTTP helper, so these days hold
// whichever endpoints the panel reads them from.
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  api: (path: string, init?: RequestInit) => fakeApi(path, init),
  getStoredRole: () => 'WORKER',
}));

import { WorkerTime } from './WorkerTime';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── The day ─────────────────────────────────────────────────────────────────

type Rec = TimeRecordResponse;
type Ev = TimeRecordResponse['events'][number];

const WORK_DATE = '2026-09-24';

/** A punch at a local wall-clock time of that day. */
function at(h: number, m = 0): string {
  return new Date(2026, 8, 24, h, m).toISOString();
}

function project(id: number, name: string): WorkerProject {
  return { id, name, status: 'ACTIVE', latitude: null, longitude: null, geofenceRadiusMeters: 200 };
}
const NORTE = project(1, 'Torre Norte');
const SUR = project(2, 'Plaza Sur');
const BODEGA = project(3, 'Bodega Central');

function ev(id: number, type: TimeEventType, time: string, extra: Partial<Ev> = {}): Ev {
  return {
    id, type, capturedAtClient: time, capturedAtServer: time,
    lat: null, lng: null, locationStatus: 'OK', distanceMeters: null,
    eventApprovalStatus: 'PENDING', eventReviewComment: null,
    eventReviewerUsername: null, eventReviewedAt: null,
    ...extra,
  };
}

/** A transit toward `to` — the event lives on a record of the destination. */
function transit(id: number, time: string, from: WorkerProject, extra: Partial<Ev> = {}): Ev {
  return ev(id, 'IN_TRANSIT', time, { sourceProjectId: from.id, sourceProjectName: from.name, ...extra });
}

function rec(id: number, p: WorkerProject, events: Ev[], extra: Partial<Rec> = {}): Rec {
  return {
    id, workerId: 7, workerUsername: 'obrero', workerName: null,
    projectId: p.id, projectName: p.name,
    projectLatitude: null, projectLongitude: null, geofenceRadiusMeters: 200,
    workDate: WORK_DATE, approvalStatus: 'PENDING', isLate: false,
    pendingEventCount: events.filter(e => e.eventApprovalStatus === 'PENDING').length,
    events, reviews: [],
    createdAt: events[0]?.capturedAtServer ?? at(0),
    updatedAt: events[events.length - 1]?.capturedAtServer ?? at(0),
    ...extra,
  };
}

/** GET /worker/time-records' order within a day: by each record's first punch. */
function byFirstPunch(records: Rec[]): Rec[] {
  const first = (r: Rec) => Math.min(...r.events.map(e => Date.parse(e.capturedAtClient)));
  return [...records].sort((a, b) => first(a) - first(b));
}

// ── Fake backend ────────────────────────────────────────────────────────────
// Written independently of the code under test on purpose: a bug in the
// panel's rule must not be mirrored here.

let projects: WorkerProject[] = [];
let day: Rec[] = [];
let posts: Array<{ projectId: number; type: TimeEventType }> = [];

const STATE_AFTER: Record<TimeEventType, WorkerState> = {
  CHECK_IN: 'WORKING', LUNCH_START: 'ON_LUNCH', LUNCH_END: 'WORKING',
  CHECK_OUT: 'OFF_DUTY', IN_TRANSIT: 'IN_TRANSIT',
};
const ALLOWED: Record<WorkerState, TimeEventType[]> = {
  OFF_DUTY: ['CHECK_IN', 'IN_TRANSIT'], WORKING: ['LUNCH_START', 'CHECK_OUT'],
  ON_LUNCH: ['LUNCH_END'], IN_TRANSIT: ['CHECK_IN'],
};

/** WorkerStateMachine.deriveState: the last of these punches by (client stamp, id). */
function stateOf(records: Rec[]): WorkerState {
  const events = records.flatMap(r => r.events).sort((a, b) =>
    Date.parse(a.capturedAtClient) - Date.parse(b.capturedAtClient) || a.id - b.id);
  const last: Ev | undefined = events[events.length - 1];
  return last ? STATE_AFTER[last.type] : 'OFF_DUTY';
}

const has = (r: Rec, type: TimeEventType) => r.events.some(e => e.type === type);

async function fakeApi(path: string, init?: RequestInit): Promise<unknown> {
  const url = new URL(path, 'http://localhost');
  const method = init?.method ?? 'GET';
  switch (`${method} ${url.pathname}`) {
    case 'GET /api/v1/worker/my-projects':
      return projects;
    case 'GET /api/v1/worker/time-records': {
      const projectId = url.searchParams.get('projectId');
      return day.filter(r => projectId === null || r.projectId === Number(projectId));
    }
    case 'GET /api/v1/worker/my-state':
      // getWorkerStateByProject: each record's OWN punches, and Kotlin's
      // associate keeps the last record of each project.
      return Object.fromEntries(day.map(r => [String(r.projectId), stateOf([r])]));
    case 'POST /api/v1/worker/time-events': {
      const req = JSON.parse(String(init?.body)) as { projectId: number; type: TimeEventType; capturedAtClient: string };
      posts.push({ projectId: req.projectId, type: req.type });
      if (!ALLOWED[stateOf(day)].includes(req.type)) throw new Error('INVALID_EVENT_SEQUENCE');
      const eventId = 9000 + posts.length;
      const event = ev(eventId, req.type, req.capturedAtClient);
      // Just enough of createEvent's record choice for these days: closing
      // punches go on the project's open shift, anything else opens a record.
      const open = day.find(r => r.projectId === req.projectId && has(r, 'CHECK_IN') && !has(r, 'CHECK_OUT'));
      let recordId: number;
      if (req.type !== 'CHECK_IN' && req.type !== 'IN_TRANSIT') {
        if (!open) throw new Error('NO_ACTIVE_SHIFT');
        recordId = open.id;
        day = day.map(r => (r.id === open.id ? { ...r, events: [...r.events, event] } : r));
      } else {
        recordId = 900 + posts.length;
        day = [...day, rec(recordId, projects.find(p => p.id === req.projectId)!, [event])];
      }
      return {
        eventId, serverCapturedAt: req.capturedAtClient, locationStatus: 'OK',
        recordId, nextExpectedType: null,
      };
    }
  }
  throw new Error(`unexpected request: ${method} ${path}`);
}

// ── Harness ─────────────────────────────────────────────────────────────────

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

/** Mount the panel with `shown` selected (the first ACTIVE project is picked on mount). */
async function openPanel(shown: WorkerProject, records: Rec[]) {
  projects = [shown, ...[NORTE, SUR, BODEGA].filter(p => p.id !== shown.id)];
  day = records;
  await act(async () => { root.render(<WorkerTime username="obrero" />); });
  for (let i = 0; i < 3; i++) await flush();
}

const text = () => document.body.textContent ?? '';
const buttons = () => [...document.body.querySelectorAll('button')];

/** The in-transit block's title. Matched with its interpolation: the history
 *  row renders "punch.inTransit" + the origin's name, which a bare
 *  "punch.inTransitTo" would find inside "punch.inTransitTorre Norte". */
const inTransitBlock = () => text().includes('punch.inTransitTo[');

/** The punch the grid offers next: its one enabled punch button. */
function nextPunch(): string | null {
  const next = buttons().find(b => b.textContent?.includes('punchButton.tapToPunch'));
  return next?.textContent?.match(/punchButton\.([A-Z_]+)/)?.[1] ?? null;
}

async function click(el: HTMLElement | undefined) {
  if (!el) throw new Error('nothing to click');
  await act(async () => { el.click(); });
  await flush();
}

/** One tick of the panel's 30 s refresh, which is how a supervisor's review
 *  reaches it. Only for a test that fakes setInterval as well as Date. */
async function poll() {
  await act(async () => { vi.advanceTimersByTime(30_000); });
  await flush();
}

beforeEach(() => {
  // Local wall clock: the panel's "today" is the device's calendar day.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 24, 17, 30));
  posts = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

// ── Days ────────────────────────────────────────────────────────────────────

describe.each([
  ['server order', (rs: Rec[]) => byFirstPunch(rs)],
  ['reversed', (rs: Rec[]) => byFirstPunch(rs).reverse()],
])('WorkerTime — the record in force (%s)', (_order, order) => {
  it('day 1 — transit settled before arrival: shows the arrival record, not the transit one', async () => {
    await openPanel(SUR, order([
      rec(10, NORTE, [ev(100, 'CHECK_IN', at(7)), ev(101, 'CHECK_OUT', at(12))]),
      // Dispute resolved en route: re-derived to APPROVED, so the arrival
      // CHECK_IN could not reuse it and opened record 12.
      rec(11, SUR, [transit(110, at(12, 5), NORTE, {
        disputeStatus: 'RESOLVED', awardedTransitMinutes: 35, eventApprovalStatus: 'APPROVED',
      })], { approvalStatus: 'APPROVED' }),
      rec(12, SUR, [ev(120, 'CHECK_IN', at(12, 50))]),
    ]));

    expect(inTransitBlock()).toBe(false);
    expect(text()).not.toContain('punch.cancelTransit');
    expect(text()).not.toContain('punch.disputeResolved');
    expect(nextPunch()).toBe('LUNCH_START');
  });

  it('day 2 — transit approved en route, worker on shift: the day can be closed from the panel', async () => {
    await openPanel(SUR, order([
      rec(20, NORTE, [ev(200, 'CHECK_IN', at(7)), ev(201, 'CHECK_OUT', at(11))]),
      rec(21, SUR, [transit(210, at(11, 5), NORTE, {
        eventApprovalStatus: 'APPROVED', eventReviewerUsername: 'supervisora',
      })], { approvalStatus: 'APPROVED' }),
      rec(22, SUR, [
        ev(220, 'CHECK_IN', at(11, 45)), ev(221, 'LUNCH_START', at(12, 30)), ev(222, 'LUNCH_END', at(13)),
      ]),
    ]));

    expect(nextPunch()).toBe('CHECK_OUT');

    await click(buttons().find(b => b.textContent?.includes('punchButton.tapToPunch')));
    await click(buttons().find(b => b.textContent === 'buttons.confirm'));

    expect(posts).toEqual([{ projectId: SUR.id, type: 'CHECK_OUT' }]);
    expect(text()).toContain('punch.dayComplete');
  });

  it('day 3 — two shifts on one project: the afternoon one, with its buttons', async () => {
    await openPanel(SUR, order([
      rec(30, SUR, [
        ev(300, 'CHECK_IN', at(7)), ev(301, 'LUNCH_START', at(10)),
        ev(302, 'LUNCH_END', at(10, 30)), ev(303, 'CHECK_OUT', at(12)),
      ]),
      rec(31, SUR, [ev(310, 'CHECK_IN', at(13))]),
    ]));

    expect(text()).not.toContain('punch.dayComplete');
    expect(nextPunch()).toBe('LUNCH_START');
  });

  it('transit in progress: the in-transit block, and CHECK_IN next', async () => {
    await openPanel(SUR, order([
      rec(40, NORTE, [ev(400, 'CHECK_IN', at(7)), ev(401, 'CHECK_OUT', at(12))]),
      rec(41, SUR, [transit(410, at(12, 5), NORTE)]),
    ]));

    expect(text()).toContain(`punch.inTransitTo[${SUR.name}]`);
    expect(text()).toContain(`punch.transitFrom[${NORTE.name}]`);
    expect(text()).toContain('punch.cancelTransit');
    expect(nextPunch()).toBe('CHECK_IN');
  });

  it('transit approved en route, before arrival: the block, without cancel or dispute — the arrival is what is left', async () => {
    await openPanel(SUR, order([
      rec(90, NORTE, [ev(900, 'CHECK_IN', at(7)), ev(901, 'CHECK_OUT', at(12))]),
      rec(91, SUR, [transit(910, at(12, 5), NORTE, {
        eventApprovalStatus: 'APPROVED', eventReviewerUsername: 'supervisora',
      })], { approvalStatus: 'APPROVED' }),
    ]));

    expect(text()).toContain(`punch.inTransitTo[${SUR.name}]`);
    expect(text()).toContain('punch.transitReviewedDesc');
    expect(text()).not.toContain('punch.cancelTransit');
    expect(text()).not.toContain('punch.disputeTransit');

    expect(nextPunch()).toBe('CHECK_IN');
    await click(buttons().find(b => b.textContent?.includes('punchButton.tapToPunch')));
    await click(buttons().find(b => b.textContent === 'buttons.confirm'));

    expect(posts).toEqual([{ projectId: SUR.id, type: 'CHECK_IN' }]);
    expect(inTransitBlock()).toBe(false);
    expect(nextPunch()).toBe('LUNCH_START');
  });

  it('reviewed while the cancel dialog is up: the poll closes it, and it stays shut on the next transit', async () => {
    // The poll's interval too, so poll() can tick it. Keeps the faked clock.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const norte = rec(95, NORTE, [ev(950, 'CHECK_IN', at(7)), ev(951, 'CHECK_OUT', at(9))]);
    const toSur = (review: Partial<Ev> = {}, record: Partial<Rec> = {}) =>
      rec(96, SUR, [transit(960, at(9, 5), NORTE, review)], record);
    await openPanel(SUR, order([norte, toSur()]));

    await click(buttons().find(b => b.textContent?.includes('punch.cancelTransit')));
    expect(text()).toContain('punch.cancelTransitConfirmTitle');

    // Approved en route while the worker is still choosing a reason.
    const approved = toSur({ eventApprovalStatus: 'APPROVED' }, { approvalStatus: 'APPROVED' });
    day = order([norte, approved]);
    await poll();

    expect(text()).not.toContain('punch.cancelTransitConfirmTitle');
    expect(text()).toContain('punch.transitReviewedDesc');

    // The worker went to the warehouse instead, then set off for Plaza Sur
    // again: a transit that is theirs to cancel, and no dialog opens on it.
    day = order([
      norte, approved,
      rec(97, BODEGA, [ev(970, 'CHECK_IN', at(9, 30)), ev(971, 'CHECK_OUT', at(15))]),
      rec(98, SUR, [transit(980, at(15, 5), BODEGA)]),
    ]);
    await poll();

    expect(text()).toContain(`punch.transitFrom[${BODEGA.name}]`);
    expect(buttons().some(b => b.textContent?.includes('punch.cancelTransit'))).toBe(true);
    expect(text()).not.toContain('punch.cancelTransitConfirmTitle');
  });

  it('a second transit to the same project: the block is the one in progress, not the abandoned one', async () => {
    await openPanel(SUR, order([
      rec(80, NORTE, [ev(800, 'CHECK_IN', at(7)), ev(801, 'CHECK_OUT', at(9))]),
      // Abandoned: the worker checked in at the warehouse instead.
      rec(81, SUR, [transit(810, at(9, 5), NORTE)]),
      rec(82, BODEGA, [ev(820, 'CHECK_IN', at(9, 30)), ev(821, 'CHECK_OUT', at(15))]),
      rec(83, SUR, [transit(830, at(15, 5), BODEGA)]),
    ]));

    expect(text()).toContain(`punch.transitFrom[${BODEGA.name}]`);
    expect(text()).not.toContain(`punch.transitFrom[${NORTE.name}]`);
  });

  it('abandoned transit: no in-transit block for a transit the worker is no longer in', async () => {
    await openPanel(SUR, order([
      rec(50, NORTE, [ev(500, 'CHECK_IN', at(7)), ev(501, 'CHECK_OUT', at(12))]),
      rec(51, SUR, [transit(510, at(12, 5), NORTE)]),
      rec(52, BODEGA, [ev(520, 'CHECK_IN', at(12, 40))]),
    ]));

    expect(inTransitBlock()).toBe(false);
    expect(text()).not.toContain('punch.cancelTransit');
  });

  it('abandoned transit, then checked out elsewhere: off duty — a new transit is offered', async () => {
    // GET /worker/my-state reads {Plaza Sur: IN_TRANSIT} here all day.
    await openPanel(BODEGA, order([
      rec(60, NORTE, [ev(600, 'CHECK_IN', at(7)), ev(601, 'CHECK_OUT', at(12))]),
      rec(61, SUR, [transit(610, at(12, 5), NORTE)]),
      rec(62, BODEGA, [ev(620, 'CHECK_IN', at(12, 40)), ev(621, 'CHECK_OUT', at(16))]),
    ]));

    expect(text()).toContain('punch.dayComplete');
    expect(text()).toContain('punch.transitPromptTitle');
  });

  it('a real transit after checking out elsewhere: in transit — no second transit offered', async () => {
    // The very same /my-state map as the abandoned day above; only the
    // punches' order tells the two apart.
    await openPanel(BODEGA, order([
      rec(70, NORTE, [ev(700, 'CHECK_IN', at(7)), ev(701, 'CHECK_OUT', at(12))]),
      rec(71, BODEGA, [ev(710, 'CHECK_IN', at(12, 40)), ev(711, 'CHECK_OUT', at(16))]),
      rec(72, SUR, [transit(720, at(16, 5), BODEGA)]),
    ]));

    expect(text()).toContain('punch.dayComplete');
    expect(text()).not.toContain('punch.transitPromptTitle');
  });
});
