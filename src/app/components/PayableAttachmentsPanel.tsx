import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthImage } from './sitelog/AuthImage';
import { Lightbox, type LightboxImage } from './sitelog/Lightbox';
import { cn } from './ui/utils';
import { FOCUS_RING } from './onboarding/chrome';
import {
  listPayableAttachments, uploadPayableAttachment, deletePayableAttachment,
  payableAttachmentUrl, type PayableAttachmentResponse,
} from '../services/finance';

// Shared with the create-bill dialog (AccountsPayable), which uploads its
// queued files right after the bill is created.
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_ACCEPT = ALLOWED_TYPES.join(',');
export const MAX_BYTES = 15 * 1024 * 1024; // must match the backend (15 MB)
export const MAX_COUNT = 10;

/**
 * Upload / view (shared Lightbox) / delete photos on an EXISTING payable.
 * Images render via <AuthImage> (blob fetch with the session cookie); delete
 * is gated to FINANCE/ADMIN via [canManage].
 */
export function PayableAttachmentsPanel({
  payableId,
  canManage,
}: {
  payableId: number;
  canManage: boolean;
}) {
  const { t } = useTranslation('finance');
  const [items, setItems] = useState<PayableAttachmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    listPayableAttachments(payableId)
      .then(setItems)
      .catch(err => toast.error(t('payable.attachments.loadFailed'), { description: err?.message }))
      .finally(() => setLoading(false));
  }, [payableId, t]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    if (items.length + files.length > MAX_COUNT) {
      toast.error(t('payable.attachments.tooMany', { max: MAX_COUNT }));
      return;
    }
    setBusy(true);
    try {
      for (const file of files) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(t('payable.attachments.typeNotAllowed', { name: file.name }));
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(t('payable.attachments.tooLarge', { name: file.name }));
          continue;
        }
        await uploadPayableAttachment(payableId, file);
      }
      toast.success(t('payable.attachments.uploaded'));
      refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(t('payable.attachments.uploadFailed'), { description: message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    setBusy(true);
    try {
      await deletePayableAttachment(payableId, id);
      setItems(prev => prev.filter(a => a.id !== id));
      setLightboxIndex(null);
      toast.success(t('payable.attachments.deleted'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(t('payable.attachments.deleteFailed'), { description: message });
    } finally {
      setBusy(false);
    }
  }

  const images: LightboxImage[] = items.map(a => ({
    id: a.id,
    url: payableAttachmentUrl(payableId, a.id),
    alt: a.originalName ?? `attachment ${a.id}`,
    downloadName: a.originalName ?? `payable-${payableId}-photo-${a.id}`,
    caption: a.originalName ?? undefined,
    meta: a.uploadedBy ? t('payable.attachments.uploadedBy', { name: a.uploadedBy }) : undefined,
  }));

  return (
    <div className="space-y-2">
      <p className="font-bt-mono text-[9.5px] uppercase tracking-[0.13em] text-[#8A8175]">{t('payable.attachments.title')}</p>

      {loading ? (
        <p className="text-[12.5px] text-[#8A8175]">{t('payable.attachments.loading')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((a, i) => (
            <div key={a.id} className="relative group">
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                className={cn('block h-20 w-20 overflow-hidden border border-[#DBD0BB] bg-[#F3EEE4] transition-colors hover:border-[#F97316]', FOCUS_RING)}
                title={a.originalName ?? `#${a.id}`}
              >
                <AuthImage src={payableAttachmentUrl(payableId, a.id)} alt={a.originalName ?? `attachment ${a.id}`} className="h-full w-full object-cover" />
              </button>
              {canManage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(a.id)}
                  className={cn('absolute -top-1.5 -right-1.5 hidden group-hover:flex group-focus-within:flex items-center justify-center h-5 w-5 bg-[#B3402A] text-[#F5F1E8] disabled:opacity-40', FOCUS_RING)}
                  aria-label={t('payable.attachments.remove')}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {canManage && items.length < MAX_COUNT && (
            <label
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 border-2 border-dashed border-[#CDBFA6] bg-[#FAF7F0] cursor-pointer transition-colors hover:border-[#F97316] hover:bg-[#FBEDE0] focus-within:border-[#F97316]"
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); handleFiles(Array.from(e.dataTransfer.files)); }}
            >
              <Upload className="h-4 w-4 text-[#8A8175]" />
              <span className="font-bt-mono text-[8.5px] uppercase tracking-[0.06em] text-[#5A5346] text-center px-1">{t('payable.attachments.add')}</span>
              <input
                type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                disabled={busy}
                onChange={e => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
              />
            </label>
          )}

          {items.length === 0 && !canManage && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-[#8A8175]">
              <ImageIcon className="h-4 w-4" /> {t('payable.attachments.none')}
            </div>
          )}
        </div>
      )}

      {lightboxIndex != null && images[lightboxIndex] && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDownloadError={(err) => toast.error(t('payable.attachments.loadFailed'), { description: (err as Error)?.message })}
          labels={{
            download: t('payable.attachments.download'),
            close: t('buttons.close', { ns: 'common' }),
          }}
          actions={
            canManage
              ? (img) => (
                  <button
                    type="button"
                    onClick={() => handleDelete(Number(img.id))}
                    title={t('payable.attachments.remove')}
                    className={cn('flex h-9 w-9 items-center justify-center text-[#F5F1E8] transition-colors hover:bg-[#B3402A]', FOCUS_RING)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )
              : undefined
          }
        />
      )}
    </div>
  );
}
