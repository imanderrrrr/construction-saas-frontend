// BuildTrack — regression: the approvals panel must read the stamp PAYROLL
// PAYS ON.
//
// Every punch carries two timestamps: `capturedAtClient` (sealed by the phone
// when the worker punched) and `capturedAtServer` (when the upload reached
// us). The app punches offline, so they can sit hours apart. The backend's
// PayableMinutes measures the day between CLIENT stamps — the panel used to
// order, render and total on the SERVER ones, so the supervisor approved one
// shift while payroll paid a different one.
//
// These pin the shared helpers that every approvals surface is built on:
// dayHours() (the "N h" pill and the inbox KPI) and sequenceOf() (the inbox
// row summary).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  UPLOAD_LAG_MS, dayHours, payableAt, sequenceOf, uploadLagOf,
} from './shared';
import type { TimeRecordResponse } from '../../services/time';

// The suite may run in any machine timezone (CI is typically UTC) and these
// helpers render local wall-clock times — pin the business one. Assigning
// process.env.TZ resets both Date and Intl's default timezone in Node.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/Guatemala'; }); // UTC-6, no DST
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

type Ev = TimeRecordResponse['events'][number];

/** `client` is nullable on purpose: rows predating the column come back with
 *  it null, which is the only reason the server stamp survives as a fallback. */
function ev(type: string, client: string | null, server: string): Ev {
  return {
    id: 1, type, capturedAtClient: client, capturedAtServer: server,
    lat: null, lng: null, locationStatus: null, distanceMeters: null,
    eventApprovalStatus: 'PENDING',
    eventReviewComment: null, eventReviewerUsername: null, eventReviewedAt: null,
    manualCreatorUsername: null,
  } as unknown as Ev;
}

function record(events: Ev[]): TimeRecordResponse {
  return { events } as unknown as TimeRecordResponse;
}

// The measured defect, in local time (UTC-6): a worker punches in at 06:00
// with no signal; the phone uploads both marks at 14:00 when it gets one.
//   punched  06:00 → 14:00  = 8.0 h  ← what payroll pays
//   uploaded 14:00 → 14:00  = 0.0 h  ← what the panel used to show
const OFFLINE_IN  = ev('CHECK_IN',  '2026-09-15T12:00:00Z', '2026-09-15T20:00:00Z');
const OFFLINE_OUT = ev('CHECK_OUT', '2026-09-15T20:00:00Z', '2026-09-15T20:00:02Z');

describe('payableAt — which of the two stamps the panel reads', () => {
  it('prefers the punch over the upload when both are there', () => {
    expect(payableAt(OFFLINE_IN)).toBe('2026-09-15T12:00:00Z');
  });

  it('falls back to the upload when the punch stamp is missing (old rows)', () => {
    expect(payableAt(ev('CHECK_IN', null, '2026-09-15T20:00:00Z')))
      .toBe('2026-09-15T20:00:00Z');
  });
});

describe('dayHours — the day is totalled on the punch stamps', () => {
  it('totals the hours actually worked, not the upload window', () => {
    expect(dayHours(record([OFFLINE_IN, OFFLINE_OUT]))).toBeCloseTo(8, 5);
  });

  it('discounts lunch on punch stamps too', () => {
    const day = record([
      OFFLINE_IN,
      ev('LUNCH_START', '2026-09-15T18:00:00Z', '2026-09-15T23:05:00Z'),
      ev('LUNCH_END',   '2026-09-15T19:00:00Z', '2026-09-15T19:00:00Z'),
      OFFLINE_OUT,
    ]);
    // 06:00→14:00 minus the 12:00→13:00 lunch = 7 h.
    expect(dayHours(day)).toBeCloseTo(7, 5);
  });

  it('still totals rows that only carry the upload stamp', () => {
    const day = record([
      ev('CHECK_IN',  null, '2026-09-15T14:00:00Z'),
      ev('CHECK_OUT', null, '2026-09-15T22:00:00Z'),
    ]);
    expect(dayHours(day)).toBeCloseTo(8, 5);
  });

  it('orders the day by punch time, not by upload order', () => {
    // Lunch went out of order on the wire: the 12:00 punch sat offline until
    // 17:05, so the 13:00 one reached us first. On upload order the lunch gap
    // inverts and inflates the day; on punch order it is a plain hour.
    const day = record([
      OFFLINE_IN,
      ev('LUNCH_END',   '2026-09-15T19:00:00Z', '2026-09-15T19:00:00Z'),
      ev('LUNCH_START', '2026-09-15T18:00:00Z', '2026-09-15T23:05:00Z'),
      OFFLINE_OUT,
    ]);
    expect(dayHours(day)).toBeCloseTo(7, 5);
  });
});

describe('sequenceOf — the inbox row shows the shift that happened', () => {
  it('renders the punch times', () => {
    expect(sequenceOf(record([OFFLINE_IN, OFFLINE_OUT]), 'es')).toBe('06:00 → 14:00');
  });

  it('sorts by punch time even when the uploads arrived out of order', () => {
    const day = record([
      OFFLINE_IN,
      ev('LUNCH_END',   '2026-09-15T19:00:00Z', '2026-09-15T19:00:00Z'),
      ev('LUNCH_START', '2026-09-15T18:00:00Z', '2026-09-15T23:05:00Z'),
      OFFLINE_OUT,
    ]);
    expect(sequenceOf(day, 'es')).toBe('06:00 → 12:00 · 13:00 → 14:00');
  });

  it('falls back to the upload stamp for rows without a punch one', () => {
    const day = record([
      ev('CHECK_IN',  null, '2026-09-15T14:00:00Z'),
      ev('CHECK_OUT', null, '2026-09-15T22:00:00Z'),
    ]);
    expect(sequenceOf(day, 'es')).toBe('08:00 → 16:00');
  });
});

describe('uploadLagOf — when the upload hour is worth showing beside the punch', () => {
  it('reports the upload stamp when the mark was uploaded well after the punch', () => {
    expect(uploadLagOf(OFFLINE_IN)).toEqual({
      at: '2026-09-15T20:00:00Z', dayOffset: 0,
    });
  });

  it('stays quiet on an ordinary online punch', () => {
    expect(uploadLagOf(OFFLINE_OUT)).toBeNull();
  });

  it('stays quiet just under the threshold and speaks up just over it', () => {
    const punch = Date.parse('2026-09-15T12:00:00Z');
    const at = (ms: number) => new Date(punch + ms).toISOString();
    expect(uploadLagOf(ev('CHECK_IN', at(0), at(UPLOAD_LAG_MS - 1000)))).toBeNull();
    expect(uploadLagOf(ev('CHECK_IN', at(0), at(UPLOAD_LAG_MS)))).not.toBeNull();
  });

  it('reports a punch uploaded past midnight with its day offset', () => {
    // Punched 23:50 local, uploaded 00:10 the next local day.
    expect(uploadLagOf(ev('CHECK_OUT', '2026-09-15T05:50:00Z', '2026-09-15T06:10:00Z')))
      .toEqual({ at: '2026-09-15T06:10:00Z', dayOffset: 1 });
  });

  it('reports a phone clock running AHEAD of the server too', () => {
    // Hiding the negative half would be the same blindness in reverse.
    expect(uploadLagOf(ev('CHECK_IN', '2026-09-15T20:00:00Z', '2026-09-15T19:00:00Z')))
      .toEqual({ at: '2026-09-15T19:00:00Z', dayOffset: 0 });
  });

  it('says nothing when either stamp is missing or unparseable', () => {
    expect(uploadLagOf(ev('CHECK_IN', null, '2026-09-15T20:00:00Z'))).toBeNull();
    expect(uploadLagOf(ev('CHECK_IN', '2026-09-15T12:00:00Z', ''))).toBeNull();
    expect(uploadLagOf(ev('CHECK_IN', 'not-a-date', '2026-09-15T20:00:00Z'))).toBeNull();
  });
});
