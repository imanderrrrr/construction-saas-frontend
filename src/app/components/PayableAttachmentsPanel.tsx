import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthImage } from './sitelog/AuthImage';
import { Lightbox, type LightboxImage } from './sitelog/Lightbox';
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
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('payable.attachments.title')}</p>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('payable.attachments.loading')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((a, i) => (
            <div key={a.id} className="relative group">
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="block h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted hover:ring-2 hover:ring-purple-400 transition"
                title={a.originalName ?? `#${a.id}`}
              >
                <AuthImage src={payableAttachmentUrl(payableId, a.id)} alt={a.originalName ?? `attachment ${a.id}`} className="h-full w-full object-cover" />
              </button>
              {canManage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(a.id)}
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white shadow disabled:opacity-40"
                  aria-label={t('payable.attachments.remove')}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {canManage && items.length < MAX_COUNT && (
            <label
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/50 cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-colors"
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); handleFiles(Array.from(e.dataTransfer.files)); }}
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground text-center px-1">{t('payable.attachments.add')}</span>
              <input
                type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                disabled={busy}
                onChange={e => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
              />
            </label>
          )}

          {items.length === 0 && !canManage && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
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
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-red-500/20 hover:text-red-300"
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
