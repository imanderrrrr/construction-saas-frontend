import { useTranslation } from 'react-i18next';
import { Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Lightbox, type LightboxImage } from './Lightbox';
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

/**
 * Site-log photo lightbox — a thin wrapper over the generic <Lightbox>. It maps
 * SiteLogPhoto → LightboxImage (caption + uploader/date/partida footer), wires
 * the site-log i18n labels, and adds the delete action. Navigation, download,
 * ESC / backdrop-close and the thumbnail strip live in the generic component.
 *
 * The public props are unchanged, so SiteLog.tsx keeps calling it as before.
 */
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

  const images: LightboxImage[] = photos.map((p) => ({
    id: p.id,
    url: siteLogPhotoUrl(siteLogId, p.id),
    alt: p.caption ?? t('lightbox.noCaption'),
    downloadName: p.originalName ?? `site-log-photo-${p.id}`,
    caption: p.caption ?? t('lightbox.noCaption'),
    meta: (
      <>
        <span>{t('lightbox.by', { name: p.uploaderName })}</span>
        <span>·</span>
        <span>{formatTimestamp(p.createdAt)}</span>
        {p.partida && (
          <span className="inline-flex items-center gap-1">
            <span>·</span>
            <Tag className="h-3 w-3" />
            {p.partida}
          </span>
        )}
      </>
    ),
  }));

  function handleDelete(photoId: number) {
    if (!window.confirm(t('lightbox.deleteConfirm'))) return;
    onDelete(photoId);
  }

  return (
    <Lightbox
      images={images}
      index={index}
      onIndexChange={onIndexChange}
      onClose={onClose}
      onDownloadError={(err) => toast.error(t('lightbox.failed'), { description: (err as Error)?.message })}
      labels={{
        counter: (current, total) => t('lightbox.counter', { current, total }),
        download: t('lightbox.download'),
        prev: t('lightbox.prev'),
        next: t('lightbox.next'),
        close: t('lightbox.close'),
      }}
      actions={
        canDelete
          ? (img) => (
              <button
                type="button"
                onClick={() => handleDelete(Number(img.id))}
                title={t('lightbox.delete')}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-red-500/20 hover:text-red-300"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )
          : undefined
      }
    />
  );
}
