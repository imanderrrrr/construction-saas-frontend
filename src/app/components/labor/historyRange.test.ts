import {afterEach, expect, it, vi} from 'vitest';
import {laborRange} from './shared';
afterEach(() => vi.useRealTimers());
it('offers closed weeks and months across calendar boundaries and half-months', () => {
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-01-05T18:00:00Z'));
 expect(laborRange('last-week','','')).toEqual({from:'2025-12-29',to:'2026-01-04'});
 expect(laborRange('last-month','','')).toEqual({from:'2025-12-01',to:'2025-12-31'});
 expect(laborRange('fortnight','','')).toEqual({from:'2026-01-01',to:'2026-01-05'});
 vi.setSystemTime(new Date('2026-01-19T18:00:00Z'));
 expect(laborRange('fortnight','','')).toEqual({from:'2026-01-16',to:'2026-01-19'});
 expect(laborRange('custom','2025-09-01','2025-09-30')).toEqual({from:'2025-09-01',to:'2025-09-30'});
});
