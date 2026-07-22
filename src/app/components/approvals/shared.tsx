import type { TimeRecordResponse } from '../../services/time';

/** Shared helpers for the Aprobaciones screens (inbox + record drawer). */

export function Mono({ children, className = '', style }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <span className={`font-bt-mono uppercase tracking-[0.1em] ${className}`} style={style}>
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

function timeOf(e: Ev): number {
  return new Date(e.capturedAtServer || e.capturedAtClient).getTime();
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
    const t = hhmm(e.capturedAtServer || e.capturedAtClient, lang);
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

  const hasIn = r.events.some(isIn);
  const hasOut = r.events.some(isOut);
  if (hasIn && !hasOut) out.push({ key: 'noCheckout' });

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
