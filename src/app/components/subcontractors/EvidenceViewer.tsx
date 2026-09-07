import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { cn } from '../ui/utils';
import { getEvidenceFileUrl, type EvidenceEntry } from '../../services/subcontractors';
import { CloseButton, FOCUS_RING } from '../onboarding/chrome';
import { Mono } from '../projects/bt';
import { stampDateTime } from './bits';
import { evidenceTypeLabel } from './timelineText';

/**
 * 05 — the full-screen viewer.
 *
 * The old one was an overlay with the image and an X: it did not say how many
 * there were, could not step to the next one, could not download, and never
 * said who uploaded it or when. Reviewing six photos meant closing and
 * reopening six times.
 */

export function EvidenceViewer({ items, index, jobTitle, onIndex, onClose }: {
  items: EvidenceEntry[];
  index: number;
  jobTitle: string;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation(['subcontractors', 'common']);
  const lang = i18n.language;
  const [failed, setFailed] = useState(false);
  const current = items[index];

  const go = (delta: number) => {
    const next = (index + delta + items.length) % items.length;
    setFailed(false);
    onIndex(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // The overlay owns the scroll while it is up.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  if (!current) return null;
  const url = getEvidenceFileUrl(current.id);
  const isVideo = current.contentType?.startsWith('video/') ?? false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('subcontractors:viewer.title', { current: index + 1, total: items.length })}
      className="fixed inset-0 z-[97] bg-[rgba(10,10,10,0.92)] flex flex-col"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4 flex-shrink-0">
        <div className="min-w-0">
          <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#F97316]">
            {t('subcontractors:viewer.title', { current: index + 1, total: items.length })}
          </Mono>
          <div className="text-[13.5px] text-[#F5F1E8] mt-1 truncate">{jobTitle}</div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <a
            href={url}
            download={current.originalName ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] border border-[rgba(245,241,232,0.25)] text-[#F5F1E8] px-3 py-2 hover:border-[#F97316] hover:text-[#F97316]', FOCUS_RING)}
          >
            <Download className="w-3 h-3" strokeWidth={2.2} />{t('subcontractors:viewer.download')}
          </a>
          <CloseButton onDark onClick={onClose} aria-label={t('common:buttons.close')} className="w-8 h-8 md:w-7 md:h-7" />
        </div>
      </div>

      <div className="flex-1 min-h-0 relative flex items-center justify-center px-4 md:px-16">
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={t('subcontractors:viewer.prev')}
            className={cn('absolute left-2 md:left-[26px] w-11 h-11 flex items-center justify-center bg-[rgba(11,10,9,0.6)] border border-[rgba(245,241,232,0.25)] text-[#F5F1E8] hover:border-[#F97316] hover:text-[#F97316]', FOCUS_RING)}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2.2} />
          </button>
        )}

        {failed ? (
          <div className="text-center max-w-[420px]">
            <div className="font-bt-display font-extrabold text-[36px] leading-[0.9] uppercase text-[#B3402A]">{t('subcontractors:viewer.failed.big')}</div>
            <p className="text-[13.5px] leading-[1.55] text-[rgba(245,241,232,0.8)] mt-2.5">{t('subcontractors:viewer.failed.hint')}</p>
          </div>
        ) : isVideo ? (
          <video key={current.id} src={url} controls autoPlay className="max-h-full max-w-full" onError={() => setFailed(true)} />
        ) : (
          <img
            key={current.id}
            src={url}
            alt={current.originalName ?? t('subcontractors:ev.noName')}
            className="max-h-full max-w-full object-contain"
            onError={() => setFailed(true)}
          />
        )}

        {items.length > 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={t('subcontractors:viewer.next')}
            className={cn('absolute right-2 md:right-[26px] w-11 h-11 flex items-center justify-center bg-[rgba(11,10,9,0.6)] border border-[rgba(245,241,232,0.25)] text-[#F5F1E8] hover:border-[#F97316] hover:text-[#F97316]', FOCUS_RING)}
          >
            <ChevronRight className="w-5 h-5" strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div className="flex-shrink-0 px-5 py-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Mono className="text-[9px] font-semibold tracking-[0.1em] bg-[#F97316] text-[#0B0A09] px-1.5 py-1">{evidenceTypeLabel(t, current.evidenceType)}</Mono>
          <span className="text-[13px] text-[#F5F1E8] truncate">{current.originalName ?? t('subcontractors:ev.noName')}</span>
        </div>
        <Mono className="block text-[9.5px] tracking-[0.08em] text-[rgba(245,241,232,0.6)] mt-1.5">
          {(current.uploaderName ?? '').toUpperCase()} · {stampDateTime(current.createdAt, lang)}
        </Mono>
        {items.length > 1 && (
          <div className="flex gap-1 mt-3" aria-hidden="true">
            {items.map((it, i) => (
              <span key={it.id} className={cn('h-1 w-[34px]', i === index ? 'bg-[#F97316]' : 'bg-[rgba(245,241,232,0.25)]')} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
