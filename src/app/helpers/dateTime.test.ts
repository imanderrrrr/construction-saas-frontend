// BuildTrack — currentMonthLabel() drives the "Paid this month" (AP) and
// "Collected this month" (AR) KPI subtitles. The AP card used to hardcode
// "Feb 2026" (leftover from the design mock), so these tests pin the label to
// the real current month.
//
// currentMonth() derives "today" via Intl in the business timezone
// (localStorage `ofjr_business_timezone`, default America/Panama, UTC-5), so
// the label must follow the BUSINESS month even when UTC has already rolled
// into the next one. Only Date is faked — the helpers use no timers.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentMonth, currentMonthLabel } from './dateTime';

// dateTime.getBusinessTz() reads localStorage, which jsdom does not back here.
// Stub a Map-backed one so tests can configure the business timezone.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: () => null,
  length: 0,
});

function freezeAt(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

afterEach(() => {
  vi.useRealTimers();
  store.clear();
});

describe('currentMonthLabel', () => {
  it('labels the current business month, locale-aware', () => {
    freezeAt('2026-07-12T18:00:00Z'); // 2026-07-12 13:00 in America/Panama
    expect(currentMonth()).toBe('2026-07');
    expect(currentMonthLabel()).toBe('Jul 2026');
    expect(currentMonthLabel('es')).toBe('jul 2026');
  });

  it('stays on the business month when UTC has already rolled into the next one', () => {
    freezeAt('2026-08-01T03:30:00Z'); // still 2026-07-31 22:30 in America/Panama
    expect(currentMonth()).toBe('2026-07');
    expect(currentMonthLabel()).toBe('Jul 2026');
  });

  it('follows a configured business timezone ahead of UTC', () => {
    localStorage.setItem('ofjr_business_timezone', 'Asia/Tokyo');
    freezeAt('2026-07-31T16:00:00Z'); // already 2026-08-01 01:00 in Tokyo
    expect(currentMonth()).toBe('2026-08');
    expect(currentMonthLabel()).toBe('Aug 2026');
  });
});
