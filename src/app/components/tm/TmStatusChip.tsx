// BuildTrack — Where a T&M ticket stands, at a glance.
//
// Built on the panel's badge shape — pill, hairline border, a dot in the
// status colour — the same one Bitácora and Reporte de Horas use, so a T&M
// state reads like every other state in the product instead of like a
// stylesheet of its own.
//
// The colours carry a distinction the client cares about and that a single
// "not authorised yet" bucket would erase:
//
//  - PENDING_SIGNATURE is **waiting** — amber, something is still coming.
//  - DECLINED is **refused** — red, nothing more is coming and someone has to
//    do something about it.
//
// Both are unauthorised work and both are counted in the pending total, but
// only one of them is still in motion. Blurring them is how a refused ticket
// sits for three weeks looking like it is merely queued.
//
// SIGNED and CONVERTED are the two the office acts on, so they are the two
// that get a filled dot and the strongest contrast: signed is emerald and
// still owes someone a decision, converted is ink and settled. CONVERTED is
// the only status that means money moved.

import { useTranslation } from 'react-i18next';
import type { TmTicketStatus } from '../../services/tm';

interface ChipStyle {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

const STYLES: Record<TmTicketStatus, ChipStyle> = {
  DRAFT: {
    bg: 'bg-[#FAFAFA]', text: 'text-[#71717A]', border: 'border-[#D4D4D8]', dot: 'bg-[#A1A1AA]',
  },
  PENDING_SIGNATURE: {
    bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500',
  },
  SIGNED: {
    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500',
  },
  DECLINED: {
    bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500',
  },
  CONVERTED: {
    bg: 'bg-[#0A0A0A]', text: 'text-[#F5F1E8]', border: 'border-[#0A0A0A]', dot: 'bg-[#F97316]',
  },
};

export function TmStatusChip({ status }: { status: TmTicketStatus }) {
  const { t } = useTranslation('tm');
  const c = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${c.bg} ${c.text} ${c.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {t(`status.${status}`)}
    </span>
  );
}
