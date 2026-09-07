import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText, Play } from 'lucide-react';
import { cn } from '../ui/utils';
import {
  getEvidenceFileUrl, getJobEvidence,
  type EvidenceEntry, type EvidenceType,
} from '../../services/subcontractors';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { EmptyWord, Mono } from '../projects/bt';
import { Panel } from '../projects/ficha/panel';
import { stampDateTime } from './bits';
import { evidenceDescription, evidenceTypeLabel } from './timelineText';
import { EvidenceViewer } from './EvidenceViewer';

/**
 * 04b — everything the subcontractor uploaded from their app.
 *
 * Video is shown as video. They can upload up to 50 MB of MP4, MOV or AVI, and
 * the panel used to hand it over as a file to download — no thumbnail, no
 * player: a walk-through of a jobsite filmed on a phone ended up as a blind
 * link. Photos and videos go to the grid; PDFs and anything else to rows.
 */

type Filter = 'ALL' | 'PROGRESS' | 'FINAL' | 'DOCUMENTS';

const FILTERS: { key: Filter; label: string; types: EvidenceType[] | null }[] = [
  { key: 'ALL', label: 'ev.filter.all', types: null },
  { key: 'PROGRESS', label: 'ev.filter.progress', types: ['PROGRESS_PHOTO'] },
  { key: 'FINAL', label: 'ev.filter.final', types: ['FINAL_EVIDENCE'] },
  // The invoice file is stored as evidence too, and it belongs with the papers.
  { key: 'DOCUMENTS', label: 'ev.filter.documents', types: ['DOCUMENT', 'INVOICE'] },
];

export function isImage(e: EvidenceEntry): boolean {
  return e.contentType?.startsWith('image/') ?? false;
}
export function isVideo(e: EvidenceEntry): boolean {
  return e.contentType?.startsWith('video/') ?? false;
}

export function JobEvidence({ jobId, jobTitle, onCountChange }: { jobId: number; jobTitle: string; onCountChange?: (n: number) => void }) {
  const { t, i18n } = useTranslation(['subcontractors', 'common']);
  const lang = i18n.language;

  const [items, setItems] = useState<EvidenceEntry[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'data'>('loading');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(() => {
    setState('loading');
    getJobEvidence(jobId)
      .then(rows => { setItems(rows); setState('data'); onCountChange?.(rows.length); })
      .catch(() => setState('error'));
  }, [jobId, onCountChange]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const by = (types: EvidenceType[] | null) => (types ? items.filter(e => types.includes(e.evidenceType)).length : items.length);
    return Object.fromEntries(FILTERS.map(f => [f.key, by(f.types)])) as Record<Filter, number>;
  }, [items]);

  const shown = useMemo(() => {
    const def = FILTERS.find(f => f.key === filter);
    return def?.types ? items.filter(e => def.types!.includes(e.evidenceType)) : items;
  }, [items, filter]);

  // The viewer walks the visual pieces only: paging through a PDF next to a
  // photo has nothing to show.
  const viewable = useMemo(() => shown.filter(e => isImage(e) || isVideo(e)), [shown]);
  const files = useMemo(() => shown.filter(e => !isImage(e) && !isVideo(e)), [shown]);

  return (
    <Panel title={t('subcontractors:ficha.tab.evidence')} purpose={t('subcontractors:ev.purpose')}>
      {state !== 'error' && (
        <div className="flex gap-[7px] overflow-x-auto bt-scroll-none pb-1 mb-4">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'inline-flex items-center gap-2 font-bt-mono text-[10px] uppercase tracking-[0.08em] px-[11px] py-2 whitespace-nowrap transition-colors',
                filter === f.key ? 'bg-[#0A0A0A] text-[#F5F1E8]' : 'border border-[#DBD0BB] text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]',
                FOCUS_RING,
              )}
            >
              {t(`subcontractors:${f.label}`)}
              <span className={cn('font-bt-mono text-[9px] px-1.5 py-[2px] leading-none', filter === f.key ? 'bg-[rgba(245,241,232,0.2)]' : 'bg-[#F3EEE4] text-[#0A0A0A]')}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
      )}

      {state === 'loading' && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="bt-skeleton aspect-square" aria-hidden="true" />)}
        </div>
      )}

      {state === 'error' && (
        <EmptyWord
          tone="red"
          word={t('subcontractors:ev.error.big')}
          title={t('subcontractors:ev.error.title')}
          hint={t('subcontractors:jobs.error.hint')}
          className="border-0 py-8"
          action={<SecondaryButton onClick={load} className="bg-[#FAF7F0]">{t('common:buttons.retry')}</SecondaryButton>}
        />
      )}

      {state === 'data' && items.length === 0 && (
        <EmptyWord
          word={t('subcontractors:ev.empty.big')}
          title={t('subcontractors:ev.empty.title')}
          hint={t('subcontractors:ev.empty.hint')}
          className="border-0 py-8"
        />
      )}

      {state === 'data' && items.length > 0 && shown.length === 0 && (
        <EmptyWord
          word={t('subcontractors:ev.empty.big')}
          title={t('subcontractors:ev.emptyFilter.title')}
          hint={t('subcontractors:ev.emptyFilter.hint')}
          className="border-0 py-8"
          action={<SecondaryButton onClick={() => setFilter('ALL')} className="bg-[#FAF7F0]">{t('subcontractors:ev.filter.all')}</SecondaryButton>}
        />
      )}

      {state === 'data' && viewable.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {viewable.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setViewerIndex(i)}
              className={cn('group relative block border border-[#DBD0BB] hover:border-[#F97316] transition-colors text-left', FOCUS_RING)}
            >
              <span className="block aspect-square overflow-hidden bg-[#F3EEE4]">
                {isVideo(e) ? (
                  <span className="w-full h-full bg-[#0B0A09] flex items-center justify-center">
                    <span className="w-[34px] h-[34px] bg-[rgba(245,241,232,0.9)] flex items-center justify-center">
                      <Play className="w-4 h-4 text-[#0B0A09] fill-current" strokeWidth={0} />
                    </span>
                  </span>
                ) : (
                  <img src={getEvidenceFileUrl(e.id)} alt={e.originalName ?? t('subcontractors:ev.noName')} loading="lazy" className="w-full h-full object-cover" />
                )}
              </span>
              <Mono className="absolute top-0 left-0 text-[8.5px] font-semibold tracking-[0.1em] bg-[#0B0A09] text-[#F5F1E8] px-1.5 py-1">
                {evidenceTypeLabel(t, e.evidenceType)}
              </Mono>
              <span className="block px-1.5 py-1.5 bg-white">
                <Mono className="block text-[9px] tracking-[0.06em] text-[#5A5346] truncate">{(e.uploaderName ?? '').toUpperCase()}</Mono>
                <Mono className="block text-[9px] tracking-[0.06em] text-[#A69C8D] truncate">{stampDateTime(e.createdAt, lang)}</Mono>
              </span>
            </button>
          ))}
        </div>
      )}

      {state === 'data' && files.length > 0 && (
        <div className={cn(viewable.length > 0 && 'mt-6')}>
          <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A] mb-2.5">
            {t('subcontractors:ev.documentsHead', { count: files.length })}
          </Mono>
          <div className="border border-[#EDE7DB]">
            {files.map(e => {
              const description = evidenceDescription(t, e);
              return (
                <div key={e.id} className="flex items-center gap-3 px-3.5 py-3 border-b border-[#F0EBE1] last:border-b-0 bg-white">
                  <span className="w-8 h-8 bg-[#F3EEE4] flex items-center justify-center flex-shrink-0" aria-hidden="true">
                    <FileText className="w-4 h-4 text-[#8A8175]" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-[#0A0A0A] truncate">{e.originalName ?? t('subcontractors:ev.noName')}</div>
                    <Mono className="block text-[9.5px] tracking-[0.06em] text-[#A69C8D] truncate">
                      {(e.uploaderName ?? '').toUpperCase()} · {stampDateTime(e.createdAt, lang)}
                    </Mono>
                    {description && <div className="text-[12px] text-[#5A5346] mt-[3px] truncate">{description}</div>}
                  </div>
                  <a
                    href={getEvidenceFileUrl(e.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] border border-[#DBD0BB] px-[11px] py-2 text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C] flex-shrink-0', FOCUS_RING)}
                  >
                    <Download className="w-3 h-3" strokeWidth={2.2} />{t('subcontractors:ev.download')}
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewerIndex != null && viewable.length > 0 && (
        <EvidenceViewer
          items={viewable}
          index={Math.min(viewerIndex, viewable.length - 1)}
          jobTitle={jobTitle}
          onIndex={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </Panel>
  );
}
