// BuildTrack — Where a T&M ticket stands, at a glance.
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
// CONVERTED is the only status that means money moved, so it gets the one
// solid, settled colour on the list.

import { useTranslation } from 'react-i18next';
import type { TmTicketStatus } from '../../services/tm';

const STYLES: Record<TmTicketStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700',
  PENDING_SIGNATURE: 'bg-amber-100 text-amber-800',
  SIGNED: 'bg-emerald-100 text-emerald-800',
  DECLINED: 'bg-red-100 text-red-700',
  CONVERTED: 'bg-blue-100 text-blue-800',
};

export function TmStatusChip({ status }: { status: TmTicketStatus }) {
  const { t } = useTranslation('tm');
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
}
