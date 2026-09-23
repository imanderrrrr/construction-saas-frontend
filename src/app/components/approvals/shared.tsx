import type { TimeRecordResponse } from '../../services/time';

/** Shared helpers for the Aprobaciones screens (inbox + record drawer). */

export function Mono({ children, className = '', style, ...rest }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`font-bt-mono uppercase tracking-[0.1em] ${className}`} style={style} {...rest}>
      {children}
    </span>
  );
}

export function initials(fullName: string | null | undefined, username: string): string {
  const base = (fullName && fullName.trim()) || username;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type Ev = TimeRecordResponse['events'][number];

const isIn = (e: Ev) => e.type === 'CHECK_IN';
const isOut = (e: Ev) => e.type === 'CHECK_OUT';

/**
 * The stamp a mark is PAID on.
 *
 * Every punch carries two. `capturedAtClient` is sealed by the phone at the
 * moment the worker punched; `capturedAtServer` is when that punch reached us.
 * The app punches offline, so the two can sit minutes or hours apart — and the
 * backend's PayableMinutes measures the day between CLIENT stamps. This panel
 * reads the same one: showing the other means the supervisor approves one
 * shift and payroll pays a different one.
 *
 * The server stamp stays as a fallback — old rows can still come back with the
 * client one null.
 */
export function payableAt(e: Ev): string {
  return e.capturedAtClient || e.capturedAtServer;
}

function timeOf(e: Ev): number {
  return new Date(payableAt(e)).getTime();
}

/**
 * How far the upload has to trail the punch before the timeline says so.
 *
 * The timeline prints HH:MM, so anything under a minute cannot even render as
 * a different number, and an ordinary online punch lands well under a second
 * apart. Five minutes clears network jitter and app retries while still
 * catching every delay a supervisor would call late. It is a *display*
 * threshold, not a fraud one — an offline upload is normal operation here, so
 * this deliberately sits below the 15 min other products use to accuse a clock.
 */
export const UPLOAD_LAG_MS = 5 * 60_000;

/** Whole calendar days from one instant to another, on the browser's clock —
 *  the same basis hhmm() prints on. */
function localDayDiff(from: Date, to: Date): number {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(to) - day(from)) / 86_400_000);
}

/**
 * The upload stamp, when it sits far enough from the punch to be worth showing
 * beside it, plus the calendar-day offset so a punch uploaded past midnight
 * doesn't read as if it arrived before it happened. `null` when the two stamps
 * agree closely enough, or when either is missing or unparseable.
 *
 * Absolute distance on purpose: the client stamp can also run AHEAD of the
 * server's, and hiding that half would be the same blindness in reverse.
 */
export function uploadLagOf(e: Ev): { at: string; dayOffset: number } | null {
  if (!e.capturedAtClient || !e.capturedAtServer) return null;
  const punch = new Date(e.capturedAtClient);
  const upload = new Date(e.capturedAtServer);
  const lag = upload.getTime() - punch.getTime();
  if (!Number.isFinite(lag) || Math.abs(lag) < UPLOAD_LAG_MS) return null;
  return { at: e.capturedAtServer, dayOffset: localDayDiff(punch, upload) };
}

/** Worked hours for the day: check-out minus check-in, minus the lunch gap. */
export function dayHours(r: TimeRecordResponse): number {
  const evs = [...r.events].sort((a, b) => timeOf(a) - timeOf(b));
  const inEv = evs.find(isIn);
  const outEv = [...evs].reverse().find(isOut);
  if (!inEv || !outEv) return 0;
  let ms = timeOf(outEv) - timeOf(inEv);
  const lunchStart = evs.find(e => e.type === 'LUNCH_START');
  const lunchEnd = evs.find(e => e.type === 'LUNCH_END');
  if (lunchStart && lunchEnd) ms -= timeOf(lunchEnd) - timeOf(lunchStart);
  return Math.max(0, ms / 3_600_000);
}

/**
 * "08:12" — 24h always. Jobsite times are read as a sequence, and "02:05 a. m."
 * triples the width of every row for no gain.
 */
export function hhmm(iso: string, _lang: string): string {
  return new Date(iso).toLocaleTimeString('es-GT', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** "08:12 → 12:00 · 13:00 → 17:30" — the day at a glance. */
export function sequenceOf(r: TimeRecordResponse, lang: string): string {
  const evs = [...r.events].sort((a, b) => timeOf(a) - timeOf(b));
  if (evs.length === 0) return '—';
  const parts: string[] = [];
  for (const e of evs) {
    const t = hhmm(payableAt(e), lang);
    if (isIn(e)) parts.push(t);
    else if (e.type === 'LUNCH_START') parts.push(`→ ${t}`);
    else if (e.type === 'LUNCH_END') parts.push(`· ${t}`);
    else if (isOut(e)) parts.push(`→ ${t}`);
  }
  return parts.join(' ');
}

export interface RecordAlert {
  key: 'outOfRange' | 'late' | 'noCheckout' | 'manual' | 'dispute';
  /** Extra context for the row's second line (already human-readable). */
  detail?: string;
}

/**
 * An OPEN shift: clock-in without a clock-out yet. Mirrors the backend's
 * isShiftOpen — record-level approve/observe answers 409 SHIFT_STILL_OPEN for
 * these until the worker clocks out (approving one would strand it at 0
 * payable minutes). The list uses this to warn before a bulk approve.
 */
export function isOpenShift(r: TimeRecordResponse): boolean {
  return r.events.some(isIn) && !r.events.some(isOut);
}

/**
 * What's off with this day. Order matters — the first one becomes the row's
 * inline reason, so the most actionable comes first.
 */
export function alertsFor(r: TimeRecordResponse): RecordAlert[] {
  const out: RecordAlert[] = [];

  const far = r.events.find(e =>
    e.distanceMeters != null && e.distanceMeters > (r.geofenceRadiusMeters || 0));
  if (far) {
    out.push({ key: 'outOfRange', detail: `${Math.round(far.distanceMeters!)} m` });
  }

  const dispute = r.events.find(e => e.disputeStatus === 'PENDING');
  if (dispute) out.push({ key: 'dispute' });

  if (isOpenShift(r)) out.push({ key: 'noCheckout' });

  if (r.isLate) out.push({ key: 'late' });

  if (r.events.some(e => e.manualCreatorUsername)) out.push({ key: 'manual' });

  return out;
}

export function statusPillClass(status: string): string {
  switch (status) {
    case 'APPROVED': return 'bg-[#E8F0E5] text-[#2E6B34]';
    case 'REJECTED': return 'bg-[#F97316] text-[#0A0A0A]';
    case 'OBSERVED': return 'bg-[#FBEDE0] text-[#C2410C]';
    default: return 'bg-[#F3EEE4] text-[#5A5346]';
  }
}

/** Distance chip wording + tone for a single event. */
export function distanceState(e: Ev, radius: number): { tone: 'ok' | 'far' | 'none'; meters: number | null } {
  if (e.manualCreatorUsername) return { tone: 'none', meters: null };
  if (e.distanceMeters == null) return { tone: 'none', meters: null };
  return { tone: e.distanceMeters > (radius || 0) ? 'far' : 'ok', meters: Math.round(e.distanceMeters) };
}

export const GRID_INK: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(245,241,232,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(245,241,232,0.055) 1px, transparent 1px)',
  backgroundSize: '26px 26px',
};
