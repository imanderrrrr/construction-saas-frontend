import {describe,it,expect,afterEach} from 'vitest';
import {setBusinessTz,resetBusinessTz,businessDate,businessDateTimeToISO,fmtDate,startOfDayISO,endOfDayISO} from './dateTime';
afterEach(resetBusinessTz);
describe('tenant civil dates',()=>{
 it('retains date-only day in western and eastern zones',()=>{
  for(const zone of ['America/Guatemala','Asia/Tokyo']){setBusinessTz(zone);expect(fmtDate('2026-10-08','en-US')).toBe('Oct 8, 2026');}
 });
 it('uses tenant zone for an instant and manual entry',()=>{
  setBusinessTz('America/Guatemala');expect(businessDate('2026-10-08T02:00:00Z')).toBe('2026-10-07');
  expect(businessDateTimeToISO('2026-10-08','7:15')).toBe('2026-10-08T13:15:00.000Z');
 });
 it('rejects DST gaps and folds, and calculates a 23-hour day',()=>{
  setBusinessTz('America/New_York');expect(()=>businessDateTimeToISO('2026-03-08','02:30')).toThrow();
  expect(()=>businessDateTimeToISO('2026-11-01','01:30')).toThrow();
  expect(Date.parse(endOfDayISO('2026-03-08'))-Date.parse(startOfDayISO('2026-03-08'))+1).toBe(23*3600000);
 });
 it('clears previous tenant zone on session end',()=>{setBusinessTz('Asia/Tokyo');resetBusinessTz();expect(businessDateTimeToISO('2026-10-08','07:00')).toBe('2026-10-08T12:00:00.000Z');});
});
