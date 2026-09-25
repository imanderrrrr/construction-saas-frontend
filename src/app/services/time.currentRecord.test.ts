// BuildTrack — a worker's day: the record in force, the transit in progress,
// the state. The rules mirror the server's (TimeServiceImpl.findCurrentTransit,
// WorkerStateMachine.deriveState) and the app's (DayProgress.primaryRecord);
// WorkerTime.currentRecord.test.tsx drives them through the punch panel.

import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
}));

import type { TimeEventType } from '../types';
import {
  currentRecord, currentTransit, deriveWorkerState,
  type TimeRecordResponse,
} from './time';

type Rec = TimeRecordResponse;
type Ev = TimeRecordResponse['events'][number];

function ev(id: number, type: TimeEventType, capturedAtClient: string): Ev {
  return {
    id, type, capturedAtClient, capturedAtServer: capturedAtClient,
    lat: null, lng: null, locationStatus: 'OK', distanceMeters: null,
    eventApprovalStatus: 'PENDING', eventReviewComment: null,
    eventReviewerUsername: null, eventReviewedAt: null,
  };
}

function rec(id: number, projectId: number, events: Ev[], approvalStatus: Rec['approvalStatus'] = 'PENDING'): Rec {
  return {
    id, workerId: 7, workerUsername: 'obrero', workerName: null,
    projectId, projectName: `Obra ${projectId}`,
    projectLatitude: null, projectLongitude: null, geofenceRadiusMeters: 200,
    workDate: '2026-09-24', approvalStatus, isLate: false, pendingEventCount: 0,
    events, reviews: [], createdAt: '', updatedAt: '',
  };
}

/** 2026-09-24 at hh:mm UTC — the rules compare instants, never the zone. */
const t = (hhmm: string) => `2026-09-24T${hhmm}:00Z`;

describe('currentRecord', () => {
  it('is null for a project with no record today', () => {
    expect(currentRecord([])).toBeNull();
  });

  it('takes the open shift over the older transit-only record', () => {
    const transitOnly = rec(11, 2, [ev(110, 'IN_TRANSIT', t('12:05'))], 'APPROVED');
    const arrival = rec(12, 2, [ev(120, 'CHECK_IN', t('12:50'))]);
    expect(currentRecord([transitOnly, arrival])).toBe(arrival);
    expect(currentRecord([arrival, transitOnly])).toBe(arrival);
  });

  it('takes the open shift even when a closed record holds a later punch', () => {
    // Not a day the state machine produces on its own, but the rule is the
    // app's: an open shift is what the next punch closes.
    const open = rec(1, 2, [ev(10, 'CHECK_IN', t('07:00'))]);
    const later = rec(2, 2, [ev(20, 'CHECK_IN', t('08:00')), ev(21, 'CHECK_OUT', t('09:00'))]);
    expect(currentRecord([later, open])).toBe(open);
  });

  it('with no open shift, takes the record holding the latest punch', () => {
    const morning = rec(30, 2, [ev(300, 'CHECK_IN', t('07:00')), ev(301, 'CHECK_OUT', t('12:00'))]);
    const afternoon = rec(31, 2, [ev(310, 'CHECK_IN', t('13:00')), ev(311, 'CHECK_OUT', t('17:00'))]);
    expect(currentRecord([morning, afternoon])).toBe(afternoon);
    expect(currentRecord([afternoon, morning])).toBe(afternoon);
  });

  it('breaks a tie on the stamp by event id, as the server orders a day', () => {
    const a = rec(1, 2, [ev(40, 'IN_TRANSIT', t('12:00'))]);
    const b = rec(2, 2, [ev(41, 'IN_TRANSIT', t('12:00'))]);
    expect(currentRecord([b, a])).toBe(b);
    expect(currentRecord([a, b])).toBe(b);
  });

  it('compares stamps as instants, not as strings', () => {
    // As strings "12:00:00.250Z" < "12:00:00Z"; as instants it is the later one.
    const whole = rec(1, 2, [ev(50, 'IN_TRANSIT', '2026-09-24T12:00:00Z')]);
    const fraction = rec(2, 2, [ev(49, 'IN_TRANSIT', '2026-09-24T12:00:00.250Z')]);
    expect(currentRecord([whole, fraction])).toBe(fraction);
  });
});

describe('currentTransit', () => {
  const norte = rec(1, 1, [ev(1, 'CHECK_IN', t('07:00')), ev(2, 'CHECK_OUT', t('12:00'))]);

  it('is the day’s last punch when it is an IN_TRANSIT', () => {
    const transit = ev(3, 'IN_TRANSIT', t('12:05'));
    expect(currentTransit([norte, rec(2, 2, [transit])])).toBe(transit);
  });

  it('is null once the worker punched anything after it — on any project', () => {
    const abandoned = rec(2, 2, [ev(3, 'IN_TRANSIT', t('12:05'))]);
    const elsewhere = rec(3, 3, [ev(4, 'CHECK_IN', t('12:40'))]);
    expect(currentTransit([abandoned, elsewhere, norte])).toBeNull();
  });

  it('is null for a transit settled before arrival, once the worker arrived', () => {
    const settled = rec(2, 2, [ev(3, 'IN_TRANSIT', t('12:05'))], 'APPROVED');
    const arrival = rec(3, 2, [ev(4, 'CHECK_IN', t('12:50'))]);
    expect(currentTransit([norte, settled, arrival])).toBeNull();
  });

  it('is the later of two transits to one project', () => {
    const first = ev(3, 'IN_TRANSIT', t('09:05'));
    const second = ev(6, 'IN_TRANSIT', t('15:05'));
    const day = [
      rec(2, 2, [first]),
      rec(3, 3, [ev(4, 'CHECK_IN', t('09:30')), ev(5, 'CHECK_OUT', t('15:00'))]),
      rec(4, 2, [second]),
    ];
    expect(currentTransit(day)).toBe(second);
    expect(currentTransit([...day].reverse())).toBe(second);
  });

  it('on a tied stamp, the punch that arrived later wins', () => {
    const transit = ev(3, 'IN_TRANSIT', t('12:05'));
    const checkIn = ev(4, 'CHECK_IN', t('12:05'));
    expect(currentTransit([rec(2, 2, [transit]), rec(3, 2, [checkIn])])).toBeNull();
  });

  it('is null on a day with no punches', () => {
    expect(currentTransit([])).toBeNull();
  });
});

describe('deriveWorkerState', () => {
  it.each([
    ['CHECK_IN', 'WORKING'],
    ['LUNCH_START', 'ON_LUNCH'],
    ['LUNCH_END', 'WORKING'],
    ['CHECK_OUT', 'OFF_DUTY'],
    ['IN_TRANSIT', 'IN_TRANSIT'],
  ] as const)('last punch %s → %s', (type, state) => {
    const day = [rec(1, 1, [ev(1, 'CHECK_IN', t('07:00'))]), rec(2, 2, [ev(2, type, t('12:00'))])];
    expect(deriveWorkerState(day)).toBe(state);
  });

  it('is OFF_DUTY before the first punch', () => {
    expect(deriveWorkerState([])).toBe('OFF_DUTY');
  });

  // GET /worker/my-state answers {2: IN_TRANSIT, 3: …} for both days below:
  // one state per record, from that record's own punches, and no times.
  const abandoned = rec(2, 2, [ev(3, 'IN_TRANSIT', t('12:05'))]);

  it('an abandoned transit does not hold the worker in transit while they work elsewhere', () => {
    expect(deriveWorkerState([abandoned, rec(3, 3, [ev(4, 'CHECK_IN', t('12:40'))])])).toBe('WORKING');
  });

  it('nor after they check out there', () => {
    const elsewhere = rec(3, 3, [ev(4, 'CHECK_IN', t('12:40')), ev(5, 'CHECK_OUT', t('16:00'))]);
    expect(deriveWorkerState([abandoned, elsewhere])).toBe('OFF_DUTY');
  });

  it('a transit taken after checking out elsewhere is in progress — the same map, the other answer', () => {
    const elsewhere = rec(3, 3, [ev(4, 'CHECK_IN', t('07:00')), ev(5, 'CHECK_OUT', t('12:00'))]);
    expect(deriveWorkerState([abandoned, elsewhere])).toBe('IN_TRANSIT');
  });
});
