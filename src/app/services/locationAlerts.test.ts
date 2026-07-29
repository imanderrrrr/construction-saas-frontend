// The supervisor alerts feed mixes two very different things: marks the WORKER
// is answerable for, and marks nobody could verify because the project has no
// work area configured — which the ADMIN has to fix. The dashboard paints them
// differently (red vs amber, different wording), so the rule that separates
// them is pinned here rather than living inline in JSX.

import { describe, it, expect } from 'vitest';
import { isUnconfiguredAreaAlert, type OutOfRangeAlertResponse } from './time';

const alert = (counts: Partial<OutOfRangeAlertResponse>): OutOfRangeAlertResponse => ({
  workerId: 1,
  workerUsername: 'obrero1',
  workerName: 'Obrero Uno',
  projectId: 7,
  projectName: 'Torre Norte',
  recordId: 3,
  firstOccurredAt: '2026-07-28T13:00:00Z',
  eventCount: 0,
  unavailableCount: 0,
  noGeofenceCount: 0,
  projectLatitude: null,
  projectLongitude: null,
  geofenceRadiusMeters: 100,
  events: [],
  ...counts,
});

describe('isUnconfiguredAreaAlert', () => {
  it('flags an alert made only of marks nobody could verify', () => {
    expect(isUnconfiguredAreaAlert(alert({ noGeofenceCount: 2 }))).toBe(true);
  });

  it('does not soften a real out-of-range alert that also carries unverified marks', () => {
    // The whole point of the strict check: an unconfigured mark landing in the
    // same worker/project group must never downgrade "punched outside the site"
    // into an amber configuration notice.
    expect(isUnconfiguredAreaAlert(alert({ eventCount: 1, noGeofenceCount: 3 }))).toBe(false);
  });

  it('does not soften a GPS-suppressed alert either', () => {
    expect(isUnconfiguredAreaAlert(alert({ unavailableCount: 1, noGeofenceCount: 1 }))).toBe(false);
  });

  it('is false for ordinary worker alerts with nothing unverified', () => {
    expect(isUnconfiguredAreaAlert(alert({ eventCount: 2 }))).toBe(false);
    expect(isUnconfiguredAreaAlert(alert({ unavailableCount: 2 }))).toBe(false);
  });
});
