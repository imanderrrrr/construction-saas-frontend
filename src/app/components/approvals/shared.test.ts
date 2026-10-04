import { describe, expect, it } from 'vitest';
import type { TimeRecordResponse } from '../../services/time';
import { dayHours, eventTime, hhmm, sequenceOf } from './shared';

const event = (id: number, type: TimeRecordResponse['events'][number]['type'], hour: string): TimeRecordResponse['events'][number] => ({
  id, type, capturedAtClient: `2026-10-02T${hour}:00Z`, capturedAtServer: '2026-10-03T14:50:00Z',
  lat: null, lng: null, locationStatus: null, distanceMeters: null, eventApprovalStatus: 'PENDING',
  eventReviewComment: null, eventReviewerUsername: null, eventReviewedAt: null, manualCreatorUsername: 'admin.demo',
});
const record = (events: TimeRecordResponse['events']): TimeRecordResponse => ({
  id: 1, workerId: 1, workerUsername: 'supervisor.demo', workerName: 'Supervisor Demo', projectId: 1, projectName: 'Obra Demo',
  projectLatitude: null, projectLongitude: null, geofenceRadiusMeters: 100, workDate: '2026-10-02', approvalStatus: 'PENDING',
  isLate: false, pendingEventCount: events.length, events, reviews: [], createdAt: '2026-10-03T14:50:00Z', updatedAt: '2026-10-03T14:50:00Z',
});

describe('approval punch times', () => {
  it('shows eight worked hours for backfilled punches received together the next day', () => {
    const start = event(1, 'CHECK_IN', '14:00'), end = event(2, 'CHECK_OUT', '22:00');
    const r = record([end, start]);
    expect(dayHours(r)).toBe(8);
    expect(sequenceOf(r, 'es')).toBe(`${hhmm(start.capturedAtClient, 'es')} → ${hhmm(end.capturedAtClient, 'es')}`);
    expect(eventTime(start)).toBe(start.capturedAtClient);
  });
  it('deducts lunch using punch times rather than upload times', () => {
    expect(dayHours(record([event(1, 'CHECK_IN', '14:00'), event(2, 'LUNCH_START', '18:00'), event(3, 'LUNCH_END', '19:00'), event(4, 'CHECK_OUT', '22:00')]))).toBe(7);
  });
  it('keeps an open shift at zero until the checkout exists', () => {
    expect(dayHours(record([event(1, 'CHECK_IN', '14:00')]))).toBe(0);
  });
});
