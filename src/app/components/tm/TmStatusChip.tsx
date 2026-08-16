// BuildTrack — Where a T&M ticket stands, at a glance.
//
// Built on the panel's stamp grammar — the rectangular mono badge that
// Suscripción and Costo de Mano de Obra wear (`▪ ACTIVO`, `▪ PROYECTADO · NO
// ES EL PAGO`): square corners, IBM Plex Mono in caps, a small square as the
// bullet. No pills, no traffic light.
//
// The five states are told apart by how much *weight* the paper has gained,
// not by hue — the same ladder the rest of the panel climbs:
//
//   DRAFT              sand outline, hollow square   unfinished paper, quiet
//   PENDING_SIGNATURE  ink outline, orange square    in motion — a signature
//                                                    is due right now, and
//                                                    orange is the panel's
//                                                    "needs someone" accent
//   DECLINED           ink outline, ✕ mark           refused. Same hard frame
//                                                    as pending, but the mark
//                                                    says nothing more is
//                                                    coming on its own
//   SIGNED             solid ink, sand square        carries a signature now;
//                                                    it has authority and
//                                                    waits calmly for the
//                                                    office
//   CONVERTED          solid ink, orange square      the only state where
//                                                    money moved — orange on
//                                                    ink is the panel's money
//                                                    stamp (`▪ PROYECTADO`)
//
// PENDING vs DECLINED still cannot blur — both are unauthorised work, only
// one is still in motion — but the distinction is carried by the mark (square
// vs ✕), not by amber vs red.

import { useTranslation } from 'react-i18next';
import type { TmTicketStatus } from '../../services/tm';

type Mark = 'hollow' | 'sand' | 'orange' | 'x';

const STYLES: Record<TmTicketStatus, { wrap: string; mark: Mark }> = {
  DRAFT: { wrap: 'border border-[#DBD0BB] bg-[#FAF7F0] text-[#5A5346]', mark: 'hollow' },
  PENDING_SIGNATURE: { wrap: 'border border-[#0A0A0A] bg-white text-[#0A0A0A]', mark: 'orange' },
  SIGNED: { wrap: 'border border-[#0A0A0A] bg-[#0A0A0A] text-[#F5F1E8]', mark: 'sand' },
  DECLINED: { wrap: 'border border-[#0A0A0A] bg-white text-[#0A0A0A]', mark: 'x' },
  CONVERTED: { wrap: 'border border-[#0A0A0A] bg-[#0A0A0A] text-[#F5F1E8]', mark: 'orange' },
};

function StampMark({ mark }: { mark: Mark }) {
  if (mark === 'x') return <span aria-hidden className="text-[9px] leading-none">✕</span>;
  const fill =
    mark === 'hollow' ? 'border border-[#8A8175]' : mark === 'sand' ? 'bg-[#D5C9B4]' : 'bg-[#F97316]';
  return <span aria-hidden className={`w-1.5 h-1.5 flex-shrink-0 block ${fill}`} />;
}

export function TmStatusChip({ status }: { status: TmTicketStatus }) {
  const { t } = useTranslation('tm');
  const c = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-[3px] font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap ${c.wrap}`}
    >
      <StampMark mark={c.mark} />
      {t(`status.${status}`)}
    </span>
  );
}
