import type { TenantStatus } from '../types';

/**
 * Status pill palettes from the approved Claude Design reference (v2 Brand).
 * Each entry: pill background / border / text / leading dot.
 */
interface PillTone {
  bg: string;
  bd: string;
  tx: string;
  dot: string;
}

const GREEN: PillTone = { bg: '#EDF3DC', bd: '#CFDEAF', tx: '#3D6112', dot: '#6B9A26' };
const AMBER: PillTone = { bg: '#F8EED2', bd: '#EAD8A6', tx: '#93640C', dot: '#C08A14' };
const RED_TINT: PillTone = { bg: '#FAEDE7', bd: '#EEC4B2', tx: '#B42318', dot: '#B42318' };
const RED_SOLID: PillTone = { bg: '#B42318', bd: '#B42318', tx: '#FFFFFF', dot: '#FFFFFF' };
const GRAY: PillTone = { bg: '#E7DFD1', bd: '#D9CFBC', tx: '#6C6152', dot: '#A89A87' };
const FADED: PillTone = { bg: '#EFE8DA', bd: '#E3DACA', tx: '#A89A87', dot: '#C9BCA6' };

export function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold"
      style={{ backgroundColor: tone.bg, borderColor: tone.bd, color: tone.tx }}
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full"
        style={{ backgroundColor: tone.dot }}
      />
      <span>{label}</span>
    </span>
  );
}

const TENANT_TONES: Record<TenantStatus, { tone: PillTone; label: string }> = {
  ACTIVE: { tone: GREEN, label: 'Active' },
  SUSPENDED: { tone: AMBER, label: 'Suspended' },
  DELETED: { tone: RED_TINT, label: 'Deleted' },
};

export function TenantStatusPill({ status }: { status: TenantStatus }) {
  const { tone, label } = TENANT_TONES[status];
  return <StatusPill tone={tone} label={label} />;
}

/** Billing statuses (payments tab) — the design's six-state palette. */
const BILLING_TONES: Record<string, { tone: PillTone; label: string }> = {
  ACTIVE: { tone: GREEN, label: 'Active' },
  TRIALING: { tone: AMBER, label: 'Trialing' },
  PAST_DUE: { tone: RED_TINT, label: 'Past due' },
  EXPIRED: { tone: RED_SOLID, label: 'Expired' },
  PAUSED: { tone: GRAY, label: 'Paused' },
  CANCELED: { tone: FADED, label: 'Canceled' },
};

export function BillingStatusPill({ status }: { status: string | null }) {
  if (!status) return <StatusPill tone={GRAY} label="—" />;
  const entry = BILLING_TONES[status] ?? { tone: GRAY, label: status };
  return <StatusPill tone={entry.tone} label={entry.label} />;
}
