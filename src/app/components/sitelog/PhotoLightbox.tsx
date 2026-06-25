import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Download, Trash2, X, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { AuthImage } from './AuthImage';
import { siteLogPhotoUrl, type SiteLogPhoto } from '../../services/siteLog';

interface PhotoLightboxProps {
  photos: SiteLogPhoto[];
  siteLogId: number;
  index: number;
  canDelete: boolean;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDelete: (photoId: number) => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function PhotoLightbox({
  photos,
  siteLogId,
  index,
  canDelete,
  onIndexChange,
  onClose,
  onDelete,
}: PhotoLightboxProps) {
  const { t } = useTranslation('siteLog');
  const photo = photos[index];
  const total = photos.length;

  const goPrev = useCallback(() => {
    if (total > 1) onIndexChange((index - 1 + total) % total);
  }, [index, total, onIndexChange]);

  const goNext = useCallback(() => {
    if (total > 1) onIndexChange((index + 1) % total);
  }, [index, total, onIndexChange]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext]);

  async function handleDownload() {
    if (!photo) return;
    try {
      const res = await fetch(siteLogPhotoUrl(siteLogId, photo.id), { credentials: 'include' as RequestCredentials });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.originalName ?? `site-log-photo-${photo.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error(t('lightbox.failed'), { description: (err as Error)?.message });
    }
  }

  function handleDelete() {
    if (!photo) return;
    if (!window.confirm(t('lightbox.deleteConfirm'))) return;
    onDelete(photo.id);
  }

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption ?? t('lightbox.noCaption')}
    >
      {/* Top bar: counter + actions */}
      <div className="flex items-center justify-between px-4 py-3 text-white/90">
        <span className="text-sm font-mono tabular-nums">
          {t('lightbox.counter', { current: index + 1, total })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDownload}
            title={t('lightbox.download')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Download className="w-5 h-5" />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              title={t('lightbox.delete')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title={t('lightbox.close')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image + arrows */}
      <div className="relative flex-1 flex items-center justify-center px-4 min-h-0">
        {total > 1 && (
          <button
            type="button"
            onClick={goPrev}
            title={t('lightbox.prev')}
            className="absolute left-4 z-10 w-11 h-11 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <AuthImage
          key={photo.id}
          siteLogId={siteLogId}
          photoId={photo.id}
          alt={photo.caption ?? t('lightbox.noCaption')}
          className="max-h-full max-w-full object-contain rounded-md"
        />

        {total > 1 && (
          <button
            type="button"
            onClick={goNext}
            title={t('lightbox.next')}
            className="absolute right-4 z-10 w-11 h-11 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Caption footer */}
      <div className="px-4 py-3 text-white/90">
        <p className="text-sm font-semibold">{photo.caption ?? t('lightbox.noCaption')}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60 mt-0.5">
          <span>{t('lightbox.by', { name: photo.uploaderName })}</span>
          <span>·</span>
          <span>{formatTimestamp(photo.createdAt)}</span>
          {photo.partida && (
            <span className="inline-flex items-center gap-1">
              <span>·</span>
              <Tag className="w-3 h-3" />
              {photo.partida}
            </span>
          )}
        </div>
      </div>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="px-4 pb-4 flex items-center gap-2 overflow-x-auto">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onIndexChange(i)}
              className={cn(
                'flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors',
                i === index ? 'border-[#F97316]' : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              <AuthImage siteLogId={siteLogId} photoId={p.id} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
